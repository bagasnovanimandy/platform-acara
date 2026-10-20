/** Balasan pengurus lewat WA: `SETUJU 0123` atau `TOLAK 0123 <catatan>`. Murni. */

export interface Perintah {
  aksi: 'APPROVED' | 'REJECTED';
  nomor: number;
  catatan: string | null;
}

const POLA = /^\s*(setuju|terima|tolak)\s+(?:iz-?)?#?(\d{1,7})\b\s*([\s\S]*)$/i;

export function bacaPerintah(teks: string): Perintah | null {
  const m = POLA.exec(teks);
  if (!m) return null;
  const kata = m[1]!.toLowerCase();
  const catatan = m[3]!.trim().slice(0, 300);
  return {
    aksi: kata === 'tolak' ? 'REJECTED' : 'APPROVED',
    nomor: Number(m[2]),
    catatan: catatan || null,
  };
}
