const supertest = require('supertest');
const { createQueryMock, ADMIN_USER, SUPERVISOR_USER, OPERADOR_USER } = require('./helpers');

let mockGetUser;
let mockFromImpl;
let mockCreateUser;

jest.mock('../src/supabaseClient', () => ({
    auth: {
        getUser: (...args) => mockGetUser(...args),
        admin: {
            createUser: (...args) => mockCreateUser(...args),
        },
    },
    from: (...args) => mockFromImpl(...args),
}));

jest.mock('../src/services/gmail', () => ({
    enviarBienvenida: jest.fn().mockResolvedValue(undefined),
}));

const app = require('../src/server');
const { enviarBienvenida } = require('../src/services/gmail');

const USUARIOS_FIXTURE = [
    { id: 'u1', nombre: 'Ana Pérez', email: 'ana@example.com', rol: 'operador', fecha_creacion: '2024-01-01' },
    { id: 'u2', nombre: 'Luis Gómez', email: 'luis@example.com', rol: 'supervisor', fecha_creacion: '2024-02-01' },
];

function setupAuthAs(usuario) {
    mockGetUser = jest.fn().mockResolvedValue({
        data: { user: { id: usuario.id } },
        error: null,
    });

    mockFromImpl = jest.fn().mockImplementation((table) => {
        if (table === 'usuarios') return createQueryMock({ data: [usuario] });
        return createQueryMock({ data: [] });
    });
}

beforeEach(() => {
    jest.clearAllMocks();
    setupAuthAs(ADMIN_USER);
    mockCreateUser = jest.fn();
});

describe('GET /api/usuarios', () => {
    test('retorna 401 sin token', async () => {
        const res = await supertest(app).get('/api/usuarios');
        expect(res.status).toBe(401);
    });

    test('retorna 403 con rol operador', async () => {
        setupAuthAs(OPERADOR_USER);

        const res = await supertest(app)
            .get('/api/usuarios')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(403);
    });

   test('retorna 200 con la lista de usuarios como administrador', async () => {
        let callCount = 0;
        mockFromImpl = jest.fn().mockImplementation((table) => {
            if (table === 'usuarios') {
                callCount += 1;
                // 1ra llamada: verificarAuth -> debe ser ADMIN
                if (callCount === 1) return createQueryMock({ data: [ADMIN_USER] });
                // 2da llamada: SELECT del propio endpoint -> lista completa
                return createQueryMock({ data: USUARIOS_FIXTURE });
            }
            return createQueryMock({ data: [] });
        });

        const res = await supertest(app)
            .get('/api/usuarios')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
    });

    test('retorna 200 con rol supervisor', async () => {
        setupAuthAs(SUPERVISOR_USER);

        const res = await supertest(app)
            .get('/api/usuarios')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
    });

    test('retorna 500 si Supabase falla al consultar', async () => {
        let callCount = 0;
        mockFromImpl = jest.fn().mockImplementation((table) => {
            if (table === 'usuarios') {
                callCount += 1;
                if (callCount === 1) return createQueryMock({ data: [ADMIN_USER] });
                return createQueryMock({ data: null, error: new Error('DB down') });
            }
            return createQueryMock({ data: [] });
        });

        const res = await supertest(app)
            .get('/api/usuarios')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(500);
    });
});

