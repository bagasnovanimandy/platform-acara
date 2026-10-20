import { Injectable } from '@nestjs/common';
import { type Observable, Subject } from 'rxjs';

/** Sinyal "jumlah wajah PENDING berubah" untuk badge verifikasi (satu proses acara-svc). */
@Injectable()
export class FaceBus {
  private readonly subject = new Subject<void>();

  emit(): void {
    this.subject.next();
  }

  get perubahan(): Observable<void> {
    return this.subject.asObservable();
  }
}
