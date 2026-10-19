'use client';

import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import type { Daerah } from '@/lib/types';

export interface WilayahValue {
  daerahId: string;
  desaId: string;
  kelompokId: string;
}

export const EMPTY_WILAYAH: WilayahValue = { daerahId: '', desaId: '', kelompokId: '' };

/** Pilihan bertingkat Daerah → Desa → Kelompok. Mengganti induk mengosongkan pilihan di bawahnya. */
export function WilayahSelect({
  tree,
  value,
  onChange,
  emptyLabel = 'Semua',
  required = false,
}: {
  tree: Daerah[];
  value: WilayahValue;
  onChange: (v: WilayahValue) => void;
  emptyLabel?: string;
  required?: boolean;
}) {
  const daerah = tree.find((d) => d.id === value.daerahId);
  const desaList = daerah ? daerah.desa : tree.flatMap((d) => d.desa);
  const desa = desaList.find((d) => d.id === value.desaId);
  const kelompokList = desa ? desa.kelompok : desaList.flatMap((d) => d.kelompok);

  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor="daerah">Daerah</Label>
        <NativeSelect
          id="daerah"
          value={value.daerahId}
          onChange={(e) => onChange({ daerahId: e.target.value, desaId: '', kelompokId: '' })}
        >
          <option value="">{emptyLabel}</option>
          {tree.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nama}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="desa">Desa</Label>
        <NativeSelect
          id="desa"
          value={value.desaId}
          onChange={(e) => {
            const d = desaList.find((x) => x.id === e.target.value);
            onChange({
              daerahId: d?.daerahId ?? value.daerahId,
              desaId: e.target.value,
              kelompokId: '',
            });
          }}
        >
          <option value="">{emptyLabel}</option>
          {desaList.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nama}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="kelompok">Kelompok</Label>
        <NativeSelect
          id="kelompok"
          value={value.kelompokId}
          required={required}
          onChange={(e) => {
            const k = kelompokList.find((x) => x.id === e.target.value);
            const d = desaList.find((x) => x.id === k?.desaId);
            onChange({
              daerahId: d?.daerahId ?? value.daerahId,
              desaId: k?.desaId ?? value.desaId,
              kelompokId: e.target.value,
            });
          }}
        >
          <option value="">{required ? 'Pilih kelompok' : emptyLabel}</option>
          {kelompokList.map((k) => (
            <option key={k.id} value={k.id}>
              {k.nama}
            </option>
          ))}
        </NativeSelect>
      </div>
    </>
  );
}
