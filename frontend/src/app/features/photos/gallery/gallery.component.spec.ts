import { TestBed } from '@angular/core/testing';
import { GalleryComponent } from './gallery.component';
import { PhotoDemoService } from '../services/photo-demo.service';
import { PhotoApiService } from '../services/photo-api.service';

function rootStyle(root: HTMLElement) {
  root.style.cssText = 'display:block;height:100vh;overflow:auto';
}
describe('Photo administration', () => {
  beforeEach(async () => {
    const image = Uint8Array.from(
      atob(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZmcAAAAASUVORK5CYII=',
      ),
      (char) => char.charCodeAt(0),
    );
    const photos = Array.from({ length: 24 }, (_, index) => ({
      id: `photo-${index}`,
      batchId: `batch-${index}`,
      file: new File([image], `recuerdo-${index}.png`, { type: 'image/png' }),
      name: index === 0 ? 'María Pérez' : `Invitado ${index}`,
      message:
        index === 0
          ? '¡Qué alegría compartir este día!'
          : 'Un recuerdo de la fiesta.',
      createdAt: '2026-10-10T00:00:00Z',
    }));
    await TestBed.configureTestingModule({
      imports: [GalleryComponent],
      providers: [
        { provide: PhotoApiService, useValue: { demo: true } },
        {
          provide: PhotoDemoService,
          useValue: { list: () => Promise.resolve(photos) },
        },
      ],
    }).compileComponents();
  });

  it('shows connection and loading states before an empty album is confirmed', async () => {
    let connect!: (value: boolean) => void;
    let finish!: (value: { photos: []; nextCursor: null }) => void;
    TestBed.overrideProvider(PhotoApiService, {
      useValue: {
        demo: false,
        initialize: () => new Promise<boolean>((done) => (connect = done)),
        list: () => new Promise((done) => (finish = done)),
      },
    });
    const fixture = TestBed.createComponent(GalleryComponent);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('.album-empty')?.textContent).toContain(
      'Conectando',
    );
    expect(root.querySelector('.album-toolbar')?.textContent).not.toContain(
      '0 fotos',
    );
    expect(root.querySelector('.album-toolbar')?.textContent).not.toContain(
      'Sin conectar',
    );
    connect(true);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(root.querySelector('.album-empty')?.textContent).toContain(
      'Cargando',
    );
    finish({ photos: [], nextCursor: null });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(root.querySelector('.album-empty')?.textContent).toContain(
      'Todavía no han compartido fotos',
    );
    expect(root.querySelector('.album-toolbar')?.textContent).toContain(
      '0 fotos',
    );
    fixture.destroy();
  });

  it('shows a failed album request without claiming that the album is empty', async () => {
    TestBed.overrideProvider(PhotoApiService, {
      useValue: {
        demo: false,
        initialize: () => Promise.resolve(true),
        list: () => Promise.reject(new Error('Sin conexión')),
      },
    });
    const fixture = TestBed.createComponent(GalleryComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('.error')?.textContent).toContain('Sin conexión');
    expect(root.querySelector('.album-empty')).toBeNull();
    expect(root.querySelector('.album-toolbar')?.textContent).not.toContain(
      '0 fotos',
    );
    fixture.destroy();
  });

  it('loads only the video poster for the grid and uses private playback on demand', async () => {
    const image = jasmine
      .createSpy()
      .and.resolveTo(new Blob(['poster'], { type: 'image/jpeg' }));
    TestBed.overrideProvider(PhotoApiService, {
      useValue: {
        demo: false,
        initialize: () => Promise.resolve(true),
        image,
        list: () =>
          Promise.resolve({
            photos: [
              {
                id: 'clip',
                batchId: 'batch',
                fileName: 'baile.mp4',
                mimeType: 'video/mp4',
                size: 250000000,
                name: 'María',
                message: '',
                createdAt: '2026-10-24T00:00:00Z',
              },
            ],
            nextCursor: null,
          }),
        originalUrl: (_id: string, playback: boolean) =>
          playback ? '/fixture-video/playback' : '/fixture-video/original',
      },
    });
    const fixture = TestBed.createComponent(GalleryComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('video')).toBeNull();
    expect(image).toHaveBeenCalledOnceWith('clip');
    root.querySelector<HTMLButtonElement>('.album-thumbnail')!.click();
    fixture.detectChanges();
    const video = root.querySelector<HTMLVideoElement>('video')!;
    expect(video.controls).toBeTrue();
    expect(video.autoplay).toBeFalse();
    expect(video.getAttribute('crossorigin')).toBe('use-credentials');
    expect(video.getAttribute('src')).toBe('/fixture-video/playback');
    expect(
      root
        .querySelector<HTMLAnchorElement>('.photo-dialog a')!
        .getAttribute('href'),
    ).toBe('/fixture-video/original');
    expect(image.calls.count()).toBe(1);
    video.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(root.querySelector('.photo-dialog')?.textContent).toContain(
      'Este navegador no puede reproducir',
    );
    fixture.destroy();
  });

  for (const mimeType of ['image/jpeg', 'video/mp4']) {
    it(`confirms deletion of ${mimeType}, preserves failures and blocks duplicate submissions`, async () => {
      const remove = jasmine.createSpy('deleteMedia').and.rejectWith(new Error('No pudimos completar la eliminación.'));
      const image = jasmine.createSpy('image').and.resolveTo(new Blob(['preview'], { type: 'image/jpeg' }));
      TestBed.overrideProvider(PhotoApiService, { useValue: {
        demo: false, initialize: () => Promise.resolve(true), image, deleteMedia: remove,
        originalUrl: () => '/fixture-media',
        list: () => Promise.resolve({ photos: [
          { id: 'selected-id', fileName: 'recuerdo', mimeType, name: 'Prueba', message: '', createdAt: '2026-11-07T20:00:00Z' },
        ], nextCursor: null }),
      }});
      const fixture = TestBed.createComponent(GalleryComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const app = fixture.componentInstance;
      const root: HTMLElement = fixture.nativeElement;
      root.querySelector<HTMLButtonElement>('.album-thumbnail')!.click();
      fixture.detectChanges();
      await fixture.whenStable();
      const trigger = root.querySelector<HTMLButtonElement>('.media-delete-button')!;
      trigger.click();
      fixture.detectChanges();
      await fixture.whenStable();
      expect(remove).not.toHaveBeenCalled();
      expect(root.querySelector('.media-delete-dialog')?.textContent).toContain('Esta acción no se puede deshacer');
      expect(document.activeElement?.textContent).toContain('Cancelar');
      root.querySelector<HTMLButtonElement>('.media-delete-dialog [autofocus]')!.click();
      fixture.detectChanges();
      expect(app.selected).not.toBeNull();
      expect(document.activeElement).toBe(trigger);
      trigger.click();
      fixture.detectChanges();
      await fixture.whenStable();
      root.querySelector<HTMLButtonElement>('.media-delete-solid')!.click();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(app.items.length).toBe(1);
      expect(root.querySelector('.media-delete-dialog .error')?.textContent).toContain('No pudimos completar');
      let finish!: () => void;
      remove.and.returnValue(new Promise<void>(resolve => finish = resolve));
      const pending = app.confirmDeletion();
      await app.confirmDeletion();
      app.close();
      app.cancelDeletion();
      expect(app.selected).not.toBeNull();
      expect(app.deleting).toBeTrue();
      expect(remove).toHaveBeenCalledTimes(2);
      finish();
      await pending;
      fixture.detectChanges();
      expect(app.items).toEqual([]);
      expect(app.selected).toBeNull();
      expect(app.deleting).toBeFalse();
      fixture.destroy();
    });
  }

  it('keeps incomplete deletions accessible for retry without requesting deleted previews', async () => {
    const image = jasmine.createSpy('image');
    TestBed.overrideProvider(PhotoApiService, { useValue: {
      demo: false, initialize: () => Promise.resolve(true), image,
      list: () => Promise.resolve({ photos: [
        { id: 'pending', fileName: 'video.mp4', mimeType: 'video/mp4', name: 'Prueba', message: '', deletionPending: true },
      ], nextCursor: null }),
    }});
    const fixture = TestBed.createComponent(GalleryComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(image).not.toHaveBeenCalled();
    root.querySelector<HTMLButtonElement>('.album-thumbnail')!.click();
    fixture.detectChanges();
    expect(root.querySelector('video')).toBeNull();
    expect(root.querySelector('.photo-dialog a')).toBeNull();
    expect(root.querySelector('.photo-dialog .media-delete-button')?.textContent).toContain('Eliminar video');
    fixture.destroy();
  });

  for (const [width, height] of [
    [320, 640],
    [390, 844],
    [768, 1024],
    [844, 390],
    [1024, 768],
    [1440, 900],
  ]) {
    it(`scrolls, searches and opens photos at ${width}x${height}`, async () => {
      const fixture = TestBed.createComponent(GalleryComponent);
      const app = fixture.componentInstance;

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const frame = document.createElement('iframe');
      frame.style.cssText = `width:${width}px;height:${height}px;border:0`;
      document.body.appendChild(frame);
      try {
        const doc = frame.contentDocument!;
        document
          .querySelectorAll('style')
          .forEach((style) => doc.head.appendChild(style.cloneNode(true)));
        const base = doc.createElement('style');
        base.textContent = '*{box-sizing:border-box}body{margin:0}';
        doc.head.appendChild(base);
        rootStyle(fixture.nativeElement);
        doc.body.appendChild(fixture.nativeElement);
        const root: HTMLElement = fixture.nativeElement;
        const panel = root;
        expect(root.querySelector('.intro')).toBeNull();
        expect(root.querySelectorAll('.album-card').length).toBe(24);
        expect(panel.scrollHeight).toBeGreaterThan(panel.clientHeight);
        panel.scrollTop = panel.scrollHeight;
        expect(panel.scrollTop).toBeGreaterThan(0);
        expect(doc.documentElement.scrollWidth).toBeLessThanOrEqual(width);
        app.searchTerm = 'maria';
        fixture.detectChanges();
        expect(root.querySelectorAll('.album-card').length).toBe(1);
        expect(root.querySelector('.album-caption')!.textContent).toContain(
          'María Pérez',
        );
        app.searchTerm = 'ALEGRIA';
        fixture.detectChanges();
        expect(root.querySelectorAll('.album-card').length).toBe(1);
        root.querySelector<HTMLButtonElement>('.album-thumbnail')!.click();
        fixture.detectChanges();
        await fixture.whenStable();
        const dialog = root.querySelector<HTMLDialogElement>('.photo-dialog')!;
        expect(dialog.open).toBeTrue();
        expect(dialog.matches(':modal')).toBeTrue();
        expect(dialog.getBoundingClientRect().width).toBeLessThanOrEqual(width);
        expect(dialog.getBoundingClientRect().height).toBeLessThanOrEqual(
          height,
        );
        root.querySelector<HTMLButtonElement>('.dialog-close')!.click();
        fixture.detectChanges();
        expect(root.querySelector('.photo-dialog')).toBeNull();
        app.searchTerm = 'no-existe';
        fixture.detectChanges();
        expect(root.querySelectorAll('.album-card').length).toBe(0);
        expect(root.querySelector('.album-empty')!.textContent).toContain(
          'No hay fotos',
        );
        app.searchTerm = 'recuerdo-23.png';
        fixture.detectChanges();
        expect(root.querySelectorAll('.album-card').length).toBe(1);
      } finally {
        fixture.destroy();
        frame.remove();
      }
    });
  }
});
