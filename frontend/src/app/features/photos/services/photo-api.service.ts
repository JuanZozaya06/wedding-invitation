import { Injectable, inject } from '@angular/core';
import { CommercialApiService } from '../../../core/http/commercial-api.service';
import { isVideo } from '../models/media';

type UploadState = {
  state: 'receiving' | 'processing' | 'ready' | 'error';
  offset: number;
  chunkBytes?: number;
};

export interface AlbumPhoto {
  id: string;
  batchId: string;
  name: string;
  message: string;
  createdAt: string;
  fileName: string;
  mimeType: string;
  size: number;
  deletionPending?: boolean;
}
export interface UploadBatch {
  id: string;
  token: string;
}
type AlbumDetails = {
  uploads_enabled: boolean;
  title: string;
  partnerOne: string;
  partnerTwo: string;
  storage: string;
};

@Injectable({ providedIn: 'root' })
export class PhotoApiService {
  readonly demo = false;
  readonly api = inject(CommercialApiService);

  details?: AlbumDetails;

  get invitationUrl(): string {
    return new URL('.', document.baseURI).href;
  }

  async initialize(admin = false): Promise<boolean> {
    try {
      const details = await this.api.request<AlbumDetails>(
        admin
          ? this.api.adminPath() + '/album'
          : this.api.photoPath() + '/album',
        'GET',
        undefined,
        admin,
      );
      this.details = details;
      return admin || details.uploads_enabled;
    } catch {
      this.details = undefined;
      return false;
    }
  }

  createBatch(name: string, message: string): Promise<UploadBatch> {
    return this.api.request(this.api.photoPath() + '/photo-batches', 'POST', {
      name,
      message,
    });
  }

