describe('api.js', () => {

  beforeEach(() => {
    jest.resetModules();
    delete process.env.NEXT_PUBLIC_API_URL;
    delete process.env.NEXT_PUBLIC_RENDER_API_URL;
  });

  test('getApiBaseUrl retorna localhost en modo test', () => {
    const { getApiBaseUrl } = require('../src/lib/api.js');
    expect(getApiBaseUrl()).toBe('http://localhost:3001');
  });

  test('getApiBaseUrl retorna URL configurada sin slash final', () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://mi-backend.render.com/';
    const { getApiBaseUrl } = require('../src/lib/api.js');
    expect(getApiBaseUrl()).toBe('https://mi-backend.render.com');
  });

  test('isLocalBrowser retorna false cuando hostname no es localhost', () => {
    delete window.location;
    window.location = { hostname: 'example.com' };
    process.env.NEXT_PUBLIC_API_URL = 'https://mi-backend.render.com';
    const { getApiBaseUrl } = require('../src/lib/api.js');
    expect(getApiBaseUrl()).toBe('https://mi-backend.render.com');
    delete window.location;
    window.location = { hostname: 'localhost' };
  });

  test('getApiBaseUrl lanza error en producción sin URL', () => {
    delete window.location;
    window.location = { hostname: 'example.com' };
    process.env.NODE_ENV = 'production';
    const { getApiBaseUrl } = require('../src/lib/api.js');
    expect(() => getApiBaseUrl()).toThrow('Falta configurar');
    process.env.NODE_ENV = 'test';
    delete window.location;
    window.location = { hostname: 'localhost' };
  });

  test('apiUrl agrega slash si el path no lo tiene', () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://mi-backend.render.com';
    const { apiUrl } = require('../src/lib/api.js');
    expect(apiUrl('usuarios')).toBe('https://mi-backend.render.com/usuarios');
  });

  test('apiUrl no duplica slash si el path ya lo tiene', () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://mi-backend.render.com';
    const { apiUrl } = require('../src/lib/api.js');
    expect(apiUrl('/usuarios')).toBe('https://mi-backend.render.com/usuarios');
  });

});