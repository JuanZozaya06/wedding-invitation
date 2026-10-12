import { commercialContext } from './commercial-route';

describe('Rutas de una boda por dominio', () => {
  it('resuelve invitaciones y administración sin exponer el código de boda', () => {
    expect(commercialContext('/ABC123')).toEqual({ weddingCode: 'gabriela-y-juan', segment: 'ABC123' });
    expect(commercialContext('/admin')?.segment).toBe('admin');
    expect(commercialContext('/')?.segment).toBe('');
    expect(commercialContext('/wedding-invitation/ABC123')?.segment).toBe('ABC123');
  });
  it('rechaza formatos con dos códigos y caracteres inválidos', () => {
    for (const path of ['/gabriela-y-juan/ABC123', '/abc/def/ghi', '/%2Fadmin', '/%ZZ', '/abc.html']) {
      expect(commercialContext(path)).toBeNull();
    }
  });
  it('permite cambiar la boda del dominio mediante configuración', () => {
    expect(commercialContext('/ABC123', 'otra-boda')?.weddingCode).toBe('otra-boda');
  });
});
