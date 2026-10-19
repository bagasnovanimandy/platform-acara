import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Public, Roles } from '../auth/decorators.js';
import { AbsensiBatchDto, OpLoginDto, TamuDto } from './op.dto.js';
import { OpService } from './op.service.js';
import { CurrentOperator, type OperatorCtx, OperatorGuard } from './operator.guard.js';

/** Endpoint perangkat pintu (PWA operator). Memakai token operator, bukan login admin. */
@Controller('op')
@Public()
export class OpController {
  constructor(private readonly op: OpService) {}

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

/** Endpoint admin seputar perangkat & kehadiran sesi. */
@Controller('sesi')
export class SesiKehadiranController {
  constructor(private readonly op: OpService) {}

  /** Sementara sampai fase 4 (generate pintu + PIN). */
  @Post(':id/operator/uji')
  @Roles('ADMIN')
  operatorUji(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.op.buatOperatorUji(user, id);
  }

  @Get(':id/kehadiran')
  @Roles('ADMIN', 'PENGURUS', 'AUDITOR')
  kehadiran(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.op.kehadiran(user, id);
  }
}
