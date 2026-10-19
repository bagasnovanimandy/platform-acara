/** Pencarian nama/kode offline yang toleran salah ketik ringan. */

export function normal(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Jarak edit (Levenshtein) dibatasi; berhenti lebih awal bila > max. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(
        prev[j]! + 1,
        cur[j - 1]! + 1,
        prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      cur.push(v);
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length]!;
}

/** Skor satu token kueri terhadap kata-kata nama (makin besar makin cocok, 0 = tidak cocok). */
function skorToken(q: string, words: string[]): number {
  let best = 0;
  for (const w of words) {
    if (w === q) best = Math.max(best, 3);
    else if (w.startsWith(q)) best = Math.max(best, 2);
    else if (q.length >= 3 && w.includes(q)) best = Math.max(best, 1);
    else if (q.length >= 4) {
      // Salah ketik ringan: 1 huruf (kata pendek) atau 2 (kata ≥ 6 huruf, mis. huruf tertukar).
      const max = q.length >= 6 ? 2 : 1;
      if (Math.min(editDistance(q, w, max), editDistance(q, w.slice(0, q.length), max)) <= max)
        best = Math.max(best, 1);
    }
  }
  return best;
}

export function cariPeserta<T extends { nama: string; kode: string }>(
  list: T[],
  query: string,
  limit = 20,
): T[] {
  const q = normal(query);
  if (!q) return [];
  const tokens = q.split(' ');
  const kodeQ = q.replace(/ /g, '');
  const scored: { item: T; skor: number }[] = [];
  for (const item of list) {
    const kode = normal(item.kode).replace(/ /g, '');
    let skor = 0;
    if (kode === kodeQ) skor = 100;
    else if (kodeQ.length >= 2 && kode.startsWith(kodeQ)) skor = 50;
    else {
      const words = normal(item.nama).split(' ');
      let total = 0;
      for (const t of tokens) {
        const s = skorToken(t, words);
        if (s === 0) {
          total = 0;
          break;
        }
        total += s;
      }
      skor = total;
    }
    if (skor > 0) scored.push({ item, skor });
  }
  return scored
    .sort((a, b) => b.skor - a.skor || a.item.nama.localeCompare(b.item.nama))
    .slice(0, limit)
    .map((s) => s.item);
}
