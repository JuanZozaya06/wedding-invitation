import { Injectable } from '@angular/core';
import { Invitation } from '../models/invitation.model';
import { commercialContext } from '../models/commercial-route';

export type WeddingDetails = {
  slug: string; partnerOne: string; partnerTwo: string; timezone: string;
  settings: { template: string; colors: Record<string, string>; copy: Record<string, string>; sections: Record<string, boolean> } | null;
  events: { kind: string; name: string; venue: string; address: string; startsAt: string | null; mapUrl: string }[];
};

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

@Injectable({ providedIn: 'root' })
export class CommercialApiService {
  private base = '/api';
  private adminBase = '/api';
  configuredWedding: string | null = 'gabriela-y-juan';
  private csrf = '';

  async initialize(hostname = window.location.hostname): Promise<void> {
    try {
      const response = await fetch(new URL('commercial-config.json', document.baseURI), { cache: 'no-store', signal: AbortSignal.timeout(5000) });
      if (!response.ok) return;
      const config = await response.json();
      if (typeof config.apiBaseUrl === 'string' && (config.apiBaseUrl.startsWith('/') || config.apiBaseUrl.startsWith('https://'))) {
        this.base = config.apiBaseUrl.replace(/\/$/, '');
        this.adminBase = this.base;
      }
      if (typeof config.adminApiBaseUrl === 'string' && (config.adminApiBaseUrl.startsWith('/') || config.adminApiBaseUrl.startsWith('https://'))) {
        this.adminBase = config.adminApiBaseUrl.replace(/\/$/, '');
      }
      // Loopback uses the dev proxy; production uses the API on the same HTTPS site.
      if (['localhost', '127.0.0.1', '[::1]'].includes(hostname)
          && typeof config.localAdminApiBaseUrl === 'string'
          && config.localAdminApiBaseUrl.startsWith('/') && !config.localAdminApiBaseUrl.startsWith('//')) {
        this.adminBase = config.localAdminApiBaseUrl.replace(/\/$/, '');
      }
      if (typeof config.weddingCode === 'string' && /^[a-z0-9][a-z0-9-]{0,119}$/.test(config.weddingCode)) this.configuredWedding = config.weddingCode;
    } catch { /* Keep the explicit current-wedding defaults if configuration cannot load. */ }
  }

  get context() { return commercialContext(window.location.pathname, this.configuredWedding); }
  get weddingCode() { return this.configuredWedding ?? 'gabriela-y-juan'; }
  get enabled() { return true; }

  async request<T>(path: string, method = 'GET', body?: unknown, administrative = false): Promise<T> {
    let response: Response;
    try {
      response = await fetch(this.endpoint(path, administrative), {
        method, credentials: administrative ? 'include' : 'omit', cache: 'no-store',
        headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(administrative && method !== 'GET' && this.csrf ? { 'X-CSRF-Token': this.csrf } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(15000),
      });
    } catch { throw new ApiError(0, 'No pudimos conectar con el servidor. Intenta nuevamente.'); }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) this.csrf = '';
      const message = typeof data.detail === 'string' ? data.detail
        : response.status === 429 ? 'Demasiados intentos. Espera unos minutos antes de volver a intentar.'
        : response.status === 422 ? 'Revisa los datos ingresados y selecciona un invitado principal.'
        : 'No pudimos completar la operación.';
      throw new ApiError(response.status, message);
    }
    return data as T;
  }

  publicPath(token: string) {
    return `/public/weddings/${encodeURIComponent(this.weddingCode)}/invitations/${encodeURIComponent(token)}`;
  }
  adminPath() { return `/admin/weddings/${encodeURIComponent(this.weddingCode)}`; }
  photoPath() { return `/public/weddings/${encodeURIComponent(this.weddingCode)}`; }
  photoUploadUrl() { return new URL('upload', document.baseURI).href; }
  endpoint(path: string, administrative = false) { return (administrative ? this.adminBase : this.base) + path; }

  async login(password: string): Promise<WeddingDetails> {
    const result = await this.request<{ csrfToken: string }>('/auth/login', 'POST', { wedding_code: this.weddingCode, password }, true);
    this.csrf = result.csrfToken;
    try { return await this.wedding(); }
    catch (error) { await this.logout().catch(() => {}); throw error; }
  }
  async restore(): Promise<WeddingDetails> {
    const result = await this.request<{ csrfToken: string }>('/auth/me', 'GET', undefined, true);
    this.csrf = result.csrfToken;
    return this.wedding();
  }
  async logout() {
    try { await this.request('/auth/logout', 'POST', undefined, true); }
    finally { this.csrf = ''; }
  }
  wedding() { return this.request<WeddingDetails>(this.adminPath(), 'GET', undefined, true); }
  publicWedding(token: string) { return this.request<WeddingDetails>(this.publicPath(token) + '/wedding'); }
  invitations() { return this.request<Invitation[]>(this.adminPath() + '/invitations', 'GET', undefined, true); }

  invitationUrl(token: string): string {
    const path = encodeURIComponent(token);
    return new URL(path, document.baseURI).href;
  }
}
