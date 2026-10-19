'use client';

import { Printer } from 'lucide-react';
import { use } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { formatJam, formatRentang, PERAN_PJ_LABEL, useAcara } from '@/lib/acara';
import { errorMessage } from '@/lib/api';

/** Rundown siap cetak (A4). Header admin disembunyikan saat print. */
export default function CetakRundownPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const acara = useAcara(id);
  if (acara.error) return <Alert variant="destructive">{errorMessage(acara.error)}</Alert>;
  const a = acara.data;
  if (!a) return <p className="text-muted-foreground">Memuat…</p>;

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6 bg-white text-black print:max-w-none">
      <div className="flex justify-end print:hidden">
        <Button onClick={() => window.print()}>
          <Printer /> Cetak
        </Button>
      </div>
      <header className="border-b-2 border-black pb-3 text-center">
        <h1 className="text-xl font-bold uppercase">{a.nama}</h1>
        <p className="text-sm">{formatRentang(a.tanggalMulai, a.tanggalSelesai)}</p>
        {a.lokasi && <p className="text-sm">{a.lokasi}</p>}
        <p className="text-xs">Penyelenggara: {a.penyelenggaraNama}</p>
      </header>

      {a.sesi.map((s) => (
        <section key={s.id} className="break-inside-avoid">
          <h2 className="mb-2 font-semibold">
            {s.nama}{' '}
            <span className="font-normal">
              ({formatJam(s.mulai)}–{formatJam(s.selesai)} WIB)
            </span>
          </h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-neutral-100">
                <th className="w-10 border border-black px-2 py-1">No</th>
                <th className="w-28 border border-black px-2 py-1">Waktu</th>
                <th className="border border-black px-2 py-1 text-left">Acara</th>
                <th className="w-56 border border-black px-2 py-1 text-left">Pengisi</th>
              </tr>
            </thead>
            <tbody>
              {s.rundown.length === 0 && (
                <tr>
                  <td colSpan={4} className="border border-black px-2 py-2 text-center italic">
                    Rundown belum diisi
                  </td>
                </tr>
              )}
              {s.rundown.map((r, i) => (
                <tr key={r.id} className="align-top">
                  <td className="border border-black px-2 py-1 text-center">{i + 1}</td>
                  <td className="border border-black px-2 py-1 text-center tabular-nums">
                    {r.mulai ? formatJam(r.mulai) : ''}
                    {r.selesai ? `–${formatJam(r.selesai)}` : ''}
                  </td>
                  <td className="border border-black px-2 py-1">
                    <div className="font-medium">{r.judul}</div>
                    {r.keterangan && <div className="text-xs">{r.keterangan}</div>}
                  </td>
                  <td className="border border-black px-2 py-1">
                    {r.pengisi.map((p) => (
                      <div key={p.id}>
                        {p.peran && `${p.peran}: `}
                        {p.anggota?.nama ?? p.namaBebas}
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      {a.pj.length > 0 && (
        <section className="break-inside-avoid">
          <h2 className="mb-2 font-semibold">Penanggung jawab</h2>
          <ul className="grid grid-cols-2 gap-x-6 text-sm">
            {a.pj.map((p) => (
              <li key={p.id}>
                {PERAN_PJ_LABEL[p.peran]}: <span className="font-medium">{p.nama}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