describe('POST /api/usuarios', () => {
    const NUEVO_USUARIO = {
        nombre: 'Carlos Ruiz',
        email: 'carlos@example.com',
        password: 'ClaveSegura123',
        rol: 'operador',
    };

    function mockCreacionExitosa() {
        mockCreateUser = jest.fn().mockResolvedValue({
            data: { user: { id: 'new-user-id' } },
            error: null,
        });

        let callCount = 0;
        mockFromImpl = jest.fn().mockImplementation((table) => {
            if (table === 'usuarios') {
                callCount += 1;
                if (callCount === 1) return createQueryMock({ data: [ADMIN_USER] });
                return createQueryMock({
                    data: { id: 'new-user-id', nombre: NUEVO_USUARIO.nombre, email: NUEVO_USUARIO.email, rol: NUEVO_USUARIO.rol },
                });
            }
            return createQueryMock({ data: [] });
        });
    }

    test('retorna 401 sin token', async () => {
        const res = await supertest(app).post('/api/usuarios').send(NUEVO_USUARIO);
        expect(res.status).toBe(401);
    });

    test('retorna 403 con rol supervisor (solo admin puede crear usuarios)', async () => {
        setupAuthAs(SUPERVISOR_USER);

        const res = await supertest(app)
            .post('/api/usuarios')
            .set('Authorization', 'Bearer valid-token')
            .send(NUEVO_USUARIO);

        expect(res.status).toBe(403);
    });

    test('retorna 400 si faltan campos obligatorios', async () => {
        const res = await supertest(app)
            .post('/api/usuarios')
            .set('Authorization', 'Bearer valid-token')
            .send({ nombre: 'Carlos Ruiz', email: 'carlos@example.com' });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/faltan campos/i);
    });

    test('retorna 400 si el rol no es válido', async () => {
        const res = await supertest(app)
            .post('/api/usuarios')
            .set('Authorization', 'Bearer valid-token')
            .send({ ...NUEVO_USUARIO, rol: 'superadmin' });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/rol inválido/i);
    });

    test('retorna 409 si el correo ya está registrado', async () => {
        mockCreateUser = jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Email already registered' },
        });

        const res = await supertest(app)
            .post('/api/usuarios')
            .set('Authorization', 'Bearer valid-token')
            .send(NUEVO_USUARIO);

        expect(res.status).toBe(409);
    });

    test('retorna 500 si falla la creación en Supabase Auth por otra razón', async () => {
        mockCreateUser = jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Internal Auth error' },
        });

        const res = await supertest(app)
            .post('/api/usuarios')
            .set('Authorization', 'Bearer valid-token')
            .send(NUEVO_USUARIO);

        expect(res.status).toBe(500);
    });

    test('crea el usuario, guarda el perfil y envía correo de bienvenida (201)', async () => {
        mockCreacionExitosa();

        const res = await supertest(app)
            .post('/api/usuarios')
            .set('Authorization', 'Bearer valid-token')
            .send(NUEVO_USUARIO);

        expect(res.status).toBe(201);
        expect(enviarBienvenida).toHaveBeenCalledWith(
            expect.objectContaining({ email: NUEVO_USUARIO.email, rol: NUEVO_USUARIO.rol })
        );
    });

    test('retorna 201 aunque el envío de correo de bienvenida falle (no bloquea)', async () => {
        mockCreacionExitosa();
        enviarBienvenida.mockRejectedValueOnce(new Error('SMTP error'));

        const res = await supertest(app)
            .post('/api/usuarios')
            .set('Authorization', 'Bearer valid-token')
            .send(NUEVO_USUARIO);

        expect(res.status).toBe(201);
    });

    test('[hallazgo] si falla el insert del perfil tras crear el Auth user, no hay rollback', async () => {
        mockCreateUser = jest.fn().mockResolvedValue({
            data: { user: { id: 'orphan-user-id' } },
            error: null,
        });

        let callCount = 0;
        mockFromImpl = jest.fn().mockImplementation((table) => {
            if (table === 'usuarios') {
                callCount += 1;
                if (callCount === 1) return createQueryMock({ data: [ADMIN_USER] });
                return createQueryMock({ data: null, error: new Error('Insert failed') });
            }
            return createQueryMock({ data: [] });
        });

        const res = await supertest(app)
            .post('/api/usuarios')
            .set('Authorization', 'Bearer valid-token')
            .send(NUEVO_USUARIO);

        expect(res.status).toBe(500);
        expect(mockCreateUser).toHaveBeenCalled();
    });
});
