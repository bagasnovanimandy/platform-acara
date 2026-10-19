import { HttpException, HttpStatus } from '@nestjs/common';

/** Error dengan format respons konsisten `{ code, message, details? }`. */
export class AppError extends HttpException {
  constructor(status: HttpStatus, code: string, message: string, details?: unknown) {
    super(details === undefined ? { code, message } : { code, message, details }, status);
  }
}

export const notFound = (entitas: string, id?: string): AppError =>
  new AppError(
    HttpStatus.NOT_FOUND,
    'NOT_FOUND',
    `${entitas} tidak ditemukan`,
    id ? { id } : undefined,
  );

export const forbiddenScope = (): AppError =>
  new AppError(HttpStatus.FORBIDDEN, 'OUT_OF_SCOPE', 'Data di luar wilayah Anda');

export const badRequest = (code: string, message: string, details?: unknown): AppError =>
  new AppError(HttpStatus.BAD_REQUEST, code, message, details);

export const conflict = (code: string, message: string, details?: unknown): AppError =>
  new AppError(HttpStatus.CONFLICT, code, message, details);
