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
    expect(fixture.nativeElement.querySelector('input[autocomplete=name]').disabled).toBeTrue();
    expect(api.createBatch).toHaveBeenCalledOnceWith('María', 'Un recuerdo');
    await component.send(); fixture.detectChanges();
    expect(api.upload.calls.count()).toBe(3);
    expect(api.upload.calls.argsFor(0)[1]).toBe(component.items[0].id);
    expect(api.upload.calls.argsFor(2)[1]).toBe(component.items[1].id);
    expect(api.createBatch.calls.count()).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('Tus fotos ya están en nuestro álbum privado.');
    component.reset(); expect(component.remoteBatch).toBeNull();
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

  it('authenticates admin on the server and sends searches beyond the loaded page', fakeAsync(() => {
    const fixture = TestBed.createComponent(PhotosComponent);
    const component = fixture.componentInstance;
    component.admin = true; component.adminKey = 'owner-password';
    fixture.detectChanges(); flushMicrotasks(); fixture.detectChanges();
    expect(api.authenticate).toHaveBeenCalledWith('owner-password');
    expect(api.list).toHaveBeenCalledWith(null, '');
    component.searchTerm = 'María'; component.searchTerm = 'alegría';
    tick(350); flushMicrotasks();
    expect(api.list).toHaveBeenCalledWith(null, 'alegría');
    expect(api.list.calls.count()).toBe(2);
    fixture.destroy();
  }));
});
