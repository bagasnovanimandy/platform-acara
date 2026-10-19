import {
  Body,
  Controller,
  Get,
  HttpCode,
  type MessageEvent,
  Param,
  Post,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { concatMap, interval, map, merge, type Observable, startWith, throttleTime } from 'rxjs';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Public, Roles } from '../auth/decorators.js';
import { AbsensiBatchDto, GeneratePintuDto, HeartbeatDto, OpLoginDto, TamuDto } from './op.dto.js';
import { OpService } from './op.service.js';
import { CurrentOperator, type OperatorCtx, OperatorGuard } from './operator.guard.js';
import { PintuService } from './pintu.service.js';

/** Endpoint perangkat pintu (PWA operator). Memakai token operator, bukan login admin. */
@Controller('op')
@Public()
export class OpController {
  constructor(
    private readonly op: OpService,
    private readonly pintu: PintuService,
  ) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: OpLoginDto) {
    return this.op.login(dto);
  }

  @Get('paket')
  @UseGuards(OperatorGuard)
  paket(@CurrentOperator() op: OperatorCtx) {
    return this.op.paket(op);
  }

  @Post('heartbeat')
  @HttpCode(200)
  @UseGuards(OperatorGuard)
  heartbeat(@CurrentOperator() op: OperatorCtx, @Body() dto: HeartbeatDto) {
    return this.pintu.heartbeat(op, dto);
  }

  @Post('absensi/batch')
  @HttpCode(200)
  @UseGuards(OperatorGuard)
  batch(@CurrentOperator() op: OperatorCtx, @Body() dto: AbsensiBatchDto) {
    return this.op.batch(op, dto.items);
  }

  @Post('tamu')
  @HttpCode(200)
  @UseGuards(OperatorGuard)
  tamu(@CurrentOperator() op: OperatorCtx, @Body() dto: TamuDto) {
    return this.op.batch(op, [{ ...dto, metode: 'TAMU' }]);
  }
}

/** SSE monitor dikirim ulang paling lambat tiap 5 dtk (status online → offline berbasis waktu). */
const MONITOR_TICK_MS = 5000;

/** Endpoint admin seputar pintu, monitoring, & kehadiran sesi. */
@Controller('sesi')
export class SesiKehadiranController {
  constructor(
    private readonly op: OpService,
    private readonly pintu: PintuService,
  ) {}

  @Post(':id/operator/generate')
  @Roles('ADMIN')
  generate(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: GeneratePintuDto) {
    return this.pintu.generate(user, id, dto.jumlah).then((items) => ({ items }));
  }

  @Get(':id/operator')
  @Roles('ADMIN', 'PENGURUS', 'AUDITOR')
  async daftarPintu(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.pintu.sesiTerlihat(user, id);
    return this.pintu.snapshot(id);
  }

  /** Monitor realtime (SSE). Web membaca lewat fetch agar bisa memakai header Authorization. */
  @Sse(':id/monitor')
  @Roles('ADMIN', 'PENGURUS', 'AUDITOR')
  async monitor(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<Observable<MessageEvent>> {
    await this.pintu.sesiTerlihat(user, id);
    return merge(
      interval(MONITOR_TICK_MS),
      this.pintu
        .perubahan(id)
        .pipe(throttleTime(500, undefined, { leading: true, trailing: true })),
    ).pipe(
      startWith(0),
      concatMap(() => this.pintu.snapshot(id)),
      map((data) => ({ data })),
    );
  }

  @Get(':id/kehadiran')
  @Roles('ADMIN', 'PENGURUS', 'AUDITOR')
  kehadiran(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.op.kehadiran(user, id);
  }
}

/** Aksi admin per pintu. */
@Controller('operator')
export class OperatorAdminController {
  constructor(private readonly pintu: PintuService) {}

  @Post(':id/revoke')
  @HttpCode(200)
  @Roles('ADMIN')
  revoke(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.pintu.revoke(user, id);
  }

  @Post(':id/reset-pin')
  @HttpCode(200)
  @Roles('ADMIN')
  resetPin(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.pintu.resetPin(user, id);
  }
}
