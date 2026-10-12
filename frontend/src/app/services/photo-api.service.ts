import { Injectable, inject } from '@angular/core';
import { CommercialApiService } from './commercial-api.service';

export interface AlbumPhoto {
  id: string; batchId: string; name: string; message: string; createdAt: string;
  fileName: string; mimeType: string; size: number;
}
export interface UploadBatch { id: string; token: string; }
type AlbumDetails = { uploads_enabled: boolean; title: string; partnerOne: string; partnerTwo: string; storage: string };

@Injectable({ providedIn: 'root' })
export class PhotoApiService {
  readonly demo = false;
  readonly api = inject(CommercialApiService);
  private initialization?: Promise<boolean>;
  details?: AlbumDetails;

  get invitationToken(): string { return this.api.context?.segment ?? ''; }
  get invitationUrl(): string { return this.api.invitationUrl(this.invitationToken); }

  initialize(): Promise<boolean> {
    return this.initialization ??= (async () => {
      const admin = this.invitationToken === 'admin';
      if (!this.invitationToken) return false;
      this.details = await this.api.request<AlbumDetails>(admin ? this.api.adminPath() + '/album' : this.api.publicPath(this.invitationToken) + '/album', 'GET', undefined, admin);
      return admin || this.details.uploads_enabled;
    })().catch(() => false);
  }

  createBatch(name: string, message: string): Promise<UploadBatch> {
    return this.api.request(this.api.publicPath(this.invitationToken) + '/photo-batches', 'POST', { name, message });
  }

  upload(batch: UploadBatch, id: string, file: File, progress: (value: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const path = `/public/weddings/${encodeURIComponent(this.api.weddingCode)}/photo-batches/${encodeURIComponent(batch.id)}/photos/${encodeURIComponent(id)}/file`;
      xhr.open('POST', this.api.endpoint(path));
      xhr.withCredentials = false;
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
    return this.api.request(`${this.api.adminPath()}/photos?${query}`, 'GET', undefined, true);
  }

  async image(id: string, original = false): Promise<Blob> {
    const response = await fetch(this.api.endpoint(`${this.api.adminPath()}/photos/${encodeURIComponent(id)}/${original ? 'original' : 'thumbnail'}`, true), {
      credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) throw new Error(response.status === 401 ? 'La sesión venció. Vuelve a entrar al panel.' : 'No pudimos descargar la foto. Intenta otra vez.');
    return response.blob();
  }
}
