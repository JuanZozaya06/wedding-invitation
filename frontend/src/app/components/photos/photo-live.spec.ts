import { TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { PhotosComponent } from './photos.component';
import { PhotoApiService } from '../../services/photo-api.service';
import { PhotoDemoService } from '../../services/photo-demo.service';

describe('Real photo flow', () => {
  let api: any;
  beforeEach(async () => {
    api = {
      demo: false, initialize: jasmine.createSpy().and.resolveTo(true),
      createBatch: jasmine.createSpy().and.resolveTo({ id: 'batch', token: 'upload-only' }),
      upload: jasmine.createSpy().and.resolveTo(), authenticate: jasmine.createSpy().and.resolveTo(),
      list: jasmine.createSpy().and.resolveTo({ photos: [], nextCursor: null }),
      image: jasmine.createSpy().and.resolveTo(new Blob(['preview'], { type: 'image/jpeg' })),
    };
    await TestBed.configureTestingModule({ imports: [PhotosComponent], providers: [
      { provide: PhotoApiService, useValue: api },
      { provide: PhotoDemoService, useValue: { save: () => { throw new Error('Real photos must not use IndexedDB'); } } },
    ] }).compileComponents();
  });

  it('retries only failed files, reuses its batch and freezes the author/message', async () => {
    const fixture = TestBed.createComponent(PhotosComponent);
    fixture.detectChanges(); await fixture.whenStable();
    const component = fixture.componentInstance;
    component.name = 'María'; component.message = 'Un recuerdo';
    const files = new DataTransfer();
    files.items.add(new File(['one'], 'primera.jpg', { type: 'image/jpeg' }));
    files.items.add(new File(['two'], 'segunda.jpg', { type: 'image/jpeg' }));
    const input = fixture.nativeElement.querySelector('input[type=file]') as HTMLInputElement;
    input.files = files.files; input.dispatchEvent(new Event('change')); fixture.detectChanges();
    let attempt = 0;
    api.upload.and.callFake(async () => { if (++attempt === 2) throw new Error('La conexión se interrumpió.'); });
    await component.send(); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    expect(component.items.map(p => p.state)).toEqual(['done', 'error']);
    expect(component.error).toContain('conexión');
    expect(fixture.nativeElement.querySelector('input[autocomplete=name]')).toBeNull();
    expect(component.step).toBe('review');
    component.goToStep('details');
    expect(component.step).toBe('review');
    expect(api.createBatch).toHaveBeenCalledOnceWith('María', 'Un recuerdo');
    await component.send(); fixture.detectChanges();
    expect(api.upload.calls.count()).toBe(3);
    expect(api.upload.calls.argsFor(0)[1]).toBe(component.items[0].id);
    expect(api.upload.calls.argsFor(2)[1]).toBe(component.items[1].id);
    expect(api.createBatch.calls.count()).toBe(1);
    expect(component.step).toBe('done');
    expect(fixture.nativeElement.textContent).toContain('Tus recuerdos ya están en nuestro álbum privado.');
    component.reset(); expect(component.remoteBatch).toBeNull();
    fixture.destroy();
  });

  it('separates selection, signature, confirmation and completion without losing edits', async () => {
    const fixture = TestBed.createComponent(PhotosComponent);
    fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    const component = fixture.componentInstance;
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector<HTMLInputElement>('input[type=file]')).not.toBeNull();
    expect(root.querySelector('input[autocomplete=name]')).toBeNull();
    expect(root.querySelector('.submit')).toBeNull();
    component.goToStep('details'); expect(component.step).toBe('select');
    const files = new DataTransfer(); files.items.add(new File(['photo'], 'recuerdo.jpg', { type: 'image/jpeg' }));
    const input = root.querySelector<HTMLInputElement>('input[type=file]')!;
    input.files = files.files; input.dispatchEvent(new Event('change')); fixture.detectChanges();
    expect(root.querySelector('.section-title .pick-secondary')!.textContent).toContain('Agregar fotos');
    root.querySelector<HTMLButtonElement>('.submit')!.click(); fixture.detectChanges(); await fixture.whenStable();
    expect(component.step).toBe('details');
    expect(root.querySelector('input[type=file]')).toBeNull();
    const name = root.querySelector<HTMLInputElement>('input[autocomplete=name]')!;
    const message = root.querySelector<HTMLTextAreaElement>('textarea')!;
    expect(parseFloat(getComputedStyle(name).fontSize)).toBeGreaterThanOrEqual(16);
    expect(parseFloat(getComputedStyle(message).fontSize)).toBeGreaterThanOrEqual(16);
    name.value = 'María'; name.dispatchEvent(new Event('input'));
    message.value = '¡Qué alegría!'; message.dispatchEvent(new Event('input')); fixture.detectChanges();
    root.querySelector<HTMLButtonElement>('.submit')!.click(); fixture.detectChanges(); await fixture.whenStable();
    expect(component.step).toBe('review');
    expect(root.querySelector('.review-signature')!.textContent).toContain('María');
    expect(root.querySelector('.review-signature')!.textContent).toContain('¡Qué alegría!');
    expect(api.createBatch).not.toHaveBeenCalled();
    component.goToStep('details'); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    expect(root.querySelector<HTMLInputElement>('input[autocomplete=name]')!.value).toBe('María');
    component.goToStep('review'); fixture.detectChanges();
    root.querySelector<HTMLButtonElement>('.submit')!.click(); await fixture.whenStable(); fixture.detectChanges();
    expect(component.step).toBe('done');
    expect(root.querySelector('.photo-grid')).toBeNull();
    expect(api.createBatch).toHaveBeenCalledOnceWith('María', '¡Qué alegría!');
    root.querySelector<HTMLButtonElement>('.add-more')!.click(); fixture.detectChanges();
    expect(component.step).toBe('select'); expect(component.items.length).toBe(0);
    expect(component.name).toBe('María'); expect(component.message).toBe('');
    fixture.destroy();
  });

  it('shows actual upload progress and protects the page only while a file is uploading', async () => {
    const fixture = TestBed.createComponent(PhotosComponent);
    fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    const component = fixture.componentInstance;
    const files = new DataTransfer(); files.items.add(new File(['photo'], 'recuerdo.jpg', { type: 'image/jpeg' }));
    const input = fixture.nativeElement.querySelector('input[type=file]') as HTMLInputElement;
    input.files = files.files; input.dispatchEvent(new Event('change'));
    let reportProgress!: (value: number) => void;
    let rejectUpload!: (reason: Error) => void;
    api.upload.and.callFake((_batch: unknown, _id: string, _file: File, progress: (value: number) => void) => {
      reportProgress = progress;
      return new Promise<void>((_resolve, reject) => { rejectUpload = reject; });
    });
    const sending = component.send(); await Promise.resolve();
    reportProgress(55); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('progress').value).toBe(55);
    expect(fixture.nativeElement.textContent).toContain('Mantén esta página abierta');
    expect(fixture.nativeElement.textContent).toContain('Subiendo… 55%');
    const leaving = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    component.protectUpload(leaving); expect(leaving.defaultPrevented).toBeTrue();
    reportProgress(90); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Guardando foto…');
    rejectUpload(new Error('Sin conexión')); await sending; fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('progress.failed')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.upload-notice')).toBeNull();
    const afterUpload = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    component.protectUpload(afterUpload); expect(afterUpload.defaultPrevented).toBeFalse();
    fixture.destroy();
  });

  it('disables selection when the backend is unavailable', async () => {
    api.initialize.and.resolveTo(false);
    const fixture = TestBed.createComponent(PhotosComponent);
    fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('input[type=file]').disabled).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Intenta nuevamente más tarde');
    expect(api.createBatch).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('uses the admin session without asking for a second password and searches beyond the loaded page', fakeAsync(() => {
    const fixture = TestBed.createComponent(PhotosComponent);
    const component = fixture.componentInstance;
    component.admin = true;
    fixture.detectChanges(); flushMicrotasks(); fixture.detectChanges();
    expect(api.authenticate).not.toHaveBeenCalled();
    expect(api.list).toHaveBeenCalledWith(null, '');
    component.searchTerm = 'María'; component.searchTerm = 'alegría';
    tick(350); flushMicrotasks();
    expect(api.list).toHaveBeenCalledWith(null, 'alegría');
    expect(api.list.calls.count()).toBe(2);
    fixture.destroy();
  }));
});
