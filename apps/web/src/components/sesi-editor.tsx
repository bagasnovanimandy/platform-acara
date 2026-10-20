'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, GripVertical, Pencil, Plus, Trash2, X } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { CariAnggota } from '@/components/cari-anggota';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  type AcaraDetail,
  type AnggotaRingkas,
  formatJam,
  formatRentang,
  fromWibInput,
  type RundownItem,
  type Sesi,
  toWibInput,
} from '@/lib/acara';
import { acaraApi, errorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

/** Semua mutasi sesi/rundown mengembalikan detail acara terbaru; simpan langsung ke cache. */
function useSaveAcara(acaraId: string) {
  const qc = useQueryClient();
  return async (path: string, method: string, body?: Record<string, unknown>) => {
    const detail = await acaraApi<AcaraDetail>(path, { method, body });
    qc.setQueryData(['acara', acaraId], detail);
    return detail;
  };
}

export function SesiEditor({ acara }: { acara: AcaraDetail }) {
  const editable = acara.bisaKelola;
  const save = useSaveAcara(acara.id);
  const [sesiForm, setSesiForm] = useState<Sesi | 'baru' | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {error && <Alert variant="destructive">{error}</Alert>}
      {acara.sesi.length === 0 && (
        <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          Belum ada sesi. Satu acara bisa punya beberapa sesi (mis. pagi dan siang), masing-masing
          dengan absensi dan rundown sendiri.
        </div>
      )}
      {acara.sesi.map((s) => (
        <SesiCard
          key={s.id}
          acaraId={acara.id}
          sesi={s}
          editable={editable}
          onEdit={() => setSesiForm(s)}
          onDelete={async () => {
            if (!confirm(`Hapus sesi "${s.nama}"?`)) return;
            setError(null);
            await save(`/sesi/${s.id}`, 'DELETE').catch((e) => setError(errorMessage(e)));
          }}
        />
      ))}
      {editable && (
        <Button variant="outline" className="self-start" onClick={() => setSesiForm('baru')}>
          <Plus /> Tambah sesi
        </Button>
      )}
      <SesiDialog
        acara={acara}
        value={sesiForm}
        onClose={() => setSesiForm(null)}
        onSave={async (body) => {
          if (sesiForm === 'baru') await save(`/acara/${acara.id}/sesi`, 'POST', body);
          else if (sesiForm) await save(`/sesi/${sesiForm.id}`, 'PATCH', body);
          setSesiForm(null);
        }}
      />
    </div>
  );
}

