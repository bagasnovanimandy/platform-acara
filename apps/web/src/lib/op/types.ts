export interface OpSession {
  token: string;
  expiresAt: string;
  operator: { id: string; label: string };
  sesi: { id: string; nama: string; acara: string };
}

export interface PesertaPaket {
  id: string;
  kode: string;
  nama: string;
  kelompok: string;
}

export interface WajahPaket {
  id: string;
  anggotaId: string;
  status: 'VERIFIED' | 'PENDING';
  descriptors: number[][];
}

export interface Paket {
  dibuatAt: string;
  operator: { id: string; label: string };
  sesi: {
    id: string;
    nama: string;
    mulai: string;
    selesai: string;
    toleransiMenit: number;
    acara: { id: string; nama: string; lokasi: string | null };
  };
  threshold: number;
  peserta: PesertaPaket[];
  wajah: WajahPaket[];
  sudahHadir: string[];
}

export type AntreanItem =
  | {
      clientId: string;
      metode: 'WAJAH';
      anggotaId: string;
      faceDataId: string | null;
      faceDistance: number | null;
      capturedAt: string;
    }
  | { clientId: string; metode: 'MANUAL'; anggotaId: string; capturedAt: string }
  | {
      clientId: string;
      metode: 'TAMU';
      nama: string;
      keterangan: string | null;
      capturedAt: string;
    };

export interface HasilBatch {
  hasil: {
    clientId: string;
    status: 'BARU' | 'LEBIH_AWAL' | 'DUPLIKAT' | 'SUDAH_DITERIMA' | 'DITOLAK';
    alasan?: string;
  }[];
}

/** Wajah yang didaftarkan di perangkat ini (antrean kirim + dipakai pencocokan sampai paket berikutnya). */
export interface WajahLokal {
  clientId: string;
  sesiId: string;
  anggotaId: string;
  descriptors: number[][];
  /** Data URL WebP 160 px, dikosongkan setelah terkirim. */
  thumbnails: string[];
  capturedAt: string;
  /** Id FaceData di server setelah terkirim. */
  serverId: string | null;
  terkirimAt: string | null;
}

export interface HasilEnroll {
  id: string;
  anggotaId: string;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  baru: boolean;
}
