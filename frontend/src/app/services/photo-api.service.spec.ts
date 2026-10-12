import { TestBed } from '@angular/core/testing';
import { CommercialApiService } from './commercial-api.service';
import { PhotoApiService } from './photo-api.service';

describe('PhotoApiService', () => {
  let commercial: CommercialApiService;
  let service: PhotoApiService;
  beforeEach(() => {
    TestBed.configureTestingModule({});
    commercial = TestBed.inject(CommercialApiService);
    service = TestBed.inject(PhotoApiService);
  });

  it('uses the wedding admin cookie for the gallery and downloads', async () => {
    spyOnProperty(commercial, 'context', 'get').and.returnValue({ weddingCode: commercial.weddingCode, segment: 'admin' });
    const requests = spyOn(commercial, 'request').and.resolveTo({ uploads_enabled: false, title: 'Prueba' });
    expect(await service.initialize()).toBeTrue();
    expect(requests).toHaveBeenCalledWith(commercial.adminPath() + '/album', 'GET', undefined, true);
    await service.list(null, 'María');
    expect(requests.calls.mostRecent().args[3]).toBeTrue();
    const fetches = spyOn(window, 'fetch').and.resolveTo(new Response(new Blob(['photo'])));
    await service.image('photo-id');
    expect(fetches.calls.mostRecent().args[1]?.credentials).toBe('include');
    expect(String(fetches.calls.mostRecent().args[0])).toContain('/admin/weddings/gabriela-y-juan/photos/photo-id/thumbnail');
  });

  it('validates the invitation before enabling uploads and scopes batches to its wedding', async () => {
    spyOnProperty(commercial, 'context', 'get').and.returnValue({ weddingCode: commercial.weddingCode, segment: 'ABC123' });
    const requests = spyOn(commercial, 'request').and.resolveTo({ uploads_enabled: true });
    expect(await service.initialize()).toBeTrue();
    expect(requests).toHaveBeenCalledWith(commercial.publicPath('ABC123') + '/album', 'GET', undefined, false);
    await service.createBatch('María', '¡Felicidades!');
    expect(requests).toHaveBeenCalledWith(commercial.publicPath('ABC123') + '/photo-batches', 'POST', { name: 'María', message: '¡Felicidades!' });
  });

  it('disables uploads when the invitation is invalid without consulting the legacy backend', async () => {
    spyOnProperty(commercial, 'context', 'get').and.returnValue({ weddingCode: commercial.weddingCode, segment: 'WRONG1' });
    spyOn(commercial, 'request').and.rejectWith(new Error('Invitación no encontrada.'));
    const fetches = spyOn(window, 'fetch');
    expect(await service.initialize()).toBeFalse();
    expect(fetches).not.toHaveBeenCalled();
  });

  it('uploads with a batch credential and no admin password', async () => {
    const xhr = { open: jasmine.createSpy(), setRequestHeader: jasmine.createSpy(), upload: {}, status: 200, withCredentials: true,
      onload: () => {}, send: jasmine.createSpy() };
    xhr.send.and.callFake(() => xhr.onload());
    spyOn(window, 'XMLHttpRequest').and.returnValue(xhr as unknown as XMLHttpRequest);
    await service.upload({ id: 'batch-id', token: 'upload-only' }, 'photo-id', new File(['photo'], 'foto.jpg'), () => {});
    expect(xhr.open).toHaveBeenCalledWith('POST', '/api/public/weddings/gabriela-y-juan/photo-batches/batch-id/photos/photo-id/file');
    expect(xhr.setRequestHeader).toHaveBeenCalledOnceWith('Authorization', 'Bearer upload-only');
    expect(xhr.withCredentials).toBeFalse();
  });
});
