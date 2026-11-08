import { Component, inject, ViewChild } from '@angular/core';
import { GalleryComponent } from '../../../photos/gallery/gallery.component';
import { AdminStore } from '../../services/admin.store';
@Component({
  selector: 'app-admin-media',
  standalone: true,
  imports: [GalleryComponent],
  template:
    '<section class="admin-photo-panel" aria-label="Fotos y videos recibidos" tabindex="0"><app-photo-gallery [searchTerm]="vm.adminSearchTerm" /></section>',
  styles: ':host{display:contents}',
})
export class MediaPageComponent {
  readonly vm = inject(AdminStore);
  @ViewChild(GalleryComponent) private gallery?: GalleryComponent;
  canLeave(): boolean {
    return !this.vm.adminAccessGranted || !this.gallery?.deleting;
  }
}
