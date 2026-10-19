'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { EMPTY_WILAYAH, WilayahSelect, type WilayahValue } from '@/components/wilayah-select';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api, errorMessage, type Role } from '@/lib/api';
import { ROLE_LABEL, useAuth } from '@/lib/auth';
import { formatWaktu, useWilayahTree, wilayahNames } from '@/lib/queries';
import type { ScopeLevel, UserRow } from '@/lib/types';

const ROLE_HELP: Record<Role, string> = {
  SUPER_ADMIN: 'Semua wilayah dan pengaturan.',
  ADMIN: 'Mengelola data dan pengguna di wilayahnya.',
  PENGURUS: 'Melihat data dan memutuskan izin.',
  AUDITOR: 'Hanya melihat data dan riwayat perubahan, tidak bisa mengubah.',
};

const LEVEL_LABEL: Record<ScopeLevel, string> = {
  DAERAH: 'Daerah',
  DESA: 'Desa',
  KELOMPOK: 'Kelompok',
};

export default function PenggunaPage() {
  const me = useAuth((s) => s.user);
  const tree = useWilayahTree();
  const names = wilayahNames(tree.data ?? []);
  const [editing, setEditing] = useState<UserRow | 'baru' | null>(null);
  const users = useQuery({ queryKey: ['users'], queryFn: () => api<UserRow[]>('/users') });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Pengguna</h1>
          <p className="text-sm text-muted-foreground">
            {me?.role === 'SUPER_ADMIN'
              ? 'Semua admin, pengurus, dan auditor.'
              : 'Admin, pengurus, dan auditor di wilayah Anda. Anda hanya bisa memberi wilayah di bawah wilayah Anda.'}
          </p>
        </div>
        <Button className="ml-auto" onClick={() => setEditing('baru')}>
          Tambah pengguna
        </Button>
      </div>
      {users.error && <Alert variant="destructive">{errorMessage(users.error)}</Alert>}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Peran</TableHead>
              <TableHead>Wilayah</TableHead>
              <TableHead>Login terakhir</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.data?.map((u) => (
              <TableRow key={u.id} className={u.aktif ? undefined : 'opacity-60'}>
                <TableCell>
                  <div className="font-medium">{u.nama}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={u.role === 'AUDITOR' ? 'outline' : 'secondary'}>
                    {ROLE_LABEL[u.role]}
                  </Badge>
                  {!u.aktif && <span className="ml-2 text-xs text-muted-foreground">nonaktif</span>}
                </TableCell>
                <TableCell className="text-sm">
                  {u.scopes.length === 0
                    ? 'Semua'
                    : u.scopes
                        .map(
                          (s) =>
                            `${names.get(s.refId) ?? '?'} (${LEVEL_LABEL[s.level].toLowerCase()})`,
                        )
                        .join(', ')}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {u.lastLoginAt ? formatWaktu(u.lastLoginAt) : 'Belum pernah'}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(u)}>
                    Ubah
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <PenggunaDialog
        value={editing}
        onClose={() => setEditing(null)}
        isSuperAdmin={me?.role === 'SUPER_ADMIN'}
        names={names}
      />
    </div>
  );
}

function PenggunaDialog({
  value,
  onClose,
  isSuperAdmin,
  names,
}: {
  value: UserRow | 'baru' | null;
  onClose: () => void;
  isSuperAdmin: boolean;
  names: Map<string, string>;
}) {
  const current = value === 'baru' ? null : value;
  return (
    <Dialog open={value !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{current ? `Ubah ${current.nama}` : 'Tambah pengguna'}</DialogTitle>
        </DialogHeader>
        {value !== null && (
          <PenggunaForm
            key={current?.id ?? 'baru'}
            current={current}
            onDone={onClose}
            isSuperAdmin={isSuperAdmin}
            names={names}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PenggunaForm({
  current,
  onDone,
  isSuperAdmin,
  names,
}: {
  current: UserRow | null;
  onDone: () => void;
  isSuperAdmin: boolean;
  names: Map<string, string>;
}) {
  const qc = useQueryClient();
  const tree = useWilayahTree();
  const [role, setRole] = useState<Role>(current?.role ?? 'ADMIN');
  const [scopes, setScopes] = useState(current?.scopes ?? []);
  const [pick, setPick] = useState<WilayahValue>(EMPTY_WILAYAH);
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      current
        ? api(`/users/${current.id}`, { method: 'PATCH', body })
        : api('/users', { method: 'POST', body }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['users'] });
      onDone();
    },
  });

  function addScope() {
    const entry: { level: ScopeLevel; refId: string } | null = pick.kelompokId
      ? { level: 'KELOMPOK', refId: pick.kelompokId }
      : pick.desaId
        ? { level: 'DESA', refId: pick.desaId }
        : pick.daerahId
          ? { level: 'DAERAH', refId: pick.daerahId }
          : null;
    if (entry && !scopes.some((s) => s.refId === entry.refId)) setScopes([...scopes, entry]);
    setPick(EMPTY_WILAYAH);
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      nama: f.get('nama'),
      role,
      scopes: role === 'SUPER_ADMIN' ? [] : scopes,
    };
    if (!current) body.email = f.get('email');
    if (f.get('password')) body.password = f.get('password');
    if (current) body.aktif = f.get('aktif') === 'on';
    save.mutate(body);
  }

  const roles: Role[] = isSuperAdmin
    ? ['SUPER_ADMIN', 'ADMIN', 'PENGURUS', 'AUDITOR']
    : ['ADMIN', 'PENGURUS', 'AUDITOR'];

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="nama">Nama</Label>
        <Input id="nama" name="nama" required defaultValue={current?.nama} />
      </div>
      {!current && (
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required />
        </div>
      )}
      <div className="grid gap-2">
        <Label htmlFor="password">{current ? 'Password baru (opsional)' : 'Password'}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          minLength={8}
          required={!current}
          autoComplete="new-password"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="role">Peran</Label>
        <NativeSelect id="role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {roles.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </NativeSelect>
        <p className="text-xs text-muted-foreground">{ROLE_HELP[role]}</p>
      </div>
      {role !== 'SUPER_ADMIN' && (
        <fieldset className="grid gap-3 rounded-lg border p-3">
          <legend className="px-1 text-sm font-medium">Wilayah</legend>
          {scopes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada wilayah.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {scopes.map((s) => (
                <li
                  key={s.refId}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm"
                >
                  {names.get(s.refId) ?? '?'}
                  <span className="text-xs text-muted-foreground">
                    {LEVEL_LABEL[s.level].toLowerCase()}
                  </span>
                  <button
                    type="button"
                    aria-label="Hapus wilayah"
                    className="ml-1 text-muted-foreground hover:text-foreground"
                    onClick={() => setScopes(scopes.filter((x) => x.refId !== s.refId))}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <WilayahSelect tree={tree.data ?? []} value={pick} onChange={setPick} emptyLabel="–" />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            disabled={!pick.daerahId && !pick.desaId && !pick.kelompokId}
            onClick={addScope}
          >
            Tambah wilayah
          </Button>
          <p className="text-xs text-muted-foreground">
            Pilih sampai daerah, desa, atau kelompok. Tingkat terdalam yang dipilih jadi wilayahnya.
          </p>
        </fieldset>
      )}
      {current && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="aktif" defaultChecked={current.aktif} className="size-4" />
          Aktif (bisa login)
        </label>
      )}
      {save.error && <Alert variant="destructive">{errorMessage(save.error)}</Alert>}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Batal
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Menyimpan…' : 'Simpan'}
        </Button>
      </DialogFooter>
    </form>
  );
}
