'use client';

import { CheckCircle2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cariPeserta } from '@/lib/op/cari';
import type { PesertaPaket } from '@/lib/op/types';
import { cn } from '@/lib/utils';

function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/60" role="dialog" aria-label={title}>
      <button type="button" aria-label="Tutup" className="h-16 shrink-0" onClick={onClose} />
      <div className="flex min-h-0 flex-1 flex-col rounded-t-3xl bg-neutral-900 text-white">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="flex size-12 items-center justify-center rounded-full bg-white/10"
          >
            <X className="size-6" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inputCls =
  'h-14 w-full rounded-2xl bg-white/10 px-4 text-lg text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-white/60';

export function CariSheet({
  peserta,
  sudahHadir,
  onClose,
  onPilih,
}: {
  peserta: PesertaPaket[];
  sudahHadir: Set<string>;
  onClose: () => void;
  onPilih: (p: PesertaPaket) => void;
}) {
  const [q, setQ] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const hasil = useMemo(() => cariPeserta(peserta, q, 30), [peserta, q]);
  return (
    <Sheet title="Cari Nama" onClose={onClose}>
      <div className="px-5 pb-3">
        <input
          ref={ref}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ketik nama atau kode"
          aria-label="Cari nama atau kode"
          className={inputCls}
          autoComplete="off"
        />
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">
        {q.trim() === '' && (
          <li className="px-2 py-6 text-center text-white/60">
            {peserta.length.toLocaleString('id-ID')} peserta di sesi ini.
          </li>
        )}
        {q.trim() !== '' && hasil.length === 0 && (
          <li className="px-2 py-6 text-center text-white/60">Tidak ditemukan.</li>
        )}
        {hasil.map((p) => {
          const hadir = sudahHadir.has(p.id);
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onPilih(p)}
                className={cn(
                  'flex min-h-16 w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-white/10',
                  hadir && 'opacity-70',
                )}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-lg font-medium">{p.nama}</span>
                  <span className="text-sm text-white/60">
                    {p.kode} · {p.kelompok}
                  </span>
                </span>
                {hadir && (
                  <span className="flex items-center gap-1 rounded-full bg-sky-500/20 px-3 py-1 text-sm text-sky-300">
                    <CheckCircle2 className="size-4" aria-hidden /> Sudah hadir
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}

export function TamuSheet({
  onClose,
  onSimpan,
}: {
  onClose: () => void;
  onSimpan: (nama: string, keterangan: string | null) => void;
}) {
  const [nama, setNama] = useState('');
  const [ket, setKet] = useState('');
  const ok = nama.trim().length >= 2;
  return (
    <Sheet title="Catat Tamu" onClose={onClose}>
      <form
        className="flex flex-col gap-3 px-5 pb-8"
        onSubmit={(e) => {
          e.preventDefault();
          if (ok) onSimpan(nama.trim(), ket.trim() || null);
        }}
      >
        <input
          autoFocus
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          placeholder="Nama tamu"
          aria-label="Nama tamu"
          maxLength={120}
          className={inputCls}
        />
        <input
          value={ket}
          onChange={(e) => setKet(e.target.value)}
          placeholder="Keterangan (asal, keperluan), boleh kosong"
          aria-label="Keterangan"
          maxLength={200}
          className={inputCls}
        />
        <button
          type="submit"
          disabled={!ok}
          className="mt-2 h-16 rounded-2xl bg-violet-500 text-lg font-semibold disabled:opacity-40"
        >
          Simpan Tamu
        </button>
      </form>
    </Sheet>
  );
}
