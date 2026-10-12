import {
  Component,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PhotoDemoService } from '../services/photo-demo.service';
import { PhotoApiService } from '../services/photo-api.service';
import { PhotoItem } from '../models/photo.model';
@Component({
  selector: 'app-photo-gallery',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './gallery.component.html',
  styleUrl: './gallery.component.scss',
})
export class GalleryComponent implements OnInit, OnDestroy {
  private query = '';

  private initialized = false;

  private searchTimer?: ReturnType<typeof setTimeout>;

  @Input() set searchTerm(value: string) {
    this.query = value;
    if (!this.initialized || this.demo) return;
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      void this.refresh();
    }, 350);
  }

  get searchTerm(): string {
    return this.query;
  }

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
      if (element.isConnected && this.selected && !element.open)
        element.showModal();
    });
  }

  get filteredItems(): PhotoItem[] {
    const normalize = (value: string) =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    const query = normalize(this.searchTerm.trim());
    return query
      ? this.items.filter((item) =>
          normalize(
            `${item.name || 'Un invitado'} ${item.message} ${item.file.name}`,
          ).includes(query),
        )
      : this.items;
  }

  formatDate(value?: string): string {
    return value
      ? new Intl.DateTimeFormat('es', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(new Date(value))
      : '';
  }

  private readonly api = inject(PhotoApiService);

  get albumLabel(): string {
    return this.api.details?.storage === 'drive'
      ? 'Google Drive · Álbum privado'
      : 'Álbum privado';
  }

  readonly demo = this.api.demo;

  private readonly store = inject(PhotoDemoService);

  items: PhotoItem[] = [];

  async refresh(append = false): Promise<void> {
    if (!this.available || (append && this.loading)) return;
    const generation = ++this.generation;
    this.loading = true;
    this.error = '';
    try {
      const result = this.demo
        ? null
        : await this.api.list(
            append ? this.nextCursor : null,
            this.searchTerm.trim(),
          );
      const records = this.demo ? await this.store.list() : [];
      if (this.destroyed || generation !== this.generation) return;
      this.selected = null;
      if (!append) {
        this.items.forEach((item) => URL.revokeObjectURL(item.url));
        this.items = [];
      }
      if (this.demo) {
        this.items = records.map((photo) => ({
          ...photo,
          url: URL.createObjectURL(photo.file),
          progress: 100,
          state: 'done',
          preview: true,
        }));
      } else if (result) {
        this.nextCursor = result.nextCursor;
        const additions: PhotoItem[] = result.photos.map((photo) => ({
          ...photo,
          file: new File([], photo.fileName, { type: photo.mimeType }),
          url: '',
          progress: 100,
          state: 'done',
          preview: true,
        }));
        this.items = [...this.items, ...additions];
        // Four concurrent preview requests keep mobile memory/network use bounded.
        const queue = [...additions];
        await Promise.all(
          Array.from({ length: 4 }, async () => {
            while (
              queue.length &&
              !this.destroyed &&
              generation === this.generation
            ) {
              const photo = queue.shift()!;
              try {
                const url = URL.createObjectURL(await this.api.image(photo.id));
                if (this.destroyed || generation !== this.generation)
                  URL.revokeObjectURL(url);
                else photo.url = url;
              } catch {
                photo.preview = false;
              }
            }
          }),
        );
      }
    } catch (error) {
      if (generation === this.generation)
        this.error = this.demo
          ? 'No pudimos leer las fotos de prueba. Intenta actualizar de nuevo.'
          : error instanceof Error
            ? error.message
            : 'No pudimos leer el álbum. Intenta nuevamente.';
    } finally {
      if (generation === this.generation) this.loading = false;
    }
  }

  async download(item: PhotoItem, event: Event): Promise<void> {
    if (this.demo) return;
    event.preventDefault();
    if (this.downloading) return;
    this.downloading = item.id;
    try {
      const url = URL.createObjectURL(await this.api.image(item.id, true));
      const link = document.createElement('a');
      link.href = url;
      link.download = item.file.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      this.error =
        error instanceof Error
          ? error.message
          : 'No pudimos descargar la foto.';
    } finally {
      this.downloading = '';
    }
  }
  error = '';
  async ngOnInit() {
    this.available = this.demo || (await this.api.initialize(true));
    this.connecting = false;
    this.initialized = true;
    await this.refresh();
  }
  ngOnDestroy() {
    this.destroyed = true;
    clearTimeout(this.searchTimer);
    this.items.forEach((p) => URL.revokeObjectURL(p.url));
  }
}