function SesiCard({
  acaraId,
  sesi,
  editable,
  onEdit,
  onDelete,
}: {
  acaraId: string;
  sesi: Sesi;
  editable: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const save = useSaveAcara(acaraId);
  const [items, setItems] = useState(sesi.rundown);
  const [dragId, setDragId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState<RundownItem | 'baru' | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setItems(sesi.rundown), [sesi.rundown]);

  async function simpanUrutan(next: RundownItem[]) {
    setItems(next);
    setError(null);
    try {
      await save(`/sesi/${sesi.id}/rundown/urutan`, 'PUT', { ids: next.map((i) => i.id) });
    } catch (e) {
      setError(errorMessage(e));
      setItems(sesi.rundown);
    }
  }
  const pindah = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x!);
    void simpanUrutan(next);
  };

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <CardTitle>{sesi.nama}</CardTitle>
          <CardDescription>
            {formatRentang(sesi.mulai, sesi.selesai)} · toleransi {sesi.toleransiMenit} menit
            {sesi.batasIzin && <> · batas izin {formatJam(sesi.batasIzin)}</>}
          </CardDescription>
        </div>
        {editable && (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Ubah sesi">
              <Pencil />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Hapus sesi">
              <Trash2 />
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {error && <Alert variant="destructive">{error}</Alert>}
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Rundown belum diisi.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {items.map((r, i) => (
              <li
                key={r.id}
                draggable={editable}
                onDragStart={() => setDragId(r.id)}
                onDragEnd={() => setDragId(null)}
                onDragOver={(e) => {
                  if (!dragId || dragId === r.id) return;
                  e.preventDefault();
                  const from = items.findIndex((x) => x.id === dragId);
                  const next = [...items];
                  const [x] = next.splice(from, 1);
                  next.splice(i, 0, x!);
                  setItems(next);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragId(null);
                  if (items.map((x) => x.id).join() !== sesi.rundown.map((x) => x.id).join())
                    void simpanUrutan(items);
                }}
                className={cn(
                  'flex items-start gap-3 rounded-lg border bg-background p-3 transition-shadow',
                  dragId === r.id && 'opacity-60 shadow-lg ring-2 ring-primary',
                )}
              >
                {editable && (
                  <GripVertical
                    className="mt-0.5 size-4 shrink-0 cursor-grab text-muted-foreground"
                    aria-hidden
                  />
                )}
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium tabular-nums">
                  {i + 1}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium">{r.judul}</span>
                    {r.mulai && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatJam(r.mulai)}
                        {r.selesai && `–${formatJam(r.selesai)}`}
                      </span>
                    )}
                  </div>
                  {r.keterangan && <p className="text-sm text-muted-foreground">{r.keterangan}</p>}
                  {r.pengisi.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {r.pengisi.map((p) => (
                        <span
                          key={p.id}
                          className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
                        >
                          {p.peran && <span className="text-muted-foreground">{p.peran}:</span>}
                          {p.anggota?.nama ?? p.namaBebas}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {editable && (
                  <div className="flex shrink-0 gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={i === 0}
                      onClick={() => pindah(i, i - 1)}
                      aria-label="Naikkan"
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={i === items.length - 1}
                      onClick={() => pindah(i, i + 1)}
                      aria-label="Turunkan"
                    >
                      <ArrowDown />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => setItemForm(r)}
                      aria-label="Ubah"
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label="Hapus"
                      onClick={async () => {
                        if (!confirm(`Hapus "${r.judul}" dari rundown?`)) return;
                        await save(`/rundown/${r.id}`, 'DELETE').catch((e) =>
                          setError(errorMessage(e)),
                        );
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
        {editable && (
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => setItemForm('baru')}
          >
            <Plus /> Tambah item rundown
          </Button>
        )}
      </CardContent>
      <RundownDialog
        sesi={sesi}
        value={itemForm}
        onClose={() => setItemForm(null)}
        onSave={async (body) => {
          if (itemForm === 'baru') await save(`/sesi/${sesi.id}/rundown`, 'POST', body);
          else if (itemForm) await save(`/rundown/${itemForm.id}`, 'PATCH', body);
          setItemForm(null);
        }}
      />
    </Card>
  );
}

function SesiDialog({
  acara,
  value,
  onClose,
  onSave,
}: {
  acara: AcaraDetail;
  value: Sesi | 'baru' | null;
  onClose: () => void;
  onSave: (body: Record<string, unknown>) => Promise<void>;
}) {
  const current = value === 'baru' ? null : value;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const s = (k: string) => String(f.get(k) ?? '');
    setBusy(true);
    setError(null);
    try {
      await onSave({
        nama: s('nama').trim(),
        mulai: fromWibInput(s('mulai')),
        selesai: fromWibInput(s('selesai')),
        toleransiMenit: Number(s('toleransiMenit')),
        batasIzin: s('batasIzin') ? fromWibInput(s('batasIzin')) : null,
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={value !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{current ? `Ubah ${current.nama}` : 'Tambah sesi'}</DialogTitle>
        </DialogHeader>
        <form key={current?.id ?? 'baru'} onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="sesi-nama">Nama sesi</Label>
            <Input
              id="sesi-nama"
              name="nama"
              required
              maxLength={100}
              defaultValue={
                current?.nama ?? (acara.sesi.length ? `Sesi ${acara.sesi.length + 1}` : 'Sesi 1')
              }
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="sesi-mulai">Mulai (WIB)</Label>
            <Input
              id="sesi-mulai"
              name="mulai"
              type="datetime-local"
              required
              defaultValue={toWibInput(current?.mulai ?? acara.tanggalMulai)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="sesi-selesai">Selesai (WIB)</Label>
            <Input
              id="sesi-selesai"
              name="selesai"
              type="datetime-local"
              required
              defaultValue={toWibInput(current?.selesai ?? acara.tanggalSelesai)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="sesi-tol">Toleransi telat (menit)</Label>
            <Input
              id="sesi-tol"
              name="toleransiMenit"
              type="number"
              min={0}
              max={240}
              required
              defaultValue={current?.toleransiMenit ?? 15}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="sesi-izin">Batas izin (WIB)</Label>
            <Input
              id="sesi-izin"
              name="batasIzin"
              type="datetime-local"
              defaultValue={toWibInput(current?.batasIzin)}
            />
            <span className="text-xs text-muted-foreground">Kosong = sama dengan waktu mulai.</span>
          </div>
          {error && (
            <Alert variant="destructive" className="sm:col-span-2">
              {error}
            </Alert>
          )}
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface PengisiDraft {
  anggota: AnggotaRingkas | null;
  namaBebas: string;
  peran: string;
}

function RundownDialog({
  sesi,
  value,
  onClose,
  onSave,
}: {
  sesi: Sesi;
  value: RundownItem | 'baru' | null;
  onClose: () => void;
  onSave: (body: Record<string, unknown>) => Promise<void>;
}) {
  const current = value === 'baru' ? null : value;
  const [pengisi, setPengisi] = useState<PengisiDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setError(null);
    setPengisi(
      current?.pengisi.map((p) => ({
        anggota: p.anggota,
        namaBebas: p.namaBebas ?? '',
        peran: p.peran ?? '',
      })) ?? [],
    );
  }, [current, value]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const s = (k: string) => String(f.get(k) ?? '');
    setBusy(true);
    setError(null);
    try {
      await onSave({
        judul: s('judul').trim(),
        keterangan: s('keterangan').trim() || null,
        mulai: s('mulai') ? fromWibInput(s('mulai')) : null,
        selesai: s('selesai') ? fromWibInput(s('selesai')) : null,
        pengisi: pengisi
          .filter((p) => p.anggota || p.namaBebas.trim())
          .map((p) => ({
            anggotaId: p.anggota?.id ?? null,
            namaBebas: p.anggota ? null : p.namaBebas.trim(),
            peran: p.peran.trim() || null,
          })),
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const tanggalSesi = toWibInput(sesi.mulai).slice(0, 11);
  return (
    <Dialog open={value !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{current ? 'Ubah item rundown' : 'Tambah item rundown'}</DialogTitle>
        </DialogHeader>
        <form key={current?.id ?? 'baru'} onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="rd-judul">Judul</Label>
            <Input
              id="rd-judul"
              name="judul"
              required
              maxLength={150}
              placeholder="mis. Pembukaan, Tilawah, Materi"
              defaultValue={current?.judul}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="rd-mulai">Jam mulai</Label>
            <Input
              id="rd-mulai"
              name="mulai"
              type="datetime-local"
              defaultValue={toWibInput(current?.mulai) || undefined}
              placeholder={tanggalSesi}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="rd-selesai">Jam selesai</Label>
            <Input
              id="rd-selesai"
              name="selesai"
              type="datetime-local"
              defaultValue={toWibInput(current?.selesai) || undefined}
            />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="rd-ket">Keterangan</Label>
            <Input
              id="rd-ket"
              name="keterangan"
              maxLength={1000}
              defaultValue={current?.keterangan ?? ''}
            />
          </div>
          <fieldset className="flex flex-col gap-2 sm:col-span-2">
            <legend className="mb-2 text-sm font-medium">Pengisi</legend>
            {pengisi.map((p, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
                <Input
                  aria-label="Peran"
                  placeholder="Peran (MC, pemateri…)"
                  className="w-40"
                  value={p.peran}
                  onChange={(e) =>
                    setPengisi(
                      pengisi.map((x, j) => (j === i ? { ...x, peran: e.target.value } : x)),
                    )
                  }
                />
                {p.anggota ? (
                  <span className="inline-flex flex-1 items-center gap-2 text-sm">
                    {p.anggota.nama}
                    <span className="text-xs text-muted-foreground">{p.anggota.namaKelompok}</span>
                  </span>
                ) : (
                  <Input
                    aria-label="Nama pengisi"
                    placeholder="Nama (bukan anggota)"
                    className="flex-1"
                    value={p.namaBebas}
                    onChange={(e) =>
                      setPengisi(
                        pengisi.map((x, j) => (j === i ? { ...x, namaBebas: e.target.value } : x)),
                      )
                    }
                  />
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => setPengisi(pengisi.filter((_, j) => j !== i))}
                  aria-label="Hapus pengisi"
                >
                  <X />
                </Button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <CariAnggota
                onPick={(a) => setPengisi([...pengisi, { anggota: a, namaBebas: '', peran: '' }])}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setPengisi([...pengisi, { anggota: null, namaBebas: '', peran: '' }])
                }
              >
                <Plus /> Nama bebas
              </Button>
            </div>
          </fieldset>
          {error && (
            <Alert variant="destructive" className="sm:col-span-2">
              {error}
            </Alert>
          )}
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
