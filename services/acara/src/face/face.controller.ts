import {
  Body,
  Controller,
  Get,
  HttpCode,
  type MessageEvent,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
  Sse,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { concatMap, interval, map, merge, type Observable, startWith, throttleTime } from 'rxjs';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Public, Roles } from '../auth/decorators.js';
import { CurrentOperator, type OperatorCtx, OperatorGuard } from '../op/operator.guard.js';
import { EnrollDto, GantiAnggotaDto, PendingQuery, TolakWajahDto } from './face.dto.js';
import { FaceService } from './face.service.js';
import { FaceBus } from './face-bus.js';

/** Pendaftaran wajah dari perangkat pintu. */
@Controller('op/face')
@Public()
export class OpFaceController {
  constructor(private readonly face: FaceService) {}

  @Post('enroll')
  @HttpCode(200)
  @UseGuards(OperatorGuard)
  enroll(@CurrentOperator() op: OperatorCtx, @Body() dto: EnrollDto) {
    return this.face.enroll(op, dto);
  }
}

/** Badge dikirim ulang paling lambat tiap 15 dtk walau tidak ada sinyal. */
const BADGE_TICK_MS = 15_000;

/** Verifikasi wajah oleh admin (HANDOVER §5.6). */
@Controller('face')
@Roles('ADMIN', 'AUDITOR')
export class FaceController {
  constructor(
    private readonly face: FaceService,
    private readonly bus: FaceBus,
  ) {}

  @Get('pending')
  pending(@CurrentUser() user: AuthUser, @Query() q: PendingQuery) {
    return this.face.pending(user, q.page, q.pageSize);
  }

  @Get('pending/jumlah')
  async jumlah(@CurrentUser() user: AuthUser) {
    return { jumlah: await this.face.jumlahPending(user) };
  }

  /** Badge realtime "N wajah perlu verifikasi" (SSE). */
  @Sse('pending/stream')
  async stream(@CurrentUser() user: AuthUser): Promise<Observable<MessageEvent>> {
    await this.face.jumlahPending(user); // validasi user aktif sebelum stream dibuka
    return merge(
      interval(BADGE_TICK_MS),
      this.bus.perubahan.pipe(throttleTime(500, undefined, { leading: true, trailing: true })),
    ).pipe(
      startWith(0),
      concatMap(() => this.face.jumlahPending(user)),
      map((jumlah) => ({ data: { jumlah } })),
    );
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.face.detail(user, id);
  }

  @Get(':id/thumb/:i')
  async thumb(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('i', ParseIntPipe) i: number,
    @Res() res: Response,
  ): Promise<void> {
    const path = await this.face.thumbnail(user, id, i);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.type('image/webp').sendFile(path);
  }

  @Post(':id/verify')
  @HttpCode(200)
  @Roles('ADMIN')
  verify(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.face.setujui(user, id);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @Roles('ADMIN')
  reject(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: TolakWajahDto) {
    return this.face.tolak(user, id, dto.alasan);
  }

  @Post(':id/reassign')
  @HttpCode(200)
  @Roles('ADMIN')
  reassign(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: GantiAnggotaDto) {
    return this.face.gantiAnggota(user, id, dto.anggotaId);
  }
}
