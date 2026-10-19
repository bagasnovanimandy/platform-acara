'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { Kategori } from '@/lib/types';
import { KATEGORI_TONE } from './kategori-badge';

/**
 * Pilih banyak kategori (tombol on/off). Nilai dikirim lewat beberapa field `name`
 * yang sama, jadi bisa dibaca dengan `FormData.getAll(name)`.
 */
export function KategoriPicker({
  name,
  options,
  defaultValue,
}: {
  name: string;
  options: Kategori[];
  defaultValue: string[];
}) {
  const [value, setValue] = useState<string[]>(defaultValue);
  const aktif = options.filter((o) => o.aktif || value.includes(o.id));
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-sm leading-none font-medium">
        Kategori <span className="font-normal text-muted-foreground">(boleh lebih dari satu)</span>
      </legend>
      <div className="flex flex-wrap gap-2">
        {aktif.map((o) => {
          const checked = value.includes(o.id);
          return (
            <label
              key={o.id}
              className={cn(
                'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors select-none',
                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2',
                checked
                  ? cn(
                      'border-transparent font-medium ring-1 ring-inset',
                      KATEGORI_TONE[o.warna].chip,
                    )
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              <input
                type="checkbox"
                name={name}
                value={o.id}
                checked={checked}
                onChange={() =>
                  setValue((v) => (checked ? v.filter((x) => x !== o.id) : [...v, o.id]))
                }
                className="sr-only"
              />
              <span
                aria-hidden
                className={cn(
                  'size-2 rounded-full',
                  checked ? KATEGORI_TONE[o.warna].dot : 'bg-muted-foreground/40',
                )}
              />
              {o.nama}
            </label>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Diisi sesuai hasil assessment, tidak dihitung dari umur. Kosongkan bila belum di-assessment.
      </p>
    </fieldset>
  );
}
