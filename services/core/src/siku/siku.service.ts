import { randomBytes } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { AppError, badRequest } from '../common/app-error.js';
import { config } from '../config.js';
import { hashPassword } from '../auth/password.js';
import { TokenService } from '../auth/token.service.js';
import type { AuthUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { rencanakanImpor } from './siku.js';
import type { ImporSikuDto } from './siku.dto.js';

const SISTEM = 'Sistem (impor SiKU)';

@Injectable()
export class SikuService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async impor(dto: ImporSikuDto) {
    const emails = dto.users.map((u) => u.email);
    if (new Set(emails).size !== emails.length) throw badRequest('EMAIL_GANDA', 'Ada email ganda');
    const rows = await this.prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true, email: true, sikuRoles: true },
    });
    const rencana = rencanakanImpor(dto.users, new Map(rows.map((r) => [r.email, r])));
    const hitung = (a: string) => rencana.filter((r) => r.aksi === a).length;
    const ringkasan = {
      dryRun: dto.dryRun,
      dibuat: hitung('BUAT'),
      diperbarui: hitung('PERBARUI'),
      tetap: hitung('TETAP'),
      dilewati: hitung('LEWATI'),
      detail: rencana.map((r) => ({
        email: r.baris.email,
        aksi: r.aksi,
        sikuRoles: r.aksi === 'PERBARUI' ? r.sikuRoles : r.baris.aktif ? r.baris.sikuRoles : [],
        ...('alasan' in r && r.alasan ? { alasan: r.alasan } : {}),
        ...(r.aksi === 'BUAT' && !r.baris.passwordHash ? { catatan: 'perlu reset password' } : {}),
      })),
    };
    if (dto.dryRun) return ringkasan;

    // Hash acak untuk user tanpa password: tidak bisa dipakai login sampai admin reset.
    const hashAcak = await hashPassword(randomBytes(32).toString('hex'));
    await this.prisma.$transaction(async (tx) => {
      for (const r of rencana) {
        if (r.aksi === 'BUAT') {
          const u = await tx.user.create({
            data: {
              email: r.baris.email,
              nama: r.baris.nama,
              // AUDITOR tanpa wilayah = tidak melihat data acara; admin menambah role/wilayah bila perlu.
              role: 'AUDITOR',
              passwordHash: r.baris.passwordHash ?? hashAcak,
              sikuRoles: r.baris.sikuRoles,
            },
          });
          await tx.auditLog.create({
            data: {
              userNama: SISTEM,
              aksi: 'IMPORT',
              entitas: 'User',
              entitasId: u.id,
              ringkasan: `Impor user SiKU ${u.nama} (${r.baris.sikuRoles.join(', ')})`,
              data: { email: u.email, sikuRoles: r.baris.sikuRoles },
            },
          });
        } else if (r.aksi === 'PERBARUI') {
          await tx.user.update({ where: { id: r.id }, data: { sikuRoles: r.sikuRoles } });
          await tx.auditLog.create({
            data: {
              userNama: SISTEM,
              aksi: 'UPDATE',
              entitas: 'User',
              entitasId: r.id,
              ringkasan: `Peran SiKU ${r.baris.email}: ${r.sebelum.join(', ') || '-'} → ${r.sikuRoles.join(', ') || '-'}`,
              data: { sebelum: r.sebelum, sesudah: r.sikuRoles },
            },
          });
        }
      }
    });
    return ringkasan;
  }

  /** URL masuk ke SiKU dengan token sekali pakai di fragment (tidak terkirim ke log server). */
  async urlMasuk(user: AuthUser): Promise<{ url: string }> {
    const base = config().SIKU_URL;
    if (!base) throw new AppError(HttpStatus.NOT_FOUND, 'SIKU_NOT_CONFIGURED', 'SiKU belum diatur');
    const u = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { aktif: true, sikuRoles: true },
    });
    if (!u?.aktif || u.sikuRoles.length === 0)
      throw new AppError(HttpStatus.FORBIDDEN, 'SIKU_NO_ACCESS', 'Anda tidak punya akses SiKU');
    const token = await this.tokens.issueSso(user, u.sikuRoles);
    return { url: `${base.replace(/\/+$/, '')}/sso#token=${token}` };
  }
}
