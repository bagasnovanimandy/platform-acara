import { redirect } from 'next/navigation';

/** Pengurus memakai dasbor yang sama dengan admin (menu dibatasi sesuai peran). */
export default function PengurusPage() {
  redirect('/admin');
}
