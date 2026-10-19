'use client';

import { useState } from 'react';
import {
  AdminDashboard,
  AktivitasPanel,
  AuditorDashboard,
} from '@/components/dashboard/dashboards';
import { canEdit, useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

const TAB = [
  { key: 'ringkasan', label: 'Ringkasan' },
  { key: 'aktivitas', label: 'Aktivitas' },
] as const;

export default function DashboardPage() {
  const user = useAuth((s) => s.user);
  const [tab, setTab] = useState<(typeof TAB)[number]['key']>('ringkasan');
  const auditor = user?.role === 'AUDITOR';
  // Admin & super admin boleh melihat aktivitas; pengurus hanya ringkasan.
  const bisaAktivitas = canEdit(user);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{auditor ? 'Dashboard audit' : 'Dashboard'}</h1>
          <p className="text-sm text-muted-foreground">
            {auditor
              ? 'Siapa mengubah apa, dan seberapa lengkap datanya, di wilayah Anda.'
              : 'Gambaran anggota di wilayah yang Anda kelola.'}
          </p>
        </div>
        {bisaAktivitas && (
          <div role="tablist" className="ml-auto flex rounded-lg border p-1">
            {TAB.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'rounded-md px-4 py-1.5 text-sm font-medium text-muted-foreground',
                  tab === t.key && 'bg-accent text-foreground',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {auditor ? (
        <AuditorDashboard />
      ) : bisaAktivitas && tab === 'aktivitas' ? (
        <AktivitasPanel />
      ) : (
        <AdminDashboard />
      )}
    </div>
  );
}
