import { Logger } from '@nestjs/common';
import { normalizeWa } from '@platform-acara/shared';
import { rm } from 'node:fs/promises';
import type { KeadaanWa, PesanMasuk, StatusWa, WaTransport } from './transport.js';

// Baileys hanya ESM: dimuat dengan import() dinamis dari service CommonJS ini.
type Baileys = typeof import('@whiskeysockets/baileys', { with: { 'resolution-mode': 'import' } });
type Socket = ReturnType<Baileys['makeWASocket']>;
type Logr = Parameters<Baileys['makeWASocket']>[0]['logger'];

const JEDA_SAMBUNG_ULANG_MS = 5000;

/** Logger untuk Baileys: hanya peringatan & error, lewat logger Nest. */
function loggerBaileys(log: Logger): NonNullable<Logr> {
  const teks = (obj: unknown, msg?: string) =>
    msg ?? (typeof obj === 'string' ? obj : JSON.stringify(obj));
  const l: NonNullable<Logr> = {
    level: 'warn',
    child: () => l,
    trace: () => {},
    debug: () => {},
    info: () => {},
    warn: (obj, msg) => log.warn(teks(obj, msg)),
    error: (obj, msg) => log.error(teks(obj, msg)),
  };
  return l;
}

/** Nomor 62… dari JID pribadi (`62…@s.whatsapp.net`); JID LID memakai alamat alternatif. */
export function nomorDariJid(jid: string | null | undefined, alt?: string | null): string | null {
  for (const j of [jid, alt]) {
    if (j?.endsWith('@s.whatsapp.net')) return normalizeWa(j.split('@')[0]!.split(':')[0]);
  }
  return null;
}

export class BaileysTransport implements WaTransport {
  private readonly log = new Logger('WhatsApp');
  private b?: Baileys;
  private sock?: Socket;
  private onPesan?: (p: PesanMasuk) => Promise<void>;
  private keadaan: KeadaanWa = 'MENYAMBUNG';
  private qr: string | null = null;
  private nomor: string | null = null;
  private sejak = new Date();
  private pesan: string | null = null;
  private berhentiDiminta = false;

  constructor(private readonly authDir: string) {}

  async mulai(onPesan: (p: PesanMasuk) => Promise<void>): Promise<void> {
    this.onPesan = onPesan;
    this.b = await import('@whiskeysockets/baileys');
    await this.sambung();
  }

  private ubah(k: KeadaanWa, pesan: string | null = null): void {
    if (k !== this.keadaan) this.sejak = new Date();
    this.keadaan = k;
    this.pesan = pesan;
  }

  private async sambung(): Promise<void> {
    const b = this.b!;
    const { state, saveCreds } = await b.useMultiFileAuthState(this.authDir);
    const sock = b.makeWASocket({
      auth: state,
      logger: loggerBaileys(this.log),
      browser: b.Browsers.ubuntu('Platform Acara'),
      markOnlineOnConnect: false,
      syncFullHistory: false,
    });
    this.sock = sock;
    this.ubah('MENYAMBUNG');
    sock.ev.on('creds.update', () => void saveCreds());
    sock.ev.on('connection.update', (u) => {
      if (u.qr) {
        this.qr = u.qr;
        this.ubah('MENUNGGU_QR');
      }
      if (u.connection === 'open') {
        this.qr = null;
        this.nomor = nomorDariJid(sock.user?.id);
        this.ubah('TERHUBUNG');
        this.log.log(`Terhubung sebagai ${this.nomor ?? sock.user?.id ?? '?'}`);
      }
      if (u.connection === 'close') {
        const err = u.lastDisconnect?.error as { output?: { statusCode?: number } } | undefined;
        const kode = err?.output?.statusCode;
        if (this.berhentiDiminta || this.sock !== sock) return;
        if (kode === b.DisconnectReason.loggedOut) {
          this.ubah('TERPUTUS', 'Nomor bot keluar dari perangkat tertaut. Tautkan ulang.');
          this.log.warn('Sesi WhatsApp keluar (logged out); perlu tautkan ulang');
          return;
        }
        this.ubah('MENYAMBUNG', `Koneksi terputus (${kode ?? 'tanpa kode'}), menyambung ulang`);
        setTimeout(
          () => void this.sambung().catch((e: unknown) => this.gagal(e)),
          JEDA_SAMBUNG_ULANG_MS,
        );
      }
    });
    sock.ev.on('messages.upsert', ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const m of messages) {
        if (m.key.fromMe) continue;
        const noWa = nomorDariJid(m.key.remoteJid, m.key.remoteJidAlt);
        const teks = m.message?.conversation ?? m.message?.extendedTextMessage?.text ?? null;
        if (!noWa || !teks) continue;
        void this.onPesan?.({ noWa, teks }).catch((e: unknown) =>
          this.log.error(`Gagal memproses pesan: ${String(e)}`),
        );
      }
    });
  }

  private gagal(e: unknown): void {
    this.ubah('TERPUTUS', `Gagal menyambung: ${e instanceof Error ? e.message : String(e)}`);
    this.log.error(this.pesan);
  }

  async kirim(noWa: string, teks: string): Promise<void> {
    if (!this.sock || this.keadaan !== 'TERHUBUNG') throw new Error('WhatsApp belum terhubung');
    await this.sock.sendMessage(`${noWa}@s.whatsapp.net`, { text: teks });
  }

  status(): StatusWa {
    return {
      driver: 'baileys',
      keadaan: this.keadaan,
      qr: this.keadaan === 'MENUNGGU_QR' ? this.qr : null,
      nomor: this.nomor,
      sejak: this.sejak.toISOString(),
      pesan: this.pesan,
    };
  }

  async tautkanUlang(): Promise<void> {
    const lama = this.sock;
    this.sock = undefined;
    try {
      await lama?.logout();
    } catch {
      lama?.end(undefined);
    }
    // Kredensial lama tidak berlaku lagi: hapus agar Baileys meminta QR baru.
    await rm(this.authDir, { recursive: true, force: true });
    this.nomor = null;
    await this.sambung();
  }

  async berhenti(): Promise<void> {
    this.berhentiDiminta = true;
    this.sock?.end(undefined);
  }
}
