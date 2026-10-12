import { CommercialApiService } from './commercial-api.service';

describe('CommercialApiService', () => {
  it('usa el subdominio de producción y reserva el proxy para localhost', async () => {
    const productionApi = 'https://api.labodadelsiglo.app';
    const fetchSpy = spyOn(window, 'fetch').and.callFake(async (input) => new Response(JSON.stringify(
      String(input).endsWith('commercial-config.json')
        ? { apiBaseUrl: productionApi, adminApiBaseUrl: productionApi, localAdminApiBaseUrl: '/api' } : {}
    ), { status: 200 }));
    for (const [hostname, adminBase] of [['labodadelsiglo.app', productionApi], ['localhost', '/api'], ['127.0.0.1', '/api']]) {
      const api = new CommercialApiService();
      await api.initialize(hostname);
      await api.request('/auth/me', 'GET', undefined, true);
      expect(fetchSpy.calls.mostRecent().args[0]).toBe(adminBase + '/auth/me');
      expect(fetchSpy.calls.mostRecent().args[1]?.credentials).toBe('include');
      expect(api.endpoint('/public/photo-upload')).toBe(productionApi + '/public/photo-upload');
    }
  });
  it('consulta Railway directamente y mantiene el login en el proxy del mismo origen', async () => {
    const api = new CommercialApiService();
    const railway = 'https://wedding-api-production-3e17.up.railway.app';
    const fetchSpy = spyOn(window, 'fetch').and.callFake(async (input) => new Response(JSON.stringify(
      String(input).endsWith('commercial-config.json') ? { apiBaseUrl: railway, adminApiBaseUrl: '/api', weddingCode: 'gabriela-y-juan' } : {}
    ), { status: 200 }));
    await api.initialize();
    await api.request('/public/example');
    expect(fetchSpy.calls.mostRecent().args[0]).toBe(railway + '/public/example');
    expect(fetchSpy.calls.mostRecent().args[1]?.credentials).toBe('omit');
    await api.request('/auth/login', 'POST', { wedding_code: 'gabriela-y-juan', password: 'test' }, true);
    expect(fetchSpy.calls.mostRecent().args[0]).toBe('/api/auth/login');
    expect(fetchSpy.calls.mostRecent().args[1]?.credentials).toBe('include');
    expect(api.endpoint('/public/photo-upload')).toBe(railway + '/public/photo-upload');
    expect(api.endpoint('/admin/private-photo', true)).toBe('/api/admin/private-photo');
  });
  it('envía cookies y CSRF solamente en peticiones administrativas', async () => {
    const api = new CommercialApiService();
    const fetchSpy = spyOn(window, 'fetch').and.callFake(async (input, init) => {
      const path = String(input);
      const result = path.endsWith('/auth/login') ? { csrfToken: 'csrf-test' }
        : { slug: 'gabriela-y-juan', partnerOne: 'Gabriela', partnerTwo: 'Juan', events: [] };
      return new Response(JSON.stringify(result), { status: 200 });
    });
    await api.login('password');
    expect(JSON.parse(fetchSpy.calls.first().args[1]!.body as string)).toEqual({ wedding_code: 'gabriela-y-juan', password: 'password' });
    await api.request('/public/weddings/gabriela-y-juan/invitations/ABC123');
    expect(fetchSpy.calls.mostRecent().args[1]?.credentials).toBe('omit');
    await api.request('/admin/example', 'PUT', {}, true);
    const options = fetchSpy.calls.mostRecent().args[1]!;
    expect(options.credentials).toBe('include');
    expect((options.headers as Record<string, string>)['X-CSRF-Token']).toBe('csrf-test');
  });
  it('genera enlaces con solo el código de invitación', () => {
    const api = new CommercialApiService();
    expect(new URL(api.invitationUrl('ABC123')).pathname).toMatch(/\/ABC123$/);
    expect(api.invitationUrl('ABC123')).not.toContain('/gabriela-y-juan/');
  });

  it('comparte un uploader por dominio sin códigos de boda ni de invitación', () => {
    const api = new CommercialApiService();
    const url = new URL(api.photoUploadUrl());
    expect(url.pathname).toMatch(/\/upload$/);
    expect(url.search).toBe('');
    expect(api.photoPath()).toBe('/public/weddings/gabriela-y-juan');
  });
});
