import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { EVENTS } from '@platform-acara/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { AcaraClient } from '../clients/acara.client.js';
import { CoreClient } from '../clients/core.client.js';
import { AppError, conflict, notFound } from '../common/app-error.js';
import { EventsService } from '../events/events.service.js';
import type { Izin, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { kelolaKelompok } from '../scope/scope.js';
import { ScopeService } from '../scope/scope.service.js';
import { KATEGORI_LABEL, type KategoriIzin, nomorIzin, waktuSingkat } from '../bot/format.js';
import { WaService } from '../wa/wa.service.js';
import type { ListIzinQuery } from './izin.dto.js';

export interface PengajuanIzin {
  anggotaId: string;
  sesiId: string;
  kategori: KategoriIzin;
  alasan: string;
  pengajuNoWa: string;
  pengajuTipe: 'ANGGOTA' | 'WALI';
}

export interface Pemutus {
  userId: string;
  nama: string;
  role: string;
  via: 'WA' | 'WEB';
}

const ROLE_PUTUS = new Set(['SUPER_ADMIN', 'ADMIN', 'PENGURUS']);

/** Pesan untuk PJ yang menerima pengajuan (HANDOVER §5.8). */
export function teksPengajuan(i: Izin): string {
  const n = String(i.nomor).padStart(4, '0');
  return [
    `📋 Pengajuan izin #${nomorIzin(i.nomor)}`,
    `Nama    : ${i.namaAnggota} (${i.kodeAnggota}) — ${i.namaKelompok}, ${i.namaDesa}`,
    `Acara   : ${i.acaraNama} — ${waktuSingkat(i.sesiMulai)}, ${i.sesiNama}`,
    `Kategori: ${KATEGORI_LABEL[i.kategori]}`,
    `Alasan  : ${i.alasan}`,
    `Pengaju : ${i.pengajuTipe === 'WALI' ? 'wali' : 'yang bersangkutan'}`,
    `Balas: SETUJU ${n}  atau  TOLAK ${n} <catatan>`,
  ].join('\n');
}

export function teksKeputusan(i: Izin): string {
  const hasil = i.status === 'APPROVED' ? '*disetujui*' : '*ditolak*';
  const catatan = i.catatanPengurus ? `\nCatatan: ${i.catatanPengurus}` : '';
  return `Izin ${nomorIzin(i.nomor)} untuk ${i.namaAnggota} (${i.acaraNama}, ${i.sesiNama}, ${waktuSingkat(i.sesiMulai)}) ${hasil}.${catatan}`;
}

@Injectable()
export class IzinService {
  private readonly log = new Logger(IzinService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly acara: AcaraClient,
    private readonly core: CoreClient,
    private readonly scopes: ScopeService,
    private readonly events: EventsService,
    private readonly wa: WaService,
  ) {}

  /** Simpan pengajuan dari bot, kirim event, dan teruskan ke PJ izin acara. */
  async ajukan(p: PengajuanIzin): Promise<Izin> {
    const anggota = await this.prisma.anggotaRef.findUnique({ where: { id: p.anggotaId } });
    if (!anggota) throw notFound('Anggota', p.anggotaId);
    // Periksa ulang dengan data terbaru: masih peserta dan belum lewat batas izin.
    const opsi = (await this.acara.sesiMendatang(p.anggotaId)).find((s) => s.sesi.id === p.sesiId);
    if (!opsi || new Date(opsi.sesi.batasIzin) <= new Date()) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'BATAS_IZIN_LEWAT',
        'Maaf, batas pengajuan izin untuk sesi ini sudah lewat.',
      );
    }
    const ada = await this.prisma.izin.findFirst({
      where: {
        anggotaId: p.anggotaId,
        sesiId: p.sesiId,
        status: { in: ['SUBMITTED', 'APPROVED'] },
      },
    });
    if (ada) {
      throw conflict(
        'IZIN_SUDAH_ADA',
        `Sudah ada pengajuan ${nomorIzin(ada.nomor)} untuk ${anggota.nama} di sesi ini (${ada.status === 'APPROVED' ? 'disetujui' : 'menunggu persetujuan'}).`,
      );
    }
    // PJ izin acara; bila tidak ada, pengurus terdekat kelompok anggota.
    const pj = (await this.acara.pj(opsi.acara.id)).filter((x) => x.peran === 'PJ_IZIN');
    const handler = pj.length
      ? [...new Set(pj.map((x) => x.userId))]
      : (await this.core.pengurusKelompok(anggota.kelompokId)).map((u) => u.id);

    const izin = await this.prisma.izin.create({
      data: {
        anggotaId: anggota.id,
        kodeAnggota: anggota.kode,
        namaAnggota: anggota.nama,
        kelompokId: anggota.kelompokId,
        namaKelompok: anggota.namaKelompok,
        namaDesa: anggota.namaDesa,
        pengajuNoWa: p.pengajuNoWa,
        pengajuTipe: p.pengajuTipe,
        acaraId: opsi.acara.id,
        acaraNama: opsi.acara.nama,
        sesiId: opsi.sesi.id,
        sesiNama: opsi.sesi.nama,
        sesiMulai: new Date(opsi.sesi.mulai),
        kategori: p.kategori,
        alasan: p.alasan,
        handlerUserIds: handler,
      },
    });
    await this.events.publish(EVENTS.IZIN_SUBMITTED, {
      izinId: izin.id,
      anggotaId: izin.anggotaId,
      acaraId: izin.acaraId,
      sesiId: izin.sesiId,
      kategori: izin.kategori,
      alasan: izin.alasan,
    });
    await this.teruskan(izin);
    return izin;
  }

  /** Kirim pengajuan ke PJ yang punya nomor WA (satu pesan per PJ, bukan massal). */
  private async teruskan(izin: Izin): Promise<void> {
    try {
      const users = await this.core.users(izin.handlerUserIds);
      const teks = teksPengajuan(izin);
      for (const u of users) {
        if (u.aktif && u.noWa && u.noWa !== izin.pengajuNoWa)
          await this.wa.kirim(u.noWa, teks, izin.id);
      }
    } catch (e) {
      this.log.warn(`Gagal meneruskan ${nomorIzin(izin.nomor)}: ${String(e)}`);
    }
  }

  async putuskanNomor(
    nomor: number,
    status: 'APPROVED' | 'REJECTED',
    catatan: string | null,
    by: Pemutus,
  ) {
    const izin = await this.prisma.izin.findUnique({ where: { nomor } });
    if (!izin) throw notFound('Izin', nomorIzin(nomor));
    return this.putuskan(izin, status, catatan, by);
  }

  async putuskanWeb(user: AuthUser, id: string, status: 'APPROVED' | 'REJECTED', catatan?: string) {
    const izin = await this.prisma.izin.findUnique({ where: { id } });
    if (!izin) throw notFound('Izin', id);
    return this.putuskan(izin, status, catatan || null, {
      userId: user.id,
      nama: user.nama,
      role: user.role,
      via: 'WEB',
    });
  }

  /**
   * Lewat WA hanya penerima pengajuan (PJ izin / pengurus kelompok); lewat web juga admin &
   * pengurus yang mengelola kelompok anggota.
   */
  async bolehPutus(izin: Izin, userId: string, role: string, via: 'WA' | 'WEB'): Promise<boolean> {
    if (!ROLE_PUTUS.has(role)) return false;
    if (izin.handlerUserIds.includes(userId)) return true;
    if (via === 'WA') return false;
    const s = await this.scopes.forUserId(userId);
    return kelolaKelompok(s, izin.kelompokId);
  }

  private async putuskan(
    izin: Izin,
    status: 'APPROVED' | 'REJECTED',
    catatan: string | null,
    by: Pemutus,
  ) {
    if (!(await this.bolehPutus(izin, by.userId, by.role, by.via))) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'FORBIDDEN',
        'Anda tidak berwenang memutuskan izin ini',
      );
    }
    if (izin.status !== 'SUBMITTED') {
      throw conflict(
        'IZIN_SUDAH_DIPUTUSKAN',
        `${nomorIzin(izin.nomor)} sudah diputuskan (${izin.status === 'APPROVED' ? 'disetujui' : izin.status === 'REJECTED' ? 'ditolak' : 'dibatalkan'}).`,
      );
    }
    // Hanya satu keputusan yang menang bila dua PJ membalas bersamaan.
    const now = new Date();
    const res = await this.prisma.izin.updateMany({
      where: { id: izin.id, status: 'SUBMITTED' },
      data: {
        status,
        catatanPengurus: catatan,
        decidedBy: by.userId,
        decidedByNama: by.nama,
        decidedVia: by.via,
        decidedAt: now,
      },
    });
    if (res.count === 0)
      throw conflict('IZIN_SUDAH_DIPUTUSKAN', `${nomorIzin(izin.nomor)} sudah diputuskan.`);
    const baru = await this.prisma.izin.findUniqueOrThrow({ where: { id: izin.id } });
    await this.events.publish(EVENTS.IZIN_DECIDED, {
      izinId: baru.id,
      status,
      decidedBy: by.userId,
      decidedAt: now.toISOString(),
    });
    await this.wa.kirim(baru.pengajuNoWa, teksKeputusan(baru), baru.id);
    return baru;
  }

  // ---------- web

  private async filterScope(user: AuthUser): Promise<Prisma.IzinWhereInput> {
    const s = await this.scopes.forUser(user);
    if (s.all) return {};
    return {
      OR: [{ kelompokId: { in: [...s.manageKelompok] } }, { handlerUserIds: { has: user.id } }],
    };
  }

  async list(user: AuthUser, q: ListIzinQuery) {
    const where: Prisma.IzinWhereInput = {
      AND: [
        await this.filterScope(user),
        q.status ? { status: q.status } : {},
        q.acaraId ? { acaraId: q.acaraId } : {},
        q.q
          ? {
              OR: [
                { namaAnggota: { contains: q.q, mode: 'insensitive' } },
                { kodeAnggota: { contains: q.q, mode: 'insensitive' } },
                { acaraNama: { contains: q.q, mode: 'insensitive' } },
                ...(/^\d+$/.test(q.q.replace(/^iz-?/i, ''))
                  ? [{ nomor: Number(q.q.replace(/^iz-?/i, '')) }]
                  : []),
              ],
            }
          : {},
      ],
    };
    const [items, total] = await Promise.all([
      this.prisma.izin.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.izin.count({ where }),
    ]);
    const bisa = await Promise.all(items.map((i) => this.bolehPutus(i, user.id, user.role, 'WEB')));
    return {
      // Nomor WA pengaju & daftar penerima tidak perlu dikirim ke web.
      items: items.map(({ pengajuNoWa: _wa, handlerUserIds: _h, ...i }, n) => ({
        ...i,
        bisaPutus: bisa[n] && i.status === 'SUBMITTED',
      })),
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  }

  async jumlahMenunggu(user: AuthUser): Promise<{ menunggu: number }> {
    const menunggu = await this.prisma.izin.count({
      where: { AND: [await this.filterScope(user), { status: 'SUBMITTED' }] },
    });
    return { menunggu };
  }

  /** Riwayat izin anggota atau anak-anak wali (menu "Cek status izin"). */
  terakhir(anggotaIds: string[], take = 5) {
    return this.prisma.izin.findMany({
      where: { anggotaId: { in: anggotaIds } },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }
}
