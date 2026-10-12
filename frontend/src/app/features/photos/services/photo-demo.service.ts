import { Injectable } from '@angular/core';
export interface DemoPhoto {
  id: string;
  batchId: string;
  file: File;
  name: string;
  message: string;
  createdAt: string;
}
@Injectable({ providedIn: 'root' })
export class PhotoDemoService {
  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('wedding-photo-demo', 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore('photos', { keyPath: 'id' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  async save(photo: DemoPhoto): Promise<void> {
    const db = await this.open();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('photos', 'readwrite');
        tx.objectStore('photos').put(photo);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }
  async list(): Promise<DemoPhoto[]> {
    const db = await this.open();
    try {
      return await new Promise<DemoPhoto[]>((resolve, reject) => {
        const request = db.transaction('photos').objectStore('photos').getAll();
        request.onsuccess = () =>
          resolve(
            request.result.sort((a: DemoPhoto, b: DemoPhoto) =>
              b.createdAt.localeCompare(a.createdAt),
            ),
          );
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  }
}
