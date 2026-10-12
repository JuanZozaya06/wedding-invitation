import { Injectable, inject } from '@angular/core';
import {
  CommercialApiService,
  WeddingDetails,
} from '../http/commercial-api.service';
@Injectable({ providedIn: 'root' })
export class AdminSessionService {
  private readonly api = inject(CommercialApiService);
  wedding: WeddingDetails | null = null;
  error = '';
  returnUrl = '/admin';
  constructor() {
    this.api.sessionExpired.subscribe(() => this.clear());
  }
  clear() {
    this.wedding = null;
  }
  ensure(): Promise<boolean> {
    // A fresh page must ask for the password, even if the browser retains a cookie.
    // Keep authentication only in memory while navigating this SPA visit.
    return Promise.resolve(this.wedding !== null);
  }
  async login(password: string) {
    const wedding = await this.api.login(password);
    this.wedding = wedding;
    this.error = '';
    return wedding;
  }
  async logout() {
    try {
      await this.api.logout();
    } finally {
      this.clear();
    }
  }
}
