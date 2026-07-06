const supertest = require('supertest');
const { createQueryMock, ADMIN_USER, SUPERVISOR_USER, OPERADOR_USER } = require('./helpers');

let mockGetUser;
let mockFromImpl;

jest.mock('../src/supabaseClient', () => ({
    auth: {
        getUser: (...args) => mockGetUser(...args),
    },
    from: (...args) => mockFromImpl(...args),
}));

const app = require('../src/server');

const TARIFA_FIXTURE = {
    id: 1,
    tipo_pieza: 'tipo_a',
    pago_por_pieza: 5.5,
    fecha_inicio_vigencia: '2024-01-01',
    fecha_fin_vigencia: '2024-12-31',
};

function setupAuthAs(usuario) {
    mockGetUser = jest.fn().mockResolvedValue({
        data: { user: { id: usuario.id } },
        error: null,
    });

    mockFromImpl = jest.fn().mockImplementation((table) => {
        if (table === 'usuarios') return createQueryMock({ data: [usuario] });
        if (table === 'tarifas_nomina') return createQueryMock({ data: [TARIFA_FIXTURE] });
        return createQueryMock({ data: [] });
    });
}

beforeEach(() => {
    setupAuthAs(ADMIN_USER);
});

describe('GET /api/tarifas', () => {
    test('retorna 401 sin token', async () => {
        const res = await supertest(app).get('/api/tarifas');
        expect(res.status).toBe(401);
    });

    test('retorna 403 con rol operador', async () => {
        setupAuthAs(OPERADOR_USER);

        const res = await supertest(app)
            .get('/api/tarifas')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(403);
    });

    test('retorna 200 con rol administrador', async () => {
        const res = await supertest(app)
            .get('/api/tarifas')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0]).toMatchObject({ tipo_pieza: 'tipo_a', pago_por_pieza: 5.5 });
    });

    test('retorna 200 con rol supervisor', async () => {
        setupAuthAs(SUPERVISOR_USER);

        const res = await supertest(app)
            .get('/api/tarifas')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
    });

    test('retorna 500 si Supabase falla', async () => {
        mockFromImpl = jest.fn().mockImplementation((table) => {
            if (table === 'usuarios') return createQueryMock({ data: [ADMIN_USER] });
            if (table === 'tarifas_nomina') return createQueryMock({ data: null, error: new Error('DB down') });
            return createQueryMock({ data: [] });
        });

        const res = await supertest(app)
            .get('/api/tarifas')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(500);
    });
});

describe('POST /api/tarifas', () => {
    test('retorna 401 sin token', async () => {
        const res = await supertest(app)
            .post('/api/tarifas')
            .send({ tipo_pieza: 'tipo_b', pago_por_pieza: 3, fecha_inicio_vigencia: '2025-01-01', fecha_fin_vigencia: '2025-12-31' });

        expect(res.status).toBe(401);
    });

    test('retorna 403 con rol supervisor (solo admin puede crear)', async () => {
        setupAuthAs(SUPERVISOR_USER);

        const res = await supertest(app)
            .post('/api/tarifas')
            .set('Authorization', 'Bearer valid-token')
            .send({ tipo_pieza: 'tipo_b', pago_por_pieza: 3, fecha_inicio_vigencia: '2025-01-01', fecha_fin_vigencia: '2025-12-31' });

        expect(res.status).toBe(403);
    });

    test('retorna 403 con rol operador (solo admin puede crear)', async () => {
        setupAuthAs(OPERADOR_USER);

        const res = await supertest(app)
            .post('/api/tarifas')
            .set('Authorization', 'Bearer valid-token')
            .send({ tipo_pieza: 'tipo_b', pago_por_pieza: 3, fecha_inicio_vigencia: '2025-01-01', fecha_fin_vigencia: '2025-12-31' });

        expect(res.status).toBe(403);
    });

    test('retorna 201 al crear una tarifa válida como administrador', async () => {
        mockFromImpl = jest.fn().mockImplementation((table) => {
            if (table === 'usuarios') return createQueryMock({ data: [ADMIN_USER] });
            if (table === 'tarifas_nomina') {
                return createQueryMock({
                    data: { id: 2, tipo_pieza: 'tipo_b', pago_por_pieza: 3, fecha_inicio_vigencia: '2025-01-01', fecha_fin_vigencia: '2025-12-31' },
                });
            }
            return createQueryMock({ data: [] });
        });

        const res = await supertest(app)
            .post('/api/tarifas')
            .set('Authorization', 'Bearer valid-token')
            .send({ tipo_pieza: 'tipo_b', pago_por_pieza: 3, fecha_inicio_vigencia: '2025-01-01', fecha_fin_vigencia: '2025-12-31' });

        expect(res.status).toBe(201);
        expect(res.body.tipo_pieza).toBe('tipo_b');
    });

    test('retorna 400 si pago_por_pieza es cero o negativo', async () => {
        const res = await supertest(app)
            .post('/api/tarifas')
            .set('Authorization', 'Bearer valid-token')
            .send({ tipo_pieza: 'tipo_b', pago_por_pieza: 0, fecha_inicio_vigencia: '2025-01-01', fecha_fin_vigencia: '2025-12-31' });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/mayor a 0/i);
    });

    test('retorna 400 si fecha_fin_vigencia no es posterior a fecha_inicio_vigencia', async () => {
        const res = await supertest(app)
            .post('/api/tarifas')
            .set('Authorization', 'Bearer valid-token')
            .send({ tipo_pieza: 'tipo_b', pago_por_pieza: 3, fecha_inicio_vigencia: '2025-06-01', fecha_fin_vigencia: '2025-01-01' });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/posterior/i);
    });

    test('retorna 400 si fecha_fin_vigencia es igual a fecha_inicio_vigencia', async () => {
        const res = await supertest(app)
            .post('/api/tarifas')
            .set('Authorization', 'Bearer valid-token')
            .send({ tipo_pieza: 'tipo_b', pago_por_pieza: 3, fecha_inicio_vigencia: '2025-01-01', fecha_fin_vigencia: '2025-01-01' });

        expect(res.status).toBe(400);
    });

    test('retorna 500 si falla la inserción en Supabase', async () => {
        mockFromImpl = jest.fn().mockImplementation((table) => {
            if (table === 'usuarios') return createQueryMock({ data: [ADMIN_USER] });
            if (table === 'tarifas_nomina') return createQueryMock({ data: null, error: new Error('Insert failed') });
            return createQueryMock({ data: [] });
        });

        const res = await supertest(app)
            .post('/api/tarifas')
            .set('Authorization', 'Bearer valid-token')
            .send({ tipo_pieza: 'tipo_b', pago_por_pieza: 3, fecha_inicio_vigencia: '2025-01-01', fecha_fin_vigencia: '2025-12-31' });

        expect(res.status).toBe(500);
    });
});