  upload(
    batch: UploadBatch,
    id: string,
    file: File,
    progress: (value: number) => void,
  ): Promise<void> {
    if (isVideo(file)) return this.uploadVideo(batch, id, file, progress);
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const path = `/public/weddings/${encodeURIComponent(this.api.weddingCode)}/photo-batches/${encodeURIComponent(batch.id)}/photos/${encodeURIComponent(id)}/file`;
      xhr.open('POST', this.api.endpoint(path));
      xhr.withCredentials = false;
      xhr.setRequestHeader('Authorization', `Bearer ${batch.token}`);
      xhr.timeout = 300000;
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable)
          progress(Math.min(90, Math.round((event.loaded / event.total) * 90)));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
          return;
        }
        let message = 'No pudimos subir este archivo. Puedes reintentar.';
        try {
          const result = JSON.parse(xhr.responseText);
          if (typeof result.detail === 'string') message = result.detail;
        } catch {
          /* generic message */
        }
        reject(new Error(message));
      };
      xhr.onerror = xhr.ontimeout = () =>
        reject(
          new Error(
            'La conexión se interrumpió. Reintenta los archivos pendientes.',
          ),
        );
      const form = new FormData();
      form.append('file', file);
      xhr.send(form);
    });
  }

  originalUrl(id: string, playback = false): string {
    return this.api.endpoint(
      `${this.api.adminPath()}/photos/${encodeURIComponent(id)}/${playback ? 'playback' : 'original'}`,
      true,
    );
  }

  async discardUploads(batch: UploadBatch, ids: string[]): Promise<void> {
    await Promise.allSettled(
      ids.map((id) =>
        fetch(
          this.api.endpoint(
            `/public/weddings/${encodeURIComponent(this.api.weddingCode)}/photo-batches/${encodeURIComponent(batch.id)}/photos/${encodeURIComponent(id)}/cancel`,
          ),
          {
            method: 'POST',
            credentials: 'omit',
            keepalive: true,
            headers: { Authorization: `Bearer ${batch.token}` },
          },
        ),
      ),
    );
  }

  private async uploadVideo(
    batch: UploadBatch,
    id: string,
    file: File,
    progress: (value: number) => void,
  ): Promise<void> {
    const base = `/public/weddings/${encodeURIComponent(this.api.weddingCode)}/photo-batches/${encodeURIComponent(batch.id)}/photos/${encodeURIComponent(id)}`;
    const initialize = () =>
      this.uploadRequest(base + '/upload', batch, 'POST', {
        file_name: file.name,
        size: file.size,
      });
    let current = await initialize();
    let retries = 0;
    while (
      current.state !== 'ready' &&
      current.state !== 'processing' &&
      current.offset < file.size
    ) {
      const offset = current.offset;
      const end = Math.min(
        offset +
          Math.min(current.chunkBytes || 8 * 1024 * 1024, 8 * 1024 * 1024),
        file.size,
      );
      try {
        current = await this.uploadChunk(
          base + `/chunks?offset=${offset}`,
          batch,
          file.slice(offset, end),
          (loaded) =>
            progress(
              Math.min(90, Math.round(((offset + loaded) / file.size) * 90)),
            ),
        );
        if (current.offset <= offset)
          throw new Error(
            'No pudimos avanzar la subida. Reintenta el archivo.',
          );
        retries = 0;
        progress(Math.min(90, Math.round((current.offset / file.size) * 90)));
      } catch (error) {
        if (++retries > 2) throw error;
        current = await initialize();
      }
    }
    if (current.state === 'ready') {
      progress(100);
      return;
    }
    if (current.state !== 'processing')
      current = await this.uploadRequest(base + '/complete', batch, 'POST');
    const deadline = Date.now() + 30 * 60 * 1000;
    while (current.state === 'processing' && Date.now() < deadline) {
      progress(95);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      current = await this.uploadRequest(base + '/status', batch);
    }
    if (current.state !== 'ready')
      throw new Error(
        'No pudimos terminar de guardar este video. Reintenta: conservamos las partes recibidas.',
      );
    progress(100);
  }

  private async uploadRequest(
    path: string,
    batch: UploadBatch,
    method = 'GET',
    body?: object,
  ): Promise<UploadState> {
    const response = await fetch(this.api.endpoint(path), {
      method,
      credentials: 'omit',
      cache: 'no-store',
      signal: AbortSignal.timeout(60000),
      headers: {
        Authorization: `Bearer ${batch.token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(
        typeof data.detail === 'string'
          ? data.detail
          : 'No pudimos subir el video. Intenta nuevamente.',
      );
    return data;
  }

  private uploadChunk(
    path: string,
    batch: UploadBatch,
    chunk: Blob,
    progress: (loaded: number) => void,
  ): Promise<UploadState> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', this.api.endpoint(path));
      xhr.withCredentials = false;
      xhr.timeout = 240000;
      xhr.setRequestHeader('Authorization', `Bearer ${batch.token}`);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) progress(event.loaded);
      };
      xhr.onload = () => {
        try {
          const result = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) resolve(result);
          else
            reject(
              new Error(
                typeof result.detail === 'string'
                  ? result.detail
                  : 'No pudimos enviar esta parte del video.',
              ),
            );
        } catch {
          reject(new Error('No pudimos enviar esta parte del video.'));
        }
      };
      xhr.onerror = xhr.ontimeout = () =>
        reject(
          new Error(
            'Se interrumpió la conexión. Puedes reintentar desde la última parte recibida.',
          ),
        );
      xhr.send(chunk);
    });
  }

  list(
    cursor: string | null,
    search: string,
  ): Promise<{ photos: AlbumPhoto[]; nextCursor: string | null }> {
    const query = new URLSearchParams({ search });
    if (cursor) query.set('cursor', cursor);
    return this.api.request(
      `${this.api.adminPath()}/photos?${query}`,
      'GET',
      undefined,
      true,
    );
  }

  async image(id: string, original = false): Promise<Blob> {
    const response = await fetch(
      this.api.endpoint(
        `${this.api.adminPath()}/photos/${encodeURIComponent(id)}/${original ? 'original' : 'thumbnail'}`,
        true,
      ),
      {
        credentials: 'include',
        cache: 'no-store',
        signal: AbortSignal.timeout(60000),
      },
    );
    if (response.status === 401) this.api.sessionExpired.next();
    if (!response.ok)
      throw new Error(
        response.status === 401
          ? 'La sesión venció. Vuelve a entrar al panel.'
          : 'No pudimos descargar el archivo. Intenta otra vez.',
      );
    return response.blob();
  }

  async deleteMedia(id: string): Promise<void> {
    await this.api.request(
      `${this.api.adminPath()}/photos/${encodeURIComponent(id)}`,
      'DELETE',
      { confirmationId: id },
      true,
    );
  }
}
