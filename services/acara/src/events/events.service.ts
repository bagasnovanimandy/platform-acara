import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import {
  EVENT_ROUTES,
  type EventName,
  type EventPayload,
  parseEvent,
  type QueueName,
} from '@platform-acara/shared';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { config } from '../config.js';

const PUBLISH_TIMEOUT_MS = 3000;
const JOB_OPTS = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: 1000,
  removeOnFail: 5000,
} as const;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout ${ms} ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

/** Publish event ke queue BullMQ milik setiap consumer (lihat EVENT_ROUTES). */
@Injectable()
export class EventsService implements OnModuleDestroy {
  private readonly logger = new Logger(EventsService.name);
  private readonly queues = new Map<QueueName, Queue>();
  private redis?: Redis;

  publish<E extends EventName>(name: E, payload: EventPayload<E>): Promise<void> {
    return this.publishMany(name, [payload]);
  }

  /** Satu addBulk per queue, paralel, dengan batas waktu: Redis mati tidak boleh membuat request macet. */
  async publishMany<E extends EventName>(name: E, payloads: EventPayload<E>[]): Promise<void> {
    if (payloads.length === 0) return;
    const jobs = payloads.map((p) => ({ name, data: parseEvent(name, p), opts: JOB_OPTS }));
    const url = config().REDIS_URL;
    if (!url) {
      this.logger.warn(`REDIS_URL kosong, ${jobs.length} event ${name} tidak dikirim`);
      return;
    }
    await Promise.all(
      EVENT_ROUTES[name].map(async (queueName) => {
        try {
          await withTimeout(this.queue(queueName, url).addBulk(jobs), PUBLISH_TIMEOUT_MS);
        } catch (err) {
          // Event gagal tidak boleh menggagalkan request.
          this.logger.error(`Gagal publish ${jobs.length} ${name} ke ${queueName}: ${String(err)}`);
        }
      }),
    );
  }

  private queue(name: QueueName, url: string): Queue {
    let q = this.queues.get(name);
    if (!q) {
      this.redis ??= new Redis(url, { maxRetriesPerRequest: null });
      q = new Queue(name, { connection: this.redis });
      q.on('error', (err) => this.logger.warn(`Redis queue ${name}: ${err.message}`));
      this.queues.set(name, q);
    }
    return q;
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([...this.queues.values()].map((q) => q.close()));
    this.redis?.disconnect();
  }
}
