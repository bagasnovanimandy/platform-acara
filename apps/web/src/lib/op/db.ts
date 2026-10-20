import Dexie, { type EntityTable } from 'dexie';
import type { AntreanItem, Paket, WajahLokal } from './types';

export interface PaketRow {
  sesiId: string;
  paket: Paket;
  disimpanAt: string;
}

export interface AntreanRow {
  clientId: string;
  sesiId: string;
  item: AntreanItem;
  dibuatAt: string;
}

/** Siapa yang sudah dicatat di perangkat ini (cooldown & tanda "sudah hadir"). */
export interface HadirRow {
  key: string; // `${sesiId}:${anggotaId}`
  sesiId: string;
  anggotaId: string;
  waktu: string;
}

export interface DitolakRow {
  clientId: string;
  sesiId: string;
  item: AntreanItem;
  alasan: string;
  waktu: string;
}

/** IndexedDB perangkat operator. */
export const db = new Dexie('platform-acara-op') as Dexie & {
  paket: EntityTable<PaketRow, 'sesiId'>;
  antrean: EntityTable<AntreanRow, 'clientId'>;
  hadir: EntityTable<HadirRow, 'key'>;
  ditolak: EntityTable<DitolakRow, 'clientId'>;
  wajah: EntityTable<WajahLokal, 'clientId'>;
};

db.version(1).stores({
  paket: 'sesiId',
  antrean: 'clientId, sesiId, dibuatAt',
  hadir: 'key, sesiId',
  ditolak: 'clientId, sesiId',
});

db.version(2).stores({ wajah: 'clientId, sesiId' });
