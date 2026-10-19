import Link from 'next/link';
import { Button } from '@/components/ui/button';

const tujuan = [
  { href: '/admin', label: 'Admin', keterangan: 'Kelola acara, anggota, dan rekap' },
  { href: '/op', label: 'Operator', keterangan: 'Absensi wajah di pintu' },
  { href: '/pengurus', label: 'Pengurus', keterangan: 'Keputusan izin' },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Platform Acara</h1>
      <ul className="flex flex-col gap-3">
        {tujuan.map((t) => (
          <li key={t.href}>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-auto w-full flex-col items-start py-3"
            >
              <Link href={t.href}>
                <span className="text-base">{t.label}</span>
                <span className="text-sm font-normal text-muted-foreground">{t.keterangan}</span>
              </Link>
            </Button>
          </li>
        ))}
      </ul>
    </main>
  );
}
