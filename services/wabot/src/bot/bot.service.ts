import { HttpException, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { AcaraClient } from '../clients/acara.client.js';
import { CoreClient } from '../clients/core.client.js';
import { IzinService } from '../izin/izin.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { PesanMasuk } from '../wa/transport.js';
import { WaService } from '../wa/wa.service.js';
import { nomorIzin } from './format.js';
import { KeadaanStore } from './keadaan.store.js';
import { type Efek, type Kontak, type Peristiwa, transisi } from './mesin.js';
import { bacaPerintah } from './perintah.js';

const MAKS_LANGKAH = 5;

function pesanError(e: unknown): string {
  if (e instanceof HttpException) {
    const r = e.getResponse() as { message?: string };
    if (r.message) return r.message;
  }
  return 'Maaf, terjadi gangguan. Coba lagi beberapa saat lagi.';
}

/** Menjalankan percakapan bot: cari pemilik nomor, jalankan mesin, lakukan efeknya, balas. */
@Injectable()
export class BotService implements OnModuleInit {
  private readonly log = new Logger(BotService.name);
  /** Pesan dari nomor yang sama diproses berurutan. */
  private readonly kunci = new Map<string, Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly wa: WaService,
    private readonly store: KeadaanStore,
    private readonly izin: IzinService,
    private readonly acara: AcaraClient,
    private readonly core: CoreClient,
  ) {}

  onModuleInit(): void {
    this.wa.setHandler((p) => this.terima(p));
  }

  terima(p: PesanMasuk): Promise<void> {
    const sebelum = this.kunci.get(p.noWa) ?? Promise.resolve();
    const kerja = sebelum
      .then(() => this.proses(p))
      .catch((e: unknown) => {
        this.log.error(`Gagal memproses pesan dari ${p.noWa}: ${String(e)}`);
      });
    this.kunci.set(p.noWa, kerja);
    void kerja.finally(() => {
      if (this.kunci.get(p.noWa) === kerja) this.kunci.delete(p.noWa);
    });
    return kerja;
  }

  /** Nomor anggota sendiri dan/atau wali; anak = anggota yang boleh diajukan izinnya. */
  async kontak(noWa: string): Promise<Kontak | null> {
    const rows = await this.prisma.anggotaRef.findMany({
      where: { status: 'AKTIF', OR: [{ noWa }, { waliNoWa: { has: noWa } }] },
      orderBy: { nama: 'asc' },
    });
    if (rows.length === 0) return null;
    const diri = rows.filter((r) => r.noWa === noWa);
    const anak = rows.filter((r) => r.noWa !== noWa);
    return {
      tipe: anak.length ? 'WALI' : 'ANGGOTA',
      anak: [...diri, ...anak].map((r) => ({ id: r.id, kode: r.kode, nama: r.nama })),
    };
  }

  private async proses(p: PesanMasuk): Promise<void> {
    if (await this.perintahPengurus(p)) return;

    const kontak = await this.kontak(p.noWa);
    if (!kontak) {
      // Balas sekali per 10 menit agar tidak berbalas-balasan dengan nomor asing.
      const kunci = `bot:asing:${p.noWa}`;
      if (await this.store.ambil(kunci)) return;
      await this.store.simpan(kunci, '1');
      await this.wa.kirim(p.noWa, 'Nomor belum terdaftar, hubungi pengurus.');
      return;
    }

    let k = await this.store.keadaan(p.noWa);
    let ev: Peristiwa = { type: 'PESAN', teks: p.teks };
    const balas: string[] = [];
    for (let i = 0; i < MAKS_LANGKAH; i++) {
      const h = transisi(k, ev, { kontak, now: new Date() });
      k = h.keadaan;
      balas.push(...h.balas);
      const efek = h.efek[0];
      if (!efek) break;
      ev = await this.jalankan(efek, kontak, p.noWa);
    }
    await this.store.setKeadaan(p.noWa, k);
    for (const b of balas) await this.wa.kirim(p.noWa, b);
  }

  private async jalankan(e: Efek, kontak: Kontak, noWa: string): Promise<Peristiwa> {
    try {
      if (e.type === 'MUAT_SESI') {
        const daftar = await Promise.all(
          e.anggotaIds.map(async (id) =>
            (await this.acara.sesiMendatang(id)).map((s) => ({
              anggotaId: id,
              acaraId: s.acara.id,
              acaraNama: s.acara.nama,
              lokasi: s.acara.lokasi,
              sesiId: s.sesi.id,
              sesiNama: s.sesi.nama,
              mulai: s.sesi.mulai,
              batasIzin: s.sesi.batasIzin,
            })),
          ),
        );
        return { type: 'SESI', items: daftar.flat() };
      }
      if (e.type === 'MUAT_STATUS') {
        const rows = await this.izin.terakhir(kontak.anak.map((a) => a.id));
        return {
          type: 'STATUS',
          items: rows.map((r) => ({
            nomor: r.nomor,
            namaAnggota: r.namaAnggota,
            acaraNama: r.acaraNama,
            sesiNama: r.sesiNama,
            sesiMulai: r.sesiMulai.toISOString(),
            kategori: r.kategori,
            status: r.status,
            catatan: r.catatanPengurus,
          })),
        };
      }
      const izin = await this.izin.ajukan({
        anggotaId: e.anggotaId,
        sesiId: e.sesi.sesiId,
        kategori: e.kategori,
        alasan: e.alasan,
        pengajuNoWa: noWa,
        pengajuTipe: (await this.milikSendiri(noWa, e.anggotaId)) ? 'ANGGOTA' : 'WALI',
      });
      return { type: 'TERKIRIM', nomor: izin.nomor };
    } catch (err) {
      this.log.warn(`Efek ${e.type} gagal: ${String(err)}`);
      return { type: 'GAGAL', pesan: pesanError(err) };
    }
  }

  private async milikSendiri(noWa: string, anggotaId: string): Promise<boolean> {
    const a = await this.prisma.anggotaRef.findUnique({
      where: { id: anggotaId },
      select: { noWa: true },
    });
    return a?.noWa === noWa;
  }

  /** `SETUJU 0123` / `TOLAK 0123 <catatan>` dari nomor user core (PJ/pengurus). */
  private async perintahPengurus(p: PesanMasuk): Promise<boolean> {
    const cmd = bacaPerintah(p.teks);
    if (!cmd) return false;
    const user = await this.core.userByWa(p.noWa).catch(() => null);
    if (!user?.aktif) return false;
    try {
      const izin = await this.izin.putuskanNomor(cmd.nomor, cmd.aksi, cmd.catatan, {
        userId: user.id,
        nama: user.nama,
        role: user.role,
        via: 'WA',
      });
      await this.wa.kirim(
        p.noWa,
        `${nomorIzin(izin.nomor)} (${izin.namaAnggota}) ${izin.status === 'APPROVED' ? 'disetujui' : 'ditolak'}. Pengaju sudah dikabari.`,
        izin.id,
      );
    } catch (e) {
      await this.wa.kirim(p.noWa, pesanError(e));
    }
    return true;
  }
}
