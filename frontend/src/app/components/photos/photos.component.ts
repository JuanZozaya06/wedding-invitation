import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PhotoDemoService } from '../../services/photo-demo.service';
import { PhotoApiService, UploadBatch } from '../../services/photo-api.service';
type PhotoItem = { id: string; file: File; url: string; name: string; message: string; progress: number; state: 'ready' | 'saving' | 'done' | 'error'; preview: boolean; createdAt?: string; };
@Component({ selector: 'app-photos', standalone: true, imports: [CommonModule, FormsModule], templateUrl: './photos.component.html', styleUrls: ['./photos.component.scss'] })
export class PhotosComponent implements OnInit, OnDestroy {
  @Input() admin = false;
  @Input() adminKey = '';
  private query = '';
  private initialized = false;
  private searchTimer?: ReturnType<typeof setTimeout>;
  @Input() set searchTerm(value: string) {
    this.query = value;
    if (!this.initialized || this.demo || !this.admin) return;
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { void this.refresh(); }, 350);
  }
  get searchTerm(): string { return this.query; }
  loading = false;
  available = false;
  connecting = true;
  nextCursor: string | null = null;
  downloading = '';
  private generation = 0;
  selected: PhotoItem | null = null;
  private destroyed = false;

  @ViewChild('photoDialog')
  set photoDialog(dialog: ElementRef<HTMLDialogElement> | undefined) {
    if (!dialog) return;
    queueMicrotask(() => {
      const element = dialog.nativeElement;
      if (element.isConnected && this.selected && !element.open) element.showModal();
    });
  }

  get filteredItems(): PhotoItem[] {
    const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const query = normalize(this.searchTerm.trim());
    return query ? this.items.filter(item => normalize(`${item.name || 'Un invitado'} ${item.message} ${item.file.name}`).includes(query)) : this.items;
  }

  formatDate(value?: string): string {
    return value ? new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '';
  }
  private readonly api = inject(PhotoApiService);
  readonly demo = this.api.demo;
  private readonly store = inject(PhotoDemoService);
  items: PhotoItem[] = []; name = ''; message = ''; error = ''; busy = false;
  private batchId = crypto.randomUUID();
  remoteBatch: UploadBatch | null = null;
  get pending(): boolean { return this.items.some(p => p.state === 'ready' || p.state === 'error'); }
  async ngOnInit(): Promise<void> {
    this.available = this.demo || await this.api.initialize();
    this.connecting = false;
    this.initialized = true;
    if (this.admin) await this.refresh();
  }

  async refresh(append = false): Promise<void> {
    if (!this.available || (append && this.loading)) return;
    const generation = ++this.generation;
    this.loading = true;
    this.error = '';
    try {
      if (!this.demo) await this.api.authenticate(this.adminKey.trim());
      const result = this.demo ? null : await this.api.list(append ? this.nextCursor : null, this.searchTerm.trim());
      const records = this.demo ? await this.store.list() : [];
      if (this.destroyed || generation !== this.generation) return;
      this.selected = null;
      if (!append) { this.items.forEach(item => URL.revokeObjectURL(item.url)); this.items = []; }
      if (this.demo) {
        this.items = records.map(photo => ({ ...photo, url: URL.createObjectURL(photo.file), progress: 100, state: 'done', preview: true }));
      } else if (result) {
        this.nextCursor = result.nextCursor;
        const additions: PhotoItem[] = result.photos.map(photo => ({ ...photo,
          file: new File([], photo.fileName, { type: photo.mimeType }), url: '', progress: 100, state: 'done', preview: true,
        }));
        this.items = [...this.items, ...additions];
        // Four concurrent preview requests keep mobile memory/network use bounded.
        const queue = [...additions];
        await Promise.all(Array.from({ length: 4 }, async () => {
          while (queue.length && !this.destroyed && generation === this.generation) {
            const photo = queue.shift()!;
            try {
              const url = URL.createObjectURL(await this.api.image(photo.id));
              if (this.destroyed || generation !== this.generation) URL.revokeObjectURL(url);
              else photo.url = url;
            } catch { photo.preview = false; }
          }
        }));
      }
    } catch (error) {
      if (generation === this.generation) this.error = this.demo ? 'No pudimos leer las fotos de prueba. Intenta actualizar de nuevo.' : error instanceof Error ? error.message : 'No pudimos leer el álbum. Intenta nuevamente.';
    } finally { if (generation === this.generation) this.loading = false; }
  }

  async download(item: PhotoItem, event: Event): Promise<void> {
    if (this.demo) return;
    event.preventDefault();
    if (this.downloading) return;
    this.downloading = item.id;
    try {
      await this.api.authenticate(this.adminKey.trim());
      const url = URL.createObjectURL(await this.api.image(item.id, true));
      const link = document.createElement('a'); link.href = url; link.download = item.file.name; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { this.error = error instanceof Error ? error.message : 'No pudimos descargar la foto.'; }
    finally { this.downloading = ''; }
  }

  select(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.error = '';
    for (const file of Array.from(input.files ?? [])) {
      if (this.items.length >= 20) { this.error = 'Puedes compartir hasta 20 fotos por tanda.'; break; }
      if (!/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name) || file.size === 0 || file.size > 20 * 1024 * 1024) {
        this.error = 'Elige fotos JPG, PNG, WebP o HEIC de hasta 20 MB cada una.'; continue;
      }
      this.items.push({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file), name: '', message: '', progress: 0, state: 'ready', preview: true });
    }
    input.value = '';
  }
  remove(item: PhotoItem): void { URL.revokeObjectURL(item.url); this.items = this.items.filter(p => p !== item); }
  async send(): Promise<void> {
    if (!this.available || this.busy || !this.pending) return;
    this.busy = true; this.error = '';
    try {
      if (!this.demo && !this.remoteBatch) this.remoteBatch = await this.api.createBatch(this.name.trim(), this.message.trim());
      for (const item of this.items.filter(p => p.state !== 'done')) {
        item.state = 'saving'; item.progress = 0;
        try {
          if (this.demo) await this.store.save({ id: item.id, batchId: this.batchId, file: item.file, name: this.name.trim(), message: this.message.trim(), createdAt: new Date().toISOString() });
          else await this.api.upload(this.remoteBatch!, item.id, item.file, progress => { item.progress = progress; });
          item.progress = 100; item.state = 'done';
        } catch (error) { item.state = 'error'; this.error = this.demo ? 'No pudimos guardar algunas fotos en este navegador. Puedes reintentar.' : error instanceof Error ? error.message : 'No pudimos subir algunas fotos. Puedes reintentar las pendientes.'; }
      }
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No pudimos preparar la tanda. Intenta nuevamente.';
    } finally { this.busy = false; }
  }
  reset(): void { this.items.forEach(p => URL.revokeObjectURL(p.url)); this.items = []; this.batchId = crypto.randomUUID(); this.remoteBatch = null; this.message = ''; this.error = ''; }
  ngOnDestroy(): void { this.destroyed = true; clearTimeout(this.searchTimer); this.items.forEach(p => URL.revokeObjectURL(p.url)); }
}
