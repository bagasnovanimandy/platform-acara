'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { logout, refreshSession } from '@/lib/api';
import { type AuthUser } from '@/lib/api';
import { canAudit, canEdit, ROLE_LABEL, useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

const NAV: { href: string; label: string; show?: (u: AuthUser) => boolean }[] = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/acara', label: 'Acara' },
  { href: '/admin/anggota', label: 'Anggota' },
  { href: '/admin/kategori', label: 'Kategori' },
  { href: '/admin/wilayah', label: 'Wilayah' },
  { href: '/admin/pengguna', label: 'Pengguna', show: canEdit },
  { href: '/admin/riwayat', label: 'Riwayat', show: canAudit },
];

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
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/admin" className="font-semibold">
            Platform Acara
          </Link>
          <nav className="-mx-1 flex gap-1 overflow-x-auto px-1">
            {NAV.filter((n) => !n.show || n.show(user)).map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm whitespace-nowrap hover:bg-accent',
                  (n.href === '/admin' ? pathname === n.href : pathname.startsWith(n.href)) &&
                    'bg-accent font-medium',
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
      <main className="mx-auto max-w-6xl px-4 py-6 print:max-w-none print:p-0">{children}</main>
    </div>
  );
}
