import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PhotoDemoService } from '../services/photo-demo.service';
import { PhotoApiService, UploadBatch } from '../services/photo-api.service';
import { PhotoItem, PhotoStep } from '../models/photo.model';
@Component({
  selector: 'app-photo-upload',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './upload.component.html',
  styleUrl: './upload.component.scss',
})
export class UploadComponent implements OnInit, OnDestroy {
  available = false;

  connecting = true;

  private destroyed = false;

  step: PhotoStep = 'select';

  private focusStep = false;

  get stepNumber(): number {
    return this.step === 'select' ? 1 : this.step === 'details' ? 2 : 3;
  }

  get sharedCount(): number {
    return this.items.filter((item) => item.state === 'done').length;
  }

  @HostListener('window:beforeunload', ['$event'])
  protectUpload(event: BeforeUnloadEvent): void {
    if (!this.busy) return;
    event.preventDefault();
    event.returnValue = '';
  }

  @ViewChild('stepTitle')
  set stepTitle(title: ElementRef<HTMLElement> | undefined) {
    if (!title || !this.focusStep) return;
    this.focusStep = false;
    queueMicrotask(() => {
      if (!this.destroyed && title.nativeElement.isConnected) {
        title.nativeElement.focus({ preventScroll: true });
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
    });
  }

  goToStep(step: 'select' | 'details' | 'review'): void {
    if (
      this.busy ||
      this.remoteBatch ||
      (step !== 'select' && (!this.items.length || !this.available))
    )
      return;
    this.error = '';
    this.focusStep = true;
    this.step = step;
  }

  private readonly api = inject(PhotoApiService);

  get coupleNames(): string {
    const details = this.api.details;
    return details
      ? `${details.partnerOne} & ${details.partnerTwo}`
      : this.demo
        ? 'Gabriela & Juan'
        : 'Nuestra boda';
  }

  get monogram(): string {
    const details = this.api.details;
    return details
      ? `${details.partnerOne[0]}&${details.partnerTwo[0]}`
      : this.demo
        ? 'G&J'
        : '♡';
  }

  get invitationUrl(): string {
    return this.api.invitationUrl || './';
  }

  readonly demo = this.api.demo;

  private readonly store = inject(PhotoDemoService);

  items: PhotoItem[] = [];

  name = '';

  message = '';

  error = '';

  busy = false;

  private batchId = crypto.randomUUID();

  remoteBatch: UploadBatch | null = null;

  get pending(): boolean {
    return this.items.some((p) => p.state === 'ready' || p.state === 'error');
  }

  select(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.error = '';
    for (const file of Array.from(input.files ?? [])) {
      if (this.items.length >= 20) {
        this.error = 'Puedes compartir hasta 20 fotos por tanda.';
        break;
      }
      if (
        !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name) ||
        file.size === 0 ||
        file.size > 20 * 1024 * 1024
      ) {
        this.error =
          'Elige fotos JPG, PNG, WebP o HEIC de hasta 20 MB cada una.';
        continue;
      }
      this.items.push({
        id: crypto.randomUUID(),
        file,
        url: URL.createObjectURL(file),
        name: '',
        message: '',
        progress: 0,
        state: 'ready',
        preview: true,
      });
    }
    input.value = '';
  }

  remove(item: PhotoItem): void {
    URL.revokeObjectURL(item.url);
    this.items = this.items.filter((p) => p !== item);
  }

  async send(): Promise<void> {
    if (!this.available || this.busy || !this.pending) return;
    this.step = 'review';
    this.busy = true;
    this.error = '';
    try {
      if (!this.demo && !this.remoteBatch)
        this.remoteBatch = await this.api.createBatch(
          this.name.trim(),
          this.message.trim(),
        );
      for (const item of this.items.filter((p) => p.state !== 'done')) {
        item.state = 'saving';
        item.progress = 0;
        try {
          if (this.demo)
            await this.store.save({
              id: item.id,
              batchId: this.batchId,
              file: item.file,
              name: this.name.trim(),
              message: this.message.trim(),
              createdAt: new Date().toISOString(),
            });
          else
            await this.api.upload(
              this.remoteBatch!,
              item.id,
              item.file,
              (progress) => {
                item.progress = progress;
              },
            );
          item.progress = 100;
          item.state = 'done';
        } catch (error) {
          item.state = 'error';
          this.error = this.demo
            ? 'No pudimos guardar algunas fotos en este navegador. Puedes reintentar.'
            : error instanceof Error
              ? error.message
              : 'No pudimos subir algunas fotos. Puedes reintentar las pendientes.';
        }
      }
    } catch (error) {
      this.error =
        error instanceof Error
          ? error.message
          : 'No pudimos preparar la tanda. Intenta nuevamente.';
    } finally {
      this.busy = false;
      if (!this.pending) {
        this.focusStep = true;
        this.step = 'done';
      }
    }
  }

  reset(): void {
    this.items.forEach((p) => URL.revokeObjectURL(p.url));
    this.items = [];
    this.batchId = crypto.randomUUID();
    this.remoteBatch = null;
    this.message = '';
    this.error = '';
    this.focusStep = true;
    this.step = 'select';
  }
  async ngOnInit() {
    this.available = this.demo || (await this.api.initialize(false));
    if (!this.destroyed) this.connecting = false;
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.items.forEach((p) => URL.revokeObjectURL(p.url));
  }
}
