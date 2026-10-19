'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, errorMessage } from '@/lib/api';
import { canEdit, useAuth } from '@/lib/auth';
import { useWilayahTree } from '@/lib/queries';

type Level = 'daerah' | 'desa' | 'kelompok';
const LABEL: Record<Level, string> = { daerah: 'Daerah', desa: 'Desa', kelompok: 'Kelompok' };

interface Editing {
  level: Level;
  /** ada = ubah, kosong = tambah */
  id?: string;
  parentId?: string;
  kode?: string;
  nama?: string;
  alamat?: string | null;
}

function WilayahDialog({ editing, onClose }: { editing: Editing | null; onClose: () => void }) {
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => {
      const e = editing!;
      return e.id
        ? api(`/wilayah/${e.level}/${e.id}`, { method: 'PATCH', body })
        : api(`/wilayah/${e.level}`, { method: 'POST', body });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['wilayah'] });
      onClose();
    },
  });

  function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    const body: Record<string, unknown> = { kode: f.get('kode'), nama: f.get('nama') };
    if (editing?.level === 'kelompok') body.alamat = f.get('alamat') || null;
    if (!editing?.id && editing?.level === 'desa') body.daerahId = editing.parentId;
    if (!editing?.id && editing?.level === 'kelompok') body.desaId = editing.parentId;
    save.mutate(body);
  }

  return (
    <Dialog
      open={editing !== null}
      onOpenChange={(o) => {
        if (!o) {
          save.reset();
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing?.id ? 'Ubah' : 'Tambah'} {editing ? LABEL[editing.level].toLowerCase() : ''}
          </DialogTitle>
        </DialogHeader>
        <form
          key={`${editing?.level}-${editing?.id ?? editing?.parentId}`}
          onSubmit={onSubmit}
          className="grid gap-4"
        >
          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="kode">Kode</Label>
              <Input
                id="kode"
                name="kode"
                required
                defaultValue={editing?.kode}
                className="uppercase"
              />
            </div>
            <div className="col-span-2 grid gap-2">
              <Label htmlFor="nama">Nama</Label>
              <Input id="nama" name="nama" required defaultValue={editing?.nama} />
            </div>
          </div>
          {editing?.level === 'desa' && (
            <p className="text-sm text-muted-foreground">
              Kode desa dipakai sebagai awalan kode anggota, mis. JS-0001.
            </p>
          )}
          {editing?.level === 'kelompok' && (
            <div className="grid gap-2">
              <Label htmlFor="alamat">Alamat tempat ngaji</Label>
              <Input id="alamat" name="alamat" defaultValue={editing.alamat ?? ''} />
            </div>
          )}
          {save.error && <Alert variant="destructive">{errorMessage(save.error)}</Alert>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" disabled={save.isPending}>
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function WilayahPage() {
  const user = useAuth((s) => s.user);
  const editable = canEdit(user);
  const tree = useWilayahTree();
  const [editing, setEditing] = useState<Editing | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Wilayah</h1>
        {user?.role === 'SUPER_ADMIN' && (
          <Button className="ml-auto" onClick={() => setEditing({ level: 'daerah' })}>
            Tambah daerah
          </Button>
        )}
      </div>
      {tree.error && <Alert variant="destructive">{errorMessage(tree.error)}</Alert>}
      {tree.data?.length === 0 && <p className="text-muted-foreground">Belum ada wilayah.</p>}

      {tree.data?.map((d) => (
        <Card key={d.id}>
          <CardHeader className="flex flex-row flex-wrap items-center gap-3">
            <CardTitle className="text-lg">
              {d.nama} <span className="font-mono text-xs text-muted-foreground">{d.kode}</span>
            </CardTitle>
            {editable && d.bisaKelola && (
              <div className="ml-auto flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing({ level: 'daerah', ...d })}
                >
                  Ubah
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing({ level: 'desa', parentId: d.id })}
                >
                  Tambah desa
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {d.desa.map((s) => (
              <div key={s.id} className="rounded-lg border p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="font-medium">
                    Desa {s.nama}{' '}
                    <span className="font-mono text-xs text-muted-foreground">{s.kode}</span>
                  </span>
                  {editable && s.bisaKelola && (
                    <div className="ml-auto flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditing({ level: 'desa', ...s })}
                      >
                        Ubah
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditing({ level: 'kelompok', parentId: s.id })}
                      >
                        Tambah kelompok
                      </Button>
                    </div>
                  )}
                </div>
                <ul className="flex flex-col divide-y text-sm">
                  {s.kelompok.map((k) => (
                    <li key={k.id} className="flex items-center gap-2 py-1.5">
                      <span>{k.nama}</span>
                      <span className="font-mono text-xs text-muted-foreground">{k.kode}</span>
                      {editable && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-auto"
                          onClick={() => setEditing({ level: 'kelompok', ...k })}
                        >
                          Ubah
                        </Button>
                      )}
                    </li>
                  ))}
                  {s.kelompok.length === 0 && (
                    <li className="py-1.5 text-muted-foreground">Belum ada kelompok</li>
                  )}
                </ul>
              </div>
            ))}
            {d.desa.length === 0 && <p className="text-sm text-muted-foreground">Belum ada desa</p>}
          </CardContent>
        </Card>
      ))}

      <WilayahDialog editing={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
