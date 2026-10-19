/**
 * Normalisasi nomor WhatsApp Indonesia ke format `62…` (hanya digit).
 * Menerima `08…`, `8…`, `62…`, `+62…`, dengan spasi, titik, tanda hubung, atau kurung.
 * Mengembalikan `null` bila bukan nomor yang valid.
 */
export function normalizeWa(input: string | null | undefined): string | null {
  if (input == null) return null;
  const trimmed = input.trim();
  if (trimmed === '') return null;
  if (!/^\+?[\d\s.\-()]+$/.test(trimmed)) return null;

  let digits = trimmed.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith('8')) digits = `62${digits}`;

  // Nomor seluler Indonesia: 62 + 8xx + 7–10 digit → total 10–13 digit setelah 62.
  if (!/^628\d{8,11}$/.test(digits)) return null;
  return digits;
}
