'use client';

import {
  KATEGORI_GENERUS,
  KATEGORI_GENERUS_LABEL,
  type KategoriGenerus,
} from '@platform-acara/shared';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { KATEGORI_TONE } from './kategori-badge';

const OPTIONS: { value: KategoriGenerus | ''; label: string }[] = [
  ...KATEGORI_GENERUS.map((k) => ({ value: k, label: KATEGORI_GENERUS_LABEL[k] })),
  { value: '', label: 'Belum diisi' },
];

/**
 * Pilihan kategori generus sebagai tombol radio. Nilai dikirim lewat field `name`
 * (string kosong = belum ditentukan), jadi bisa dipakai di form biasa.
 */
export function KategoriPicker({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue: KategoriGenerus | null;
}) {
  const [value, setValue] = useState<KategoriGenerus | ''>(defaultValue ?? '');
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-sm leading-none font-medium">Kategori generus</legend>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((o) => {
          const checked = value === o.value;
          return (
            <label
              key={o.value || 'kosong'}
              className={cn(
                'cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors select-none',
                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2',
                checked
                  ? o.value
                    ? cn('border-transparent font-medium ring-1 ring-inset', KATEGORI_TONE[o.value])
                    : 'border-foreground/40 bg-muted font-medium'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={checked}
                onChange={() => setValue(o.value)}
                className="sr-only"
              />
              {o.label}
            </label>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Diisi sesuai hasil assessment, tidak dihitung dari umur.
      </p>
    </fieldset>
  );
}
