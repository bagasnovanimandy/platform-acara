import { Injectable } from '@nestjs/common';
import { config } from '../config.js';
import { internalGet } from './http.js';

export interface SesiMendatang {
  acara: { id: string; nama: string; lokasi: string | null };
  sesi: { id: string; nama: string; mulai: string; selesai: string; batasIzin: string };
}

export interface PjAcara {
  userId: string;
  nama: string;
  peran: string;
}

/** Klien HTTP ke acara-svc /internal/* (bot tidak membaca database acara). */
@Injectable()
export class AcaraClient {
  private get<T>(path: string): Promise<T | null> {
    return internalGet<T>(config().ACARA_URL, 'acara-svc', path);
  }

  async sesiMendatang(anggotaId: string, hari = 14): Promise<SesiMendatang[]> {
    return (
      (await this.get<SesiMendatang[]>(
        `/anggota/${encodeURIComponent(anggotaId)}/sesi?hari=${hari}`,
      )) ?? []
    );
  }

  async pj(acaraId: string): Promise<PjAcara[]> {
    return (await this.get<PjAcara[]>(`/acara/${encodeURIComponent(acaraId)}/pj`)) ?? [];
  }
}
