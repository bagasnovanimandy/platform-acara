/** Lapisan koneksi WhatsApp. Bot tidak tahu apakah di baliknya Baileys atau driver uji. */

export interface PesanMasuk {
  /** Nomor pengirim, format 62… */
  noWa: string;
  teks: string;
}

export type KeadaanWa = 'TERHUBUNG' | 'MENUNGGU_QR' | 'MENYAMBUNG' | 'TERPUTUS';

export interface StatusWa {
  driver: 'baileys' | 'fake';
  keadaan: KeadaanWa;
  /** Data QR untuk dipindai dari WhatsApp > Perangkat tertaut (hanya saat MENUNGGU_QR). */
  qr: string | null;
  /** Nomor bot setelah terhubung. */
  nomor: string | null;
  sejak: string;
  pesan: string | null;
}

export interface WaTransport {
  mulai(onPesan: (p: PesanMasuk) => Promise<void>): Promise<void>;
  kirim(noWa: string, teks: string): Promise<void>;
  status(): StatusWa;
  /** Putuskan sesi lama (bila ada) dan minta QR baru untuk menautkan nomor bot. */
  tautkanUlang(): Promise<void>;
  berhenti(): Promise<void>;
}

/** Driver tanpa WhatsApp: pesan masuk lewat POST /wa/simulasi, pesan keluar cukup dicatat. */
export class FakeTransport implements WaTransport {
  private readonly sejak = new Date().toISOString();

  async mulai(): Promise<void> {}

  async kirim(): Promise<void> {}

  status(): StatusWa {
    return {
      driver: 'fake',
      keadaan: 'TERHUBUNG',
      qr: null,
      nomor: null,
      sejak: this.sejak,
      pesan: 'Mode uji: tidak terhubung ke WhatsApp sungguhan.',
    };
  }

  async tautkanUlang(): Promise<void> {}

  async berhenti(): Promise<void> {}
}
