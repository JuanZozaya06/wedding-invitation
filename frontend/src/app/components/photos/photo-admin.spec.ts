import { TestBed } from '@angular/core/testing';
import { AppComponent } from '../../app.component';
import { PhotoDemoService } from '../../services/photo-demo.service';
import { PhotoApiService } from '../../services/photo-api.service';

describe('Photo administration', () => {
  beforeEach(async () => {
    const image = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZmcAAAAASUVORK5CYII='), char => char.charCodeAt(0));
    const photos = Array.from({ length: 24 }, (_, index) => ({
      id: `photo-${index}`, batchId: `batch-${index}`, file: new File([image], `recuerdo-${index}.png`, { type: 'image/png' }),
      name: index === 0 ? 'María Pérez' : `Invitado ${index}`, message: index === 0 ? '¡Qué alegría compartir este día!' : 'Un recuerdo de la fiesta.', createdAt: '2026-10-10T00:00:00Z',
    }));
    await TestBed.configureTestingModule({
      imports: [AppComponent], providers: [{ provide: PhotoApiService, useValue: { demo: true } }, { provide: PhotoDemoService, useValue: { list: () => Promise.resolve(photos) } }],
    }).compileComponents();
  });

  for (const [width, height] of [[320, 640], [390, 844], [768, 1024], [844, 390], [1024, 768], [1440, 900]]) {
    it(`scrolls, searches and opens photos at ${width}x${height}`, async () => {
      const fixture = TestBed.createComponent(AppComponent);
      const app = fixture.componentInstance;
      Object.defineProperty(app, 'isAdminRoute', { value: true });
      spyOnProperty(app, 'showNotFoundState', 'get').and.returnValue(false);
      spyOn(app, 'ngOnInit'); spyOn(app, 'ngAfterViewInit');
      app.adminAccessGranted = true; app.activeAdminTab = 'photos';
      fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
      const frame = document.createElement('iframe');
      frame.style.cssText = `width:${width}px;height:${height}px;border:0`;
      document.body.appendChild(frame);
      try {
        const doc = frame.contentDocument!;
        document.querySelectorAll('style').forEach(style => doc.head.appendChild(style.cloneNode(true)));
        const base = doc.createElement('style'); base.textContent = '*{box-sizing:border-box}body{margin:0}'; doc.head.appendChild(base);
        doc.body.appendChild(fixture.nativeElement);
        const root: HTMLElement = fixture.nativeElement;
        const panel = root.querySelector<HTMLElement>('.admin-photo-panel')!;
        expect(root.querySelector('.intro')).toBeNull();
        expect(root.querySelectorAll('.album-card').length).toBe(24);
        expect(root.querySelector('.backoffice-nav [aria-current="page"] svg')).not.toBeNull();
        expect(panel.clientHeight).toBeGreaterThan(height < 500 ? 100 : 300);
        expect(panel.scrollHeight).toBeGreaterThan(panel.clientHeight);
        panel.scrollTop = panel.scrollHeight;
        expect(panel.scrollTop).toBeGreaterThan(0);
        expect(doc.documentElement.scrollWidth).toBeLessThanOrEqual(width);
        expect(doc.documentElement.scrollHeight).toBeLessThanOrEqual(height);
        const search = root.querySelector<HTMLInputElement>('[name="adminSearchTerm"]')!;
        search.value = 'maria'; search.dispatchEvent(new Event('input')); fixture.detectChanges();
        expect(root.querySelectorAll('.album-card').length).toBe(1);
        expect(root.querySelector('.album-caption')!.textContent).toContain('María Pérez');
        search.value = 'ALEGRIA'; search.dispatchEvent(new Event('input')); fixture.detectChanges();
        expect(root.querySelectorAll('.album-card').length).toBe(1);
        root.querySelector<HTMLButtonElement>('.album-thumbnail')!.click(); fixture.detectChanges();
        await fixture.whenStable();
        const dialog = root.querySelector<HTMLDialogElement>('.photo-dialog')!;
        expect(dialog.open).toBeTrue(); expect(dialog.matches(':modal')).toBeTrue();
        expect(dialog.getBoundingClientRect().width).toBeLessThanOrEqual(width);
        expect(dialog.getBoundingClientRect().height).toBeLessThanOrEqual(height);
        root.querySelector<HTMLButtonElement>('.dialog-close')!.click(); fixture.detectChanges();
        expect(root.querySelector('.photo-dialog')).toBeNull();
        search.value = 'no-existe'; search.dispatchEvent(new Event('input')); fixture.detectChanges();
        expect(root.querySelectorAll('.album-card').length).toBe(0);
        expect(root.querySelector('.album-empty')!.textContent).toContain('No hay fotos');
        search.value = 'recuerdo-23.png'; search.dispatchEvent(new Event('input')); fixture.detectChanges();
        expect(root.querySelectorAll('.album-card').length).toBe(1);
      } finally { fixture.destroy(); frame.remove(); }
    });
  }
});
