const supertest = require('supertest');
const { createQueryMock } = require('./helpers');

let mockSignInWithPassword;
let mockFromImpl;

jest.mock('../src/supabaseClient', () => ({
    auth: {
        signInWithPassword: (...args) => mockSignInWithPassword(...args),
        getUser: jest.fn(),
    },
    from: (...args) => mockFromImpl(...args),
}));

const app = require('../src/server');

const USUARIO_FIXTURE = { id: 'user-1', nombre: 'Juan Pérez', rol: 'operador' };

beforeEach(() => {
    mockSignInWithPassword = jest.fn().mockResolvedValue({
        data: { session: { access_token: 'fake-jwt-token' } },
        error: null,
    });
    mockFromImpl = jest.fn().mockImplementation((tableName) => {
        if (tableName === 'usuarios') {
            return createQueryMock({ data: [USUARIO_FIXTURE] });
        }
        return createQueryMock({ data: [] });
    });
});

describe('POST /api/auth/login', () => {
    test('retorna 200 con token y datos de usuario en login exitoso', async () => {
        const res = await supertest(app)
            .post('/api/auth/login')
            .send({ email: 'juan@example.com', password: 'clave123' });

        expect(res.status).toBe(200);
        expect(res.body.token).toBe('fake-jwt-token');
        expect(res.body.usuario).toMatchObject(USUARIO_FIXTURE);
    });

    test('retorna 401 con credenciales incorrectas', async () => {
        mockSignInWithPassword = jest.fn().mockResolvedValue({
            data: null,
            error: new Error('Invalid login credentials'),
        });

        const res = await supertest(app)
            .post('/api/auth/login')
            .send({ email: 'juan@example.com', password: 'incorrecta' });

        expect(res.status).toBe(401);
        expect(res.body.error).toMatch(/credenciales incorrectas/i);
    });

    test('retorna 404 si el usuario autenticado no existe en la tabla usuarios', async () => {
        mockFromImpl = jest.fn().mockImplementation((tableName) => {
            if (tableName === 'usuarios') return createQueryMock({ data: [] });
            return createQueryMock({ data: [] });
        });

        const res = await supertest(app)
            .post('/api/auth/login')
            .send({ email: 'fantasma@example.com', password: 'clave123' });

        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/usuario no encontrado/i);
    });

    test('retorna 500 si ocurre un error inesperado', async () => {
        mockSignInWithPassword = jest.fn().mockRejectedValue(new Error('Timeout de red'));

        const res = await supertest(app)
            .post('/api/auth/login')
            .send({ email: 'juan@example.com', password: 'clave123' });

        expect(res.status).toBe(500);
        expect(res.body.error).toMatch(/error interno/i);
    });

    test('[hallazgo] no valida campos vacíos antes de llamar a Supabase (delega el error a Supabase)', async () => {
        mockSignInWithPassword = jest.fn().mockResolvedValue({
            data: null,
            error: new Error('Missing email or password'),
        });

        const res = await supertest(app)
            .post('/api/auth/login')
            .send({});

        expect(res.status).toBe(401);
    });
});
