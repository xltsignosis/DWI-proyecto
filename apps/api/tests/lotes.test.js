const supertest = require('supertest');
const { createQueryMock } = require('./helpers');

let mockFromImpl;

jest.mock('../src/supabaseClient', () => ({
    auth: { getUser: jest.fn() },
    from: (...args) => mockFromImpl(...args),
}));

const app = require('../src/server');

const LOTE_ABIERTO = {
    id: 1,
    codigo_lote: 'LOTE-001',
    total_piezas_requeridas: 100,
    piezas_acumuladas: 40,
    estado: 'abierto',
    fecha_cierre: null,
};

const LOTE_CERCA_DEL_LIMITE = {
    id: 2,
    codigo_lote: 'LOTE-002',
    total_piezas_requeridas: 100,
    piezas_acumuladas: 95,
    estado: 'abierto',
    fecha_cierre: null,
};

beforeEach(() => {
    mockFromImpl = jest.fn().mockImplementation(() => createQueryMock({ data: [] }));
});

describe('GET /api/lotes/estado', () => {
    test('retorna 200 con la lista de lotes formateada', async () => {
        mockFromImpl = jest.fn().mockImplementation((table) => {
            if (table === 'lotes') return createQueryMock({ data: [LOTE_ABIERTO, LOTE_CERCA_DEL_LIMITE] });
            return createQueryMock({ data: [] });
        });

        const res = await supertest(app).get('/api/lotes/estado');

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
        expect(res.body[0]).toMatchObject({
            id: 1,
            codigo_lote: 'LOTE-001',
            total_piezas_requeridas: 100,
            piezas_acumuladas: 40,
            piezas_disponibles: 60,
            porcentaje: 40,
            limite_cercano: false,
        });
    });

    test('marca limite_cercano=true cuando el porcentaje supera 90%', async () => {
        mockFromImpl = jest.fn().mockImplementation((table) => {
            if (table === 'lotes') return createQueryMock({ data: [LOTE_CERCA_DEL_LIMITE] });
            return createQueryMock({ data: [] });
        });

        const res = await supertest(app).get('/api/lotes/estado');

        expect(res.status).toBe(200);
        expect(res.body[0].limite_cercano).toBe(true);
        expect(res.body[0].piezas_disponibles).toBe(5);
    });

    test('retorna lista vacía cuando no hay lotes', async () => {
        const res = await supertest(app).get('/api/lotes/estado');
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    test('retorna 500 si Supabase falla al consultar', async () => {
        mockFromImpl = jest.fn().mockImplementation((table) => {
            if (table === 'lotes') return createQueryMock({ data: null, error: new Error('DB down') });
            return createQueryMock({ data: [] });
        });

        const res = await supertest(app).get('/api/lotes/estado');
        expect(res.status).toBe(500);
    });
});

describe('GET /api/lotes/estado/:id', () => {
    test('consulta por ID numérico y retorna 200', async () => {
        mockFromImpl = jest.fn().mockImplementation((table) => {
            if (table === 'lotes') return createQueryMock({ data: LOTE_ABIERTO });
            return createQueryMock({ data: [] });
        });

        const res = await supertest(app).get('/api/lotes/estado/1');
        expect(res.status).toBe(200);
        expect(res.body.codigo_lote).toBe('LOTE-001');
    });

    test('consulta por código de lote (no numérico) y retorna 200', async () => {
        mockFromImpl = jest.fn().mockImplementation((table) => {
            if (table === 'lotes') return createQueryMock({ data: LOTE_ABIERTO });
            return createQueryMock({ data: [] });
        });

        const res = await supertest(app).get('/api/lotes/estado/LOTE-001');
        expect(res.status).toBe(200);
        expect(res.body.codigo_lote).toBe('LOTE-001');
    });

    test('retorna 404 si el lote no existe', async () => {
        mockFromImpl = jest.fn().mockImplementation((table) => {
            if (table === 'lotes') return createQueryMock({ data: null, error: new Error('No rows') });
            return createQueryMock({ data: [] });
        });

        const res = await supertest(app).get('/api/lotes/estado/999');
        expect(res.status).toBe(404);
    });
});

describe('POST /api/lotes', () => {
    test('crea un lote correctamente y retorna 201', async () => {
        mockFromImpl = jest.fn().mockImplementation((table) => {
            if (table === 'lotes') {
                return createQueryMock({
                    data: { id: 10, codigo_lote: 'LOTE-010', total_piezas_requeridas: 200, piezas_acumuladas: 0, estado: 'abierto' },
                });
            }
            return createQueryMock({ data: [] });
        });

        const res = await supertest(app)
            .post('/api/lotes')
            .send({ codigo_lote: 'LOTE-010', total_piezas_requeridas: 200 });

        expect(res.status).toBe(201);
        expect(res.body.codigo_lote).toBe('LOTE-010');
        expect(res.body.piezas_disponibles).toBe(200);
    });

    test('retorna 400 si falta codigo_lote', async () => {
        const res = await supertest(app)
            .post('/api/lotes')
            .send({ total_piezas_requeridas: 100 });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/código del lote es obligatorio/i);
    });

    test('retorna 400 si total_piezas_requeridas no es un entero positivo', async () => {
        const res = await supertest(app)
            .post('/api/lotes')
            .send({ codigo_lote: 'LOTE-011', total_piezas_requeridas: -5 });

        expect(res.status).toBe(400);
    });

    test('retorna 400 si total_piezas_requeridas es decimal', async () => {
        const res = await supertest(app)
            .post('/api/lotes')
            .send({ codigo_lote: 'LOTE-011', total_piezas_requeridas: 10.5 });

        expect(res.status).toBe(400);
    });

    test('retorna 409 si el código de lote ya existe', async () => {
        mockFromImpl = jest.fn().mockImplementation((table) => {
            if (table === 'lotes') return createQueryMock({ data: null, error: { code: '23505', message: 'duplicate key' } });
            return createQueryMock({ data: [] });
        });

        const res = await supertest(app)
            .post('/api/lotes')
            .send({ codigo_lote: 'LOTE-001', total_piezas_requeridas: 100 });

        expect(res.status).toBe(409);
    });

    test('retorna 500 ante un error genérico de base de datos', async () => {
        mockFromImpl = jest.fn().mockImplementation((table) => {
            if (table === 'lotes') return createQueryMock({ data: null, error: { code: '500', message: 'DB error' } });
            return createQueryMock({ data: [] });
        });

        const res = await supertest(app)
            .post('/api/lotes')
            .send({ codigo_lote: 'LOTE-012', total_piezas_requeridas: 50 });

        expect(res.status).toBe(500);
    });
});
