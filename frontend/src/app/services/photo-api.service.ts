import { Injectable, isDevMode } from '@angular/core';
import { getCurrentAppInstance } from '../firebase/app-instance';

export interface AlbumPhoto {
  id: string; batchId: string; name: string; message: string; createdAt: string;
  fileName: string; mimeType: string; size: number;
}
export interface UploadBatch { id: string; token: string; }

@Injectable({ providedIn: 'root' })
export class PhotoApiService {
  readonly demo = getCurrentAppInstance().key === 'demo';
  private base = '';
  private initialization?: Promise<boolean>;
  private token = '';
  private expiresAt = 0;

  initialize(): Promise<boolean> {
    return this.initialization ??= (async () => {
      if (this.demo) return true;
      const config = await fetch(`${document.baseURI}photos-config.json`, { cache: 'no-store' });
      const value = config.ok ? (await config.json()).apiBaseUrl : '';
      if (typeof value === 'string' && value.startsWith('https://')) {
        this.base = value.replace(/\/$/, '');
      } else if (isDevMode() && ['127.0.0.1', 'localhost'].includes(location.hostname) && !value) {
        this.base = 'http://127.0.0.1:8000';
      } else {
        return false;
      }
      const health = await this.request('/health');
      return health.uploads_enabled === true;
    })().catch(() => false);
  }

  private async request(path: string, options: RequestInit = {}): Promise<any> {
    const response = await fetch(this.base + path, { ...options, cache: 'no-store', signal: AbortSignal.timeout(45000) });
    const data = await response.json();
    if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'No pudimos completar la operación. Intenta nuevamente.');
    return data;
  }

  async authenticate(key: string): Promise<void> {
    if (this.token && Date.now() < this.expiresAt) return;
    const result = await this.request('/api/admin/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) });
    this.token = result.token;
    this.expiresAt = Date.now() + (result.expiresIn - 60) * 1000;
  }

  createBatch(name: string, message: string): Promise<UploadBatch> {
    return this.request('/api/photo-batches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, message }) });
  }

  upload(batch: UploadBatch, id: string, file: File, progress: (value: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${this.base}/api/photo-batches/${batch.id}/photos/${id}/file`);
      xhr.setRequestHeader('Authorization', `Bearer ${batch.token}`);
      xhr.timeout = 300000;
      xhr.upload.onprogress = event => { if (event.lengthComputable) progress(Math.min(90, Math.round(event.loaded / event.total * 90))); };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) { resolve(); return; }
        let message = 'No pudimos subir esta foto. Puedes reintentar.';
        try { const result = JSON.parse(xhr.responseText); if (typeof result.detail === 'string') message = result.detail; } catch { /* generic message */ }
        reject(new Error(message));
      };
      xhr.onerror = xhr.ontimeout = () => reject(new Error('La conexión se interrumpió. Reintenta las fotos pendientes.'));
      const form = new FormData(); form.append('file', file); xhr.send(form);
    });
  }

  list(cursor: string | null, search: string): Promise<{ photos: AlbumPhoto[]; nextCursor: string | null }> {
    const query = new URLSearchParams({ search });
    if (cursor) query.set('cursor', cursor);
    return this.request(`/api/admin/photos?${query}`, { headers: { Authorization: `Bearer ${this.token}` } });
  }

  async image(id: string, original = false): Promise<Blob> {
    const response = await fetch(`${this.base}/api/admin/photos/${id}/${original ? 'original' : 'thumbnail'}`, {
      headers: { Authorization: `Bearer ${this.token}` }, cache: 'no-store', signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) throw new Error(response.status === 401 ? 'La sesión venció. Actualiza las fotos para volver a entrar.' : 'No pudimos descargar la foto. Intenta otra vez.');
    return response.blob();
  }
}
