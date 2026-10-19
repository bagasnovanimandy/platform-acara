import { Injectable } from '@nestjs/common';
import { filter, type Observable, Subject } from 'rxjs';

/** Sinyal "ada perubahan di sesi ini" untuk SSE monitor (satu proses acara-svc). */
@Injectable()
export class MonitorBus {
  private readonly subject = new Subject<string>();

  emit(sesiId: string): void {
    this.subject.next(sesiId);
  }

  sesi(sesiId: string): Observable<string> {
    return this.subject.pipe(filter((id) => id === sesiId));
  }
}
