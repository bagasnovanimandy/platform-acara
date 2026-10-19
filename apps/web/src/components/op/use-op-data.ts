'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  alasanKeluar,
  ambilPaket,
  kirimBatch,
  kirimHeartbeat,
  kirimWajah,
  OpError,
} from '@/lib/op/api';
import { db } from '@/lib/op/db';
import type { AntreanItem, OpSession, Paket, PesertaPaket, WajahLokal } from '@/lib/op/types';

const SYNC_MS = 5_000;
const PAKET_MS = 120_000;
const BATCH = 100;
const HEARTBEAT_MS = 20_000;

interface BatteryManagerLike {
  level: number;
}

/** Persen baterai bila browser mendukung (Chrome Android), selain itu null. */
async function bacaBaterai(): Promise<number | null> {
  const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryManagerLike> };
  try {
    return nav.getBattery ? Math.round((await nav.getBattery()).level * 100) : null;
  } catch {
    return null;
  }
}

export type SyncState = 'idle' | 'mengirim' | 'gagal';

function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}

/**
 * Data perangkat: paket offline (IndexedDB), antrean absensi, dan sinkron tiap 5 detik
 * selama ada jaringan.
 */
export function useOpData(
  session: OpSession,
  onExpired: (alasan?: string) => void,
  sedangInput = false,
) {
  const sesiId = session.sesi.id;
  const online = useOnline();
  const [paket, setPaket] = useState<Paket | null>(null);
  const [paketError, setPaketError] = useState<string | null>(null);
  const [antrean, setAntrean] = useState(0);
  const [hadirLokal, setHadirLokal] = useState<Set<string>>(new Set());
  const [sync, setSync] = useState<SyncState>('idle');
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [ditolak, setDitolak] = useState(0);
  const [wajahLokal, setWajahLokal] = useState<WajahLokal[]>([]);
  const syncing = useRef(false);

  const refreshCounts = useCallback(async () => {
    const [n, hadir, tolak, wajah] = await Promise.all([
      db.antrean.where('sesiId').equals(sesiId).count(),
      db.hadir.where('sesiId').equals(sesiId).toArray(),
      db.ditolak.where('sesiId').equals(sesiId).count(),
      db.wajah.where('sesiId').equals(sesiId).toArray(),
    ]);
    setWajahLokal(wajah);
    setAntrean(n + wajah.filter((w) => !w.serverId).length);
    setHadirLokal(new Set(hadir.map((h) => h.anggotaId)));
    setDitolak(tolak);
  }, [sesiId]);

  const unduhPaket = useCallback(async () => {
    try {
      const p = await ambilPaket(session);
      await db.paket.put({ sesiId, paket: p, disimpanAt: new Date().toISOString() });
      // Wajah lokal yang terkirim sebelum paket ini dibuat sudah ada di paket (atau ditolak admin).
      await db.wajah
        .where('sesiId')
        .equals(sesiId)
        .filter((w) => !!w.terkirimAt && w.terkirimAt < p.dibuatAt)
        .delete();
      setPaket(p);
      setPaketError(null);
      await refreshCounts();
    } catch (e) {
      if (e instanceof OpError && e.status === 401) onExpired(alasanKeluar(e));
      else setPaketError(e instanceof Error ? e.message : 'Gagal mengunduh paket');
    }
  }, [session, sesiId, onExpired, refreshCounts]);

  // Paket dari IndexedDB dulu (offline), lalu perbarui dari server bila online.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const row = await db.paket.get(sesiId);
      if (alive && row) setPaket(row.paket);
      await refreshCounts();
      if (navigator.onLine) await unduhPaket();
    })();
    return () => {
      alive = false;
    };
  }, [sesiId, refreshCounts, unduhPaket]);

  useEffect(() => {
    if (!online) return;
    const t = setInterval(() => void unduhPaket(), PAKET_MS);
    return () => clearInterval(t);
  }, [online, unduhPaket]);

  const kirim = useCallback(async () => {
    if (syncing.current || !navigator.onLine) return;
    const wajah = await db.wajah
      .where('sesiId')
      .equals(sesiId)
      .filter((w) => !w.serverId)
      .toArray();
    const rows = await db.antrean.where('sesiId').equals(sesiId).sortBy('dibuatAt');
    if (rows.length === 0 && wajah.length === 0) return;
    syncing.current = true;
    setSync('mengirim');
    try {
      // Wajah dulu, agar absensi yang memakainya dikenali server.
      for (const w of wajah) {
        try {
          const res = await kirimWajah(session, w);
          await db.wajah.update(w.clientId, {
            serverId: res.id,
            terkirimAt: new Date().toISOString(),
            thumbnails: [],
          });
        } catch (e) {
          // Data ditolak server (bukan peserta / tidak valid): buang, jangan dicoba terus.
          if (e instanceof OpError && e.status === 400) await db.wajah.delete(w.clientId);
          else throw e;
        }
      }
      for (let i = 0; i < rows.length; i += BATCH) {
        const part = rows.slice(i, i + BATCH);
        const res = await kirimBatch(
          session,
          part.map((r) => r.item),
        );
        const byId = new Map(part.map((r) => [r.clientId, r]));
        await db.transaction('rw', db.antrean, db.ditolak, async () => {
          for (const h of res.hasil) {
            const r = byId.get(h.clientId);
            if (h.status === 'DITOLAK' && r) {
              await db.ditolak.put({
                clientId: h.clientId,
                sesiId,
                item: r.item,
                alasan: h.alasan ?? 'Ditolak',
                waktu: new Date().toISOString(),
              });
            }
            await db.antrean.delete(h.clientId);
          }
        });
      }
      setSync('idle');
      setLastSync(new Date());
    } catch (e) {
      if (e instanceof OpError && e.status === 401) onExpired(alasanKeluar(e));
      setSync('gagal');
    } finally {
      syncing.current = false;
      await refreshCounts();
    }
  }, [session, sesiId, refreshCounts, onExpired]);

  useEffect(() => {
    if (!online) return;
    void kirim();
    const t = setInterval(() => void kirim(), SYNC_MS);
    return () => clearInterval(t);
  }, [online, kirim]);

  /** Simpan satu absensi ke antrean lokal (langsung, tanpa menunggu jaringan). */
  const catat = useCallback(
    async (item: AntreanItem) => {
      const now = new Date().toISOString();
      await db.transaction('rw', db.antrean, db.hadir, async () => {
        await db.antrean.put({ clientId: item.clientId, sesiId, item, dibuatAt: now });
        if (item.metode !== 'TAMU') {
          await db.hadir.put({
            key: `${sesiId}:${item.anggotaId}`,
            sesiId,
            anggotaId: item.anggotaId,
            waktu: now,
          });
        }
      });
      await refreshCounts();
      if (navigator.onLine) void kirim();
    },
    [sesiId, refreshCounts, kirim],
  );

  /** Simpan wajah baru: langsung dipakai pencocokan, dikirim saat ada jaringan. */
  const daftarWajah = useCallback(
    async (w: Omit<WajahLokal, 'sesiId' | 'serverId' | 'terkirimAt'>) => {
      await db.wajah.put({ ...w, sesiId, serverId: null, terkirimAt: null });
      await refreshCounts();
      if (navigator.onLine) void kirim();
    },
    [sesiId, refreshCounts, kirim],
  );

  // Heartbeat tiap 20 dtk untuk monitor admin (HANDOVER §5.7).
  const hbState = useRef({ antrean, sedangInput });
  hbState.current = { antrean, sedangInput };
  useEffect(() => {
    if (!online) return;
    const kirimHb = async () => {
      try {
        await kirimHeartbeat(session, {
          online: true,
          ...hbState.current,
          baterai: await bacaBaterai(),
        });
      } catch (e) {
        if (e instanceof OpError && e.status === 401) onExpired(alasanKeluar(e));
      }
    };
    void kirimHb();
    const t = setInterval(() => void kirimHb(), HEARTBEAT_MS);
    return () => clearInterval(t);
  }, [online, session, onExpired]);

  const pesertaById = useMemo(
    () => new Map<string, PesertaPaket>((paket?.peserta ?? []).map((p) => [p.id, p])),
    [paket],
  );
  const sudahHadir = useMemo(
    () => new Set([...(paket?.sudahHadir ?? []), ...hadirLokal]),
    [paket, hadirLokal],
  );

  return {
    online,
    paket,
    paketError,
    pesertaById,
    sudahHadir,
    antrean,
    ditolak,
    sync,
    lastSync,
    wajahLokal,
    catat,
    daftarWajah,
    unduhPaket,
  };
}
