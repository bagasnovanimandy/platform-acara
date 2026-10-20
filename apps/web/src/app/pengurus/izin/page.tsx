import { redirect } from 'next/navigation';

/** Tautan lama dari HANDOVER: keputusan izin ada di /admin/izin. */
export default function PengurusIzinPage() {
  redirect('/admin/izin');
}
