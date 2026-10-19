'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { logout, refreshSession } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/admin/anggota', label: 'Anggota' },
  { href: '/admin/wilayah', label: 'Wilayah' },
];

const ROLE_LABEL = { SUPER_ADMIN: 'Super Admin', ADMIN: 'Admin', PENGURUS: 'Pengurus' } as const;

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'unknown') void refreshSession();
    if (status === 'anonymous') router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [status, router, pathname]);

  if (status !== 'authenticated' || !user) {
    return <div className="p-6 text-muted-foreground">Memuat…</div>;
  }

  return (
    <div className="min-h-dvh">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/admin" className="font-semibold">
            Platform Acara
          </Link>
          <nav className="flex gap-1">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm hover:bg-accent',
                  pathname.startsWith(n.href) && 'bg-accent font-medium',
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              {user.nama} · {ROLE_LABEL[user.role]}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await logout();
                router.replace('/login');
              }}
            >
              Keluar
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
