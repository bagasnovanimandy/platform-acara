import {
  HttpStatus,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { EVENTS } from '@platform-acara/shared';
import { AcaraService, namaWilayah } from '../acara/acara.service.js';
import { pesertaWhere, type Rule } from '../acara/peserta.js';
import type { AuthUser } from '../auth/auth.types.js';
import { AppError, badRequest, conflict, notFound } from '../common/app-error.js';
import { config } from '../config.js';
import { CoreClient } from '../core/core.client.js';
import { EventsService } from '../events/events.service.js';
import type { Rekap } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Scope, WilayahTree } from '../scope/scope.js';
import { ScopeService } from '../scope/scope.service.js';
import type { RekapQuery, SusulanDto } from './rekap.dto.js';
import {
  hitungRekap,
  perluDitutup,
  ringkas,
  ringkasPer,
  type StatusRekap,
  TUTUP_OTOMATIS_MS,
} from './rekap.js';

/** Cek sesi yang perlu ditutup otomatis tiap 5 menit. */
const CEK_TUTUP_MS = 5 * 60_000;

type SesiAcara = {
  id: string;
  acaraId: string;
  nama: string;
  mulai: Date;
  selesai: Date;
  toleransiMenit: number;
  status: string;
  ditutupAt: Date | null;
  acara: { id: string; nama: string; pesertaRules: Rule[] };
};

type PesertaRow = { anggotaId: string; kelompokId: string; desaId: string; daerahId: string };

export interface BarisRekap {
  anggota: {
    id: string;
    kode: string;
    nama: string;
    jenisKelamin: string;
    kategori: string[];
    kelompok: { id: string; nama: string };
    desa: { id: string; nama: string };
    daerah: { id: string; nama: string };
  };
  status: StatusRekap;
  terlambat: boolean;
  waktu: Date | null;
  metode: string | null;
  pintu: string | null;
  susulan: boolean;
  wajahPending: boolean;
  perluTinjau: boolean;
  izin: 'IZIN' | 'SAKIT' | null;
}

const sesiInclude = { acara: { include: { pesertaRules: true } } } as const;

