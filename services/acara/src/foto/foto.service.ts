import { mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { AcaraService } from '../acara/acara.service.js';
import type { AuthUser } from '../auth/auth.types.js';
import { badRequest, notFound } from '../common/app-error.js';
import { config } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';

const MAX_SISI = 1600;
const THUMB_SISI = 320;

export function uploadRoot(): string {
  const dir = config().UPLOAD_DIR;
  return isAbsolute(dir) ? dir : resolve(process.cwd(), dir);
}

@Injectable()
export class FotoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acara: AcaraService,
  ) {}

  async list(user: AuthUser, acaraId: string) {
    await this.acara.get(user, acaraId);
    return this.prisma.fotoKegiatan.findMany({
      where: { acaraId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, sesiId: true, caption: true, diunggahOleh: true, createdAt: true },
    });
  }

  /** Simpan foto sebagai WebP (maks 1600 px) + thumbnail 320 px. */
  async upload(
    user: AuthUser,
    acaraId: string,
    file: Buffer,
    meta: { caption?: string; sesiId?: string },
  ) {
    await this.acara.manageable(user, acaraId);
    if (meta.sesiId) {
      const s = await this.prisma.sesi.findFirst({
        where: { id: meta.sesiId, acaraId, deletedAt: null },
      });
      if (!s) throw notFound('Sesi', meta.sesiId);
    }
    let full: Buffer;
    let thumb: Buffer;
    try {
      const img = sharp(file, { failOn: 'error' }).rotate();
      full = await img
        .clone()
        .resize(MAX_SISI, MAX_SISI, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      thumb = await img
        .clone()
        .resize(THUMB_SISI, THUMB_SISI, { fit: 'cover' })
        .webp({ quality: 70 })
        .toBuffer();
    } catch {
      throw badRequest('FOTO_INVALID', 'File bukan gambar yang bisa dibaca');
    }
    const row = await this.prisma.fotoKegiatan.create({
      data: {
        acaraId,
        sesiId: meta.sesiId ?? null,
        caption: meta.caption?.trim().slice(0, 300) || null,
        diunggahOleh: user.id,
        path: '',
        thumbPath: '',
      },
    });
    const rel = join('acara', acaraId);
    await mkdir(join(uploadRoot(), rel), { recursive: true });
    const path = join(rel, `${row.id}.webp`);
    const thumbPath = join(rel, `${row.id}_thumb.webp`);
    await Promise.all([
      writeFile(join(uploadRoot(), path), full),
      writeFile(join(uploadRoot(), thumbPath), thumb),
    ]);
    await this.prisma.fotoKegiatan.update({ where: { id: row.id }, data: { path, thumbPath } });
    return { id: row.id, sesiId: row.sesiId, caption: row.caption, createdAt: row.createdAt };
  }

  async filePath(user: AuthUser, id: string, thumb: boolean): Promise<string> {
    const f = await this.prisma.fotoKegiatan.findFirst({ where: { id, deletedAt: null } });
    if (!f || !f.path) throw notFound('Foto', id);
    await this.acara.get(user, f.acaraId);
    return join(uploadRoot(), thumb ? f.thumbPath : f.path);
  }

  async remove(user: AuthUser, id: string): Promise<void> {
    const f = await this.prisma.fotoKegiatan.findFirst({ where: { id, deletedAt: null } });
    if (!f) throw notFound('Foto', id);
    await this.acara.manageable(user, f.acaraId);
    await this.prisma.fotoKegiatan.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
