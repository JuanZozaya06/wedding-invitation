import { PhotoApiService } from './photo-api.service';

describe('PhotoApiService configuration', () => {
  it('uses the configured production backend even during local development', async () => {
    const calls = spyOn(window, 'fetch').and.returnValues(
      Promise.resolve(new Response(JSON.stringify({ apiBaseUrl: 'https://photos.example/' }), { status: 200 })),
      Promise.resolve(new Response(JSON.stringify({ uploads_enabled: true }), { status: 200 })),
    );
    const service = new PhotoApiService();
    expect(await service.initialize()).toBeTrue();
    expect(calls.calls.argsFor(1)[0]).toBe('https://photos.example/health');
  });

  it('rejects a configured backend without HTTPS', async () => {
    const calls = spyOn(window, 'fetch').and.returnValue(
      Promise.resolve(new Response(JSON.stringify({ apiBaseUrl: 'http://photos.example' }), { status: 200 })),
    );
    expect(await new PhotoApiService().initialize()).toBeFalse();
    expect(calls).toHaveBeenCalledTimes(1);
  });
});