@Injectable()
export class RekapService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RekapService.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly acara: AcaraService,
    private readonly scopes: ScopeService,
    private readonly core: CoreClient,
    private readonly events: EventsService,
  ) {}

  onModuleInit(): void {
    if (config().NODE_ENV === 'test') return;
    const cek = () =>
      void this.tutupOtomatis().catch((e: unknown) =>
        this.logger.warn(`Tutup otomatis gagal: ${e instanceof Error ? e.message : String(e)}`),
      );
    this.timer = setInterval(cek, CEK_TUTUP_MS);
    cek();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  /** Tutup sesi yang sudah lewat `selesai + 2 jam` (HANDOVER §5.9). */
  async tutupOtomatis(now = new Date()): Promise<number> {
    const sesi = await this.prisma.sesi.findMany({
      where: {
        deletedAt: null,
        ditutupAt: null,
        selesai: { lte: new Date(now.getTime() - TUTUP_OTOMATIS_MS) },
        acara: { deletedAt: null },
      },
      include: sesiInclude,
      take: 100,
    });
    for (const s of sesi.filter((x) => perluDitutup(x, now))) await this.tutupSesi(s, now);
    if (sesi.length) this.logger.log(`${sesi.length} sesi ditutup otomatis`);
    return sesi.length;
  }

  async tutup(user: AuthUser, sesiId: string) {
    const sesi = await this.sesiKelola(user, sesiId);
    if (sesi.ditutupAt) throw conflict('SESI_SUDAH_DITUTUP', 'Sesi sudah ditutup');
    await this.tutupSesi(sesi, new Date());
    return this.sesiRekap(user, sesiId, {});
  }

  async hitungUlang(user: AuthUser, sesiId: string) {
    const sesi = await this.sesiKelola(user, sesiId);
    if (!sesi.ditutupAt) {
      throw badRequest('SESI_BELUM_DITUTUP', 'Rekap dihitung ulang setelah sesi ditutup');
    }
    await this.simpanRekap(sesi);
    return this.sesiRekap(user, sesiId, {});
  }

  /** Hitung ulang sesi yang sudah ditutup setelah izin diputuskan (dipanggil dari sinkron event). */
  async hitungUlangIzin(acaraId: string, sesiId: string | null): Promise<void> {
    const sesi = await this.prisma.sesi.findMany({
      where: {
        acaraId,
        deletedAt: null,
        ditutupAt: { not: null },
        ...(sesiId ? { id: sesiId } : {}),
      },
      include: sesiInclude,
    });
    for (const s of sesi) await this.simpanRekap(s);
  }

  /** Absensi yang baru tersinkron setelah sesi ditutup (perangkat offline) ikut masuk rekap. */
  async perbaruiJikaDitutup(sesiId: string): Promise<void> {
    const sesi = await this.prisma.sesi.findFirst({
      where: { id: sesiId, deletedAt: null, ditutupAt: { not: null } },
      include: sesiInclude,
    });
    if (sesi) await this.simpanRekap(sesi);
  }

  /** Absensi susulan oleh admin (orang hadir tapi tidak tercatat di pintu). */
  async susulan(user: AuthUser, sesiId: string, dto: SusulanDto) {
    const sesi = await this.sesiKelola(user, sesiId);
    const peserta = await this.peserta(sesi);
    if (!peserta.some((p) => p.anggotaId === dto.anggotaId)) {
      throw badRequest('BUKAN_PESERTA', 'Anggota bukan peserta sesi ini');
    }
    const ada = await this.prisma.absensi.findUnique({
      where: { sesiId_anggotaId: { sesiId, anggotaId: dto.anggotaId } },
    });
    if (ada) throw conflict('SUDAH_HADIR', 'Anggota sudah tercatat hadir');
    const capturedAt = dto.waktu ? new Date(dto.waktu) : sesi.mulai;
    await this.prisma.absensi.create({
      data: {
        clientId: crypto.randomUUID(),
        sesiId,
        anggotaId: dto.anggotaId,
        metode: 'MANUAL',
        dicatatAdminId: user.id,
        capturedAt,
        terlambat: capturedAt.getTime() > sesi.mulai.getTime() + sesi.toleransiMenit * 60_000,
        catatan: dto.catatan || null,
      },
    });
    if (sesi.ditutupAt) await this.simpanRekap(sesi);
    return this.sesiRekap(user, sesiId, {});
  }

  /** Rekap satu sesi: final bila sudah ditutup, sementara (dihitung langsung) bila belum. */
  async sesiRekap(user: AuthUser, sesiId: string, q: RekapQuery) {
    const sesi = await this.sesiTerlihat(user, sesiId);
    const [scope, tree] = await Promise.all([this.scopes.forUser(user), this.core.wilayah()]);
    const { rows, dihitungAt } = await this.baris(sesi, tree);
    const items = saring(rows, scope, q);
    return {
      sesi: {
        id: sesi.id,
        nama: sesi.nama,
        mulai: sesi.mulai,
        selesai: sesi.selesai,
        status: sesi.status,
        ditutupAt: sesi.ditutupAt,
      },
      acara: { id: sesi.acara.id, nama: sesi.acara.nama },
      final: !!sesi.ditutupAt,
      dihitungAt,
      ringkas: ringkas(items),
      perKelompok: ringkasPer(items, (r) => r.anggota.kelompok),
      perDesa: ringkasPer(items, (r) => r.anggota.desa),
      items,
    };
  }

  /** Rekap seluruh sesi satu acara: matriks anggota × sesi. */
  async acaraRekap(user: AuthUser, acaraId: string, q: RekapQuery) {
    await this.acara.visible(user, acaraId);
    const [scope, tree, daftar] = await Promise.all([
      this.scopes.forUser(user),
      this.core.wilayah(),
      this.prisma.sesi.findMany({
        where: { acaraId, deletedAt: null },
        include: sesiInclude,
        orderBy: { mulai: 'asc' },
      }),
    ]);
    const perSesi = await Promise.all(
      daftar.map(async (s) => ({
        sesi: s,
        items: saring((await this.baris(s, tree)).rows, scope, q),
      })),
    );
    const anggota = new Map<
      string,
      { anggota: BarisRekap['anggota']; status: (StatusRekap | null)[] }
    >();
    perSesi.forEach(({ items }, i) => {
      for (const r of items) {
        const a = anggota.get(r.anggota.id) ?? {
          anggota: r.anggota,
          status: Array<StatusRekap | null>(daftar.length).fill(null),
        };
        a.status[i] = r.status;
        anggota.set(r.anggota.id, a);
      }
    });
    const semua = perSesi.flatMap((p) => p.items);
    return {
      acara: { id: acaraId, nama: daftar[0]?.acara.nama ?? '' },
      sesi: perSesi.map(({ sesi, items }) => ({
        id: sesi.id,
        nama: sesi.nama,
        mulai: sesi.mulai,
        final: !!sesi.ditutupAt,
        ringkas: ringkas(items),
      })),
      ringkas: ringkas(semua),
      perKelompok: ringkasPer(semua, (r) => r.anggota.kelompok),
      anggota: [...anggota.values()]
        .map((a) => {
          const isi = a.status.filter((s): s is StatusRekap => s !== null);
          return { ...a, ringkas: ringkas(isi.map((status) => ({ status, terlambat: false }))) };
        })
        .sort(
          (x, y) =>
            x.anggota.kelompok.nama.localeCompare(y.anggota.kelompok.nama, 'id') ||
            x.anggota.nama.localeCompare(y.anggota.nama, 'id'),
        ),
    };
  }

  /** Riwayat kehadiran satu anggota dari sesi yang sudah ditutup. */
  async riwayatAnggota(user: AuthUser, anggotaId: string) {
    const scope = await this.scopes.forUser(user);
    const a = await this.prisma.anggotaRef.findUnique({ where: { id: anggotaId } });
    if (!a || !(scope.all || scope.manageKelompok.has(a.kelompokId))) {
      throw notFound('Anggota', anggotaId);
    }
    const rows = await this.prisma.rekap.findMany({
      where: { anggotaId, sesi: { deletedAt: null, acara: { deletedAt: null } } },
      include: { sesi: { include: { acara: { select: { id: true, nama: true } } } } },
      orderBy: { sesi: { mulai: 'desc' } },
      take: 200,
    });
    return {
      ringkas: ringkas(rows),
      items: rows.map((r) => ({
        sesi: { id: r.sesi.id, nama: r.sesi.nama, mulai: r.sesi.mulai },
        acara: r.sesi.acara,
        status: r.status,
        terlambat: r.terlambat,
      })),
    };
  }

  /** Nama wilayah filter (untuk judul & nama file ekspor). */
  async labelFilter(q: RekapQuery): Promise<string | null> {
    const tree = await this.core.wilayah();
    if (q.kelompokId) return namaWilayah(tree, 'KELOMPOK', q.kelompokId);
    if (q.desaId) return namaWilayah(tree, 'DESA', q.desaId);
    if (q.daerahId) return namaWilayah(tree, 'DAERAH', q.daerahId);
    return null;
  }

  // ---------- internal

  private async tutupSesi(sesi: SesiAcara, now: Date): Promise<void> {
    await this.snapshot(sesi);
    await this.prisma.sesi.update({
      where: { id: sesi.id },
      data: { status: 'DITUTUP', ditutupAt: now },
    });
    await this.simpanRekap({ ...sesi, ditutupAt: now });
    await this.events.publish(EVENTS.SESI_CLOSED, { sesiId: sesi.id });
  }

  /**
   * Snapshot peserta saat sesi ditutup: peserta menurut aturan saat itu + siapa pun yang
   * tercatat hadir. Rekap berikutnya tidak berubah walau data anggota berubah.
   */
  private async snapshot(sesi: SesiAcara): Promise<void> {
    if (await this.prisma.pesertaSesi.count({ where: { sesiId: sesi.id } })) return;
    const rows = await this.pesertaLangsung(sesi);
    await this.prisma.pesertaSesi.createMany({
      data: rows.map((r) => ({ sesiId: sesi.id, ...r })),
      skipDuplicates: true,
    });
  }

  private async pesertaLangsung(sesi: SesiAcara): Promise<PesertaRow[]> {
    const select = { id: true, kelompokId: true, desaId: true, daerahId: true } as const;
    const hadir = await this.prisma.absensi.findMany({
      where: { sesiId: sesi.id, anggotaId: { not: null } },
      select: { anggotaId: true },
    });
    const [aturan, tambahan] = await Promise.all([
      this.prisma.anggotaRef.findMany({ where: pesertaWhere(sesi.acara.pesertaRules), select }),
      this.prisma.anggotaRef.findMany({
        where: { id: { in: hadir.map((h) => h.anggotaId!) } },
        select,
      }),
    ]);
    const map = new Map<string, PesertaRow>();
    for (const a of [...aturan, ...tambahan]) {
      map.set(a.id, {
        anggotaId: a.id,
        kelompokId: a.kelompokId,
        desaId: a.desaId,
        daerahId: a.daerahId,
      });
    }
    return [...map.values()];
  }

  /** Peserta sesi: snapshot bila sudah ditutup, selain itu dihitung dari aturan saat ini. */
  private async peserta(sesi: SesiAcara): Promise<PesertaRow[]> {
    if (sesi.ditutupAt) {
      return this.prisma.pesertaSesi.findMany({
        where: { sesiId: sesi.id },
        select: { anggotaId: true, kelompokId: true, desaId: true, daerahId: true },
      });
    }
    return this.pesertaLangsung(sesi);
  }

  private async hitung(sesi: SesiAcara) {
    const peserta = await this.peserta(sesi);
    const [absensi, izin] = await Promise.all([
      this.prisma.absensi.findMany({
        where: { sesiId: sesi.id, anggotaId: { not: null } },
        select: { id: true, anggotaId: true, terlambat: true },
      }),
      this.prisma.izinRef.findMany({
        where: { acaraId: sesi.acaraId, anggotaId: { in: peserta.map((p) => p.anggotaId) } },
      }),
    ]);
    return {
      peserta,
      hasil: hitungRekap(
        sesi.id,
        peserta.map((p) => p.anggotaId),
        absensi.map((a) => ({ id: a.id, anggotaId: a.anggotaId!, terlambat: a.terlambat })),
        izin,
      ),
    };
  }

  private async simpanRekap(sesi: SesiAcara): Promise<void> {
    const { hasil } = await this.hitung(sesi);
    const now = new Date();
    // Rekap adalah data turunan: diganti seluruhnya setiap dihitung ulang.
    await this.prisma.$transaction([
      this.prisma.rekap.deleteMany({ where: { sesiId: sesi.id } }),
      this.prisma.rekap.createMany({
        data: hasil.map((h) => ({ sesiId: sesi.id, ...h, dihitungAt: now })),
      }),
    ]);
  }

  /** Baris rekap lengkap (nama, wilayah, detail absensi) untuk tampilan & ekspor. */
  private async baris(sesi: SesiAcara, tree: WilayahTree) {
    let hasil: Omit<Rekap, 'sesiId' | 'dihitungAt'>[];
    let peserta: PesertaRow[];
    let dihitungAt: Date | null = null;
    if (sesi.ditutupAt) {
      const [tersimpan, p] = await Promise.all([
        this.prisma.rekap.findMany({ where: { sesiId: sesi.id } }),
        this.peserta(sesi),
      ]);
      hasil = tersimpan;
      peserta = p;
      for (const r of tersimpan)
        if (!dihitungAt || r.dihitungAt > dihitungAt) dihitungAt = r.dihitungAt;
    } else {
      ({ hasil, peserta } = await this.hitung(sesi));
    }
    const pesertaBy = new Map(peserta.map((p) => [p.anggotaId, p]));
    const ids = hasil.map((h) => h.anggotaId);
    const [anggota, absensi, izin, operator] = await Promise.all([
      this.prisma.anggotaRef.findMany({ where: { id: { in: ids } } }),
      this.prisma.absensi.findMany({ where: { sesiId: sesi.id, anggotaId: { in: ids } } }),
      this.prisma.izinRef.findMany({
        where: { id: { in: hasil.flatMap((h) => (h.izinId ? [h.izinId] : [])) } },
        select: { id: true, kategori: true },
      }),
      this.prisma.operatorSession.findMany({
        where: { sesiId: sesi.id },
        select: { id: true, label: true },
      }),
    ]);
    const wajahPending = new Set(
      (
        await this.prisma.faceData.findMany({
          where: {
            id: { in: absensi.flatMap((a) => (a.faceDataId ? [a.faceDataId] : [])) },
            status: 'PENDING',
          },
          select: { id: true },
        })
      ).map((f) => f.id),
    );
    const anggotaBy = new Map(anggota.map((a) => [a.id, a]));
    const absensiBy = new Map(absensi.map((a) => [a.anggotaId!, a]));
    const izinBy = new Map(izin.map((i) => [i.id, i.kategori]));
    const opBy = new Map(operator.map((o) => [o.id, o.label]));
    const rows: BarisRekap[] = [];
    for (const h of hasil) {
      const a = anggotaBy.get(h.anggotaId);
      if (!a) continue;
      const p = pesertaBy.get(h.anggotaId);
      const w = {
        kelompokId: p?.kelompokId ?? a.kelompokId,
        desaId: p?.desaId ?? a.desaId,
        daerahId: p?.daerahId ?? a.daerahId,
      };
      const abs = h.absensiId ? absensiBy.get(h.anggotaId) : undefined;
      rows.push({
        anggota: {
          id: a.id,
          kode: a.kode,
          nama: a.nama,
          jenisKelamin: a.jenisKelamin,
          kategori: a.kategori,
          kelompok: {
            id: w.kelompokId,
            nama: nama(tree, 'KELOMPOK', w.kelompokId, a.namaKelompok),
          },
          desa: { id: w.desaId, nama: nama(tree, 'DESA', w.desaId, a.namaDesa) },
          daerah: { id: w.daerahId, nama: nama(tree, 'DAERAH', w.daerahId, a.namaDaerah) },
        },
        status: h.status,
        terlambat: h.terlambat,
        waktu: abs?.capturedAt ?? null,
        metode: abs?.metode ?? null,
        pintu: abs?.operatorSessionId ? (opBy.get(abs.operatorSessionId) ?? null) : null,
        susulan: !!abs?.dicatatAdminId,
        wajahPending: !!abs?.faceDataId && wajahPending.has(abs.faceDataId),
        perluTinjau: !!abs?.perluTinjau,
        izin: h.izinId ? (izinBy.get(h.izinId) ?? null) : null,
      });
    }
    rows.sort(
      (x, y) =>
        x.anggota.kelompok.nama.localeCompare(y.anggota.kelompok.nama, 'id') ||
        x.anggota.nama.localeCompare(y.anggota.nama, 'id'),
    );
    return { rows, dihitungAt };
  }

  private async sesiTerlihat(user: AuthUser, sesiId: string): Promise<SesiAcara> {
    const sesi = await this.prisma.sesi.findFirst({
      where: { id: sesiId, deletedAt: null },
      include: sesiInclude,
    });
    if (!sesi) throw notFound('Sesi', sesiId);
    await this.acara.visible(user, sesi.acaraId);
    return sesi;
  }

  private async sesiKelola(user: AuthUser, sesiId: string): Promise<SesiAcara> {
    const sesi = await this.prisma.sesi.findFirst({
      where: { id: sesiId, deletedAt: null },
      include: sesiInclude,
    });
    if (!sesi) throw notFound('Sesi', sesiId);
    await this.acara.manageable(user, sesi.acaraId);
    if (sesi.mulai > new Date() && !sesi.ditutupAt) {
      // Absensi susulan / tutup sebelum sesi mulai tidak masuk akal.
      throw new AppError(HttpStatus.BAD_REQUEST, 'SESI_BELUM_MULAI', 'Sesi belum dimulai');
    }
    return sesi;
  }
}

function nama(tree: WilayahTree, level: string, id: string, cadangan: string): string {
  const n = namaWilayah(tree, level, id);
  return n === '(wilayah tidak dikenal)' ? cadangan : n;
}

/** Baris dalam wilayah user, lalu filter kelompok/desa/daerah dari query. */
function saring(rows: BarisRekap[], s: Scope, q: RekapQuery): BarisRekap[] {
  return rows.filter(
    (r) =>
      (s.all || s.manageKelompok.has(r.anggota.kelompok.id)) &&
      (!q.kelompokId || r.anggota.kelompok.id === q.kelompokId) &&
      (!q.desaId || r.anggota.desa.id === q.desaId) &&
      (!q.daerahId || r.anggota.daerah.id === q.daerahId),
  );
}
