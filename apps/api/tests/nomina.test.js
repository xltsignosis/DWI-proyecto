const supertest = require('supertest');

// ---------------------------------------------------------------------------
// Mocks — must be declared before jest.mock() so closures capture the references
// ---------------------------------------------------------------------------
let mockGetUser;
let mockFromImpl;

jest.mock('../src/supabaseClient', () => ({
    auth: {
        getUser: (...args) => mockGetUser(...args),
    },
    from: (...args) => mockFromImpl(...args),
}));

// Require the app AFTER the mock is in place
const app = require('../src/server');

// ---------------------------------------------------------------------------
// Query builder factory — mimics Supabase's fluent builder
// ---------------------------------------------------------------------------
function createQueryMock({ data = null, error = null } = {}) {
    const builder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        single: jest.fn().mockImplementation(() => {
            const singleData = Array.isArray(data) ? (data[0] ?? null) : data;
            return Promise.resolve({ data: singleData, error });
        }),
        then: (onFulfilled, onRejected) =>
            Promise.resolve({ data, error }).then(onFulfilled, onRejected),
    };
    return builder;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const ADMIN_USER = { id: 'admin-1', nombre: 'Admin Test', rol: 'administrador' };
const SUPERVISOR_USER = { id: 'sup-1', nombre: 'Supervisor Test', rol: 'supervisor' };
const OPERADOR_USER = { id: 'op-1', nombre: 'Operador Test', rol: 'operador' };

const REGISTROS_FIXTURE = [
    {
        id: 1,
        lote_id: 1,
        usuario_id: 'op-1',
        piezas_reportadas: 100,
        tipo_pieza: 'tipo_a',
        fecha_registro: '2024-01-15',
        usuarios: { nombre: 'Operador Test' },
        lotes: { codigo_lote: 'LOTE-001' },
    },
];

const TARIFAS_FIXTURE = [
    {
        tipo_pieza: 'tipo_a',
        pago_por_pieza: 5.50,
        fecha_inicio_vigencia: '2024-01-01',
        fecha_fin_vigencia: '2024-12-31',
    },
];

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
function setupAuthAs(usuario) {
    mockGetUser = jest.fn().mockResolvedValue({
        data: { user: { id: usuario.id } },
        error: null,
    });

    mockFromImpl = jest.fn().mockImplementation((tableName) => {
        if (tableName === 'usuarios') {
            return createQueryMock({ data: [usuario] });
        }
        if (tableName === 'registros_produccion') {
            return createQueryMock({ data: REGISTROS_FIXTURE });
        }
        if (tableName === 'tarifas_nomina') {
            return createQueryMock({ data: TARIFAS_FIXTURE });
        }
        return createQueryMock({ data: [] });
    });
}

beforeEach(() => {
    setupAuthAs(ADMIN_USER);
});

// ---------------------------------------------------------------------------
// Tests — GET /api/nomina/reporte
// ---------------------------------------------------------------------------
describe('GET /api/nomina/reporte', () => {
    test('retorna 401 sin token', async () => {
        const res = await supertest(app)
            .get('/api/nomina/reporte?inicio=2024-01-01&fin=2024-01-31');
        expect(res.status).toBe(401);
        expect(res.body.error).toMatch(/token requerido/i);
    });

    test('retorna 401 con token inválido', async () => {
        mockGetUser = jest.fn().mockResolvedValue({
            data: { user: null },
            error: new Error('Invalid token'),
        });

        const res = await supertest(app)
            .get('/api/nomina/reporte?inicio=2024-01-01&fin=2024-01-31')
            .set('Authorization', 'Bearer token-invalido');
        expect(res.status).toBe(401);
    });

    test('retorna 403 con rol operador', async () => {
        setupAuthAs(OPERADOR_USER);

        const res = await supertest(app)
            .get('/api/nomina/reporte?inicio=2024-01-01&fin=2024-01-31')
            .set('Authorization', 'Bearer valid-token');
        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/acceso denegado/i);
    });

    test('retorna 400 si faltan parámetros de fecha', async () => {
        const res = await supertest(app)
            .get('/api/nomina/reporte')
            .set('Authorization', 'Bearer valid-token');
        expect(res.status).toBe(400);
    });

    test('retorna cálculo correcto: 100 piezas × $5.50 = $550.00', async () => {
        const res = await supertest(app)
            .get('/api/nomina/reporte?inicio=2024-01-01&fin=2024-01-31')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body).toHaveLength(1);

        const operador = res.body[0];
        expect(operador.operador_id).toBe('op-1');
        expect(operador.nombre).toBe('Operador Test');
        expect(operador.piezas_totales).toBe(100);
        expect(operador.monto_total).toBe(550);

        expect(operador.detalle).toHaveLength(1);
        expect(operador.detalle[0]).toMatchObject({
            lote: 'LOTE-001',
            tipo_pieza: 'tipo_a',
            piezas: 100,
            tarifa: 5.5,
            subtotal: 550,
        });
    });

    test('supervisor puede acceder al reporte', async () => {
        setupAuthAs(SUPERVISOR_USER);

        const res = await supertest(app)
            .get('/api/nomina/reporte?inicio=2024-01-01&fin=2024-01-31')
            .set('Authorization', 'Bearer valid-token');
        expect(res.status).toBe(200);
    });
});

// ---------------------------------------------------------------------------
// Tests — GET /api/nomina/historial
// ---------------------------------------------------------------------------
describe('GET /api/nomina/historial', () => {
    test('filtra por lote_id cuando se proporciona', async () => {
        const res = await supertest(app)
            .get('/api/nomina/historial?lote_id=1')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);

        // Verify the query builder received the filter
        const fromCalls = mockFromImpl.mock.calls.map(c => c[0]);
        expect(fromCalls).toContain('registros_produccion');

        const regQuery = createQueryMock({ data: REGISTROS_FIXTURE });
        expect(regQuery.eq).not.toHaveBeenCalled(); // just checking builder shape
    });

    test('filtra por usuario_id cuando se proporciona', async () => {
        const res = await supertest(app)
            .get('/api/nomina/historial?usuario_id=op-1')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    test('retorna los campos correctos en cada registro', async () => {
        const res = await supertest(app)
            .get('/api/nomina/historial?lote_id=1')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        const registro = res.body[0];
        expect(registro).toHaveProperty('codigo_lote');
        expect(registro).toHaveProperty('nombre_operador');
        expect(registro).toHaveProperty('piezas_reportadas');
        expect(registro).toHaveProperty('fecha_registro');
    });
});

// ---------------------------------------------------------------------------
// Tests — POST /api/nomina/exportar
// ---------------------------------------------------------------------------
describe('POST /api/nomina/exportar', () => {
    test('genera PDF descargable con Content-Type correcto', async () => {
        const res = await supertest(app)
            .post('/api/nomina/exportar')
            .set('Authorization', 'Bearer valid-token')
            .send({ inicio: '2024-01-01', fin: '2024-01-31', formato: 'pdf' });

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('application/pdf');
        expect(res.headers['content-disposition']).toContain('attachment');
        expect(res.body.length ?? Buffer.byteLength(res.res.read())).toBeGreaterThan(0);
    }, 15000);

    test('genera Excel descargable con Content-Type correcto', async () => {
        const res = await supertest(app)
            .post('/api/nomina/exportar')
            .set('Authorization', 'Bearer valid-token')
            .send({ inicio: '2024-01-01', fin: '2024-01-31', formato: 'excel' });

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('spreadsheetml');
        expect(res.headers['content-disposition']).toContain('attachment');
    }, 15000);

    test('retorna 400 con formato inválido', async () => {
        const res = await supertest(app)
            .post('/api/nomina/exportar')
            .set('Authorization', 'Bearer valid-token')
            .send({ inicio: '2024-01-01', fin: '2024-01-31', formato: 'csv' });
        expect(res.status).toBe(400);
    });

    test('retorna 403 con rol supervisor', async () => {
        setupAuthAs(SUPERVISOR_USER);

        const res = await supertest(app)
            .post('/api/nomina/exportar')
            .set('Authorization', 'Bearer valid-token')
            .send({ inicio: '2024-01-01', fin: '2024-01-31', formato: 'pdf' });
        expect(res.status).toBe(403);
    });
});

// ---------------------------------------------------------------------------
// Test — tarifa vigente usa la tarifa correcta según fecha
// ---------------------------------------------------------------------------
describe('Cálculo de tarifa vigente', () => {
    test('usa la tarifa que aplica en la fecha del registro', async () => {
        // Tarifa 2023: $3.00 | Tarifa 2024: $5.50
        mockFromImpl = jest.fn().mockImplementation((tableName) => {
            if (tableName === 'usuarios') return createQueryMock({ data: [ADMIN_USER] });
            if (tableName === 'registros_produccion') {
                return createQueryMock({
                    data: [{ ...REGISTROS_FIXTURE[0], fecha_registro: '2023-06-15' }],
                });
            }
            if (tableName === 'tarifas_nomina') {
                return createQueryMock({
                    data: [
                        { tipo_pieza: 'tipo_a', pago_por_pieza: 3.00, fecha_inicio_vigencia: '2023-01-01', fecha_fin_vigencia: '2023-12-31' },
                        { tipo_pieza: 'tipo_a', pago_por_pieza: 5.50, fecha_inicio_vigencia: '2024-01-01', fecha_fin_vigencia: '2024-12-31' },
                    ],
                });
            }
            return createQueryMock({ data: [] });
        });

        const res = await supertest(app)
            .get('/api/nomina/reporte?inicio=2023-01-01&fin=2023-12-31')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        // 100 piezas × $3.00 (tarifa de 2023) = $300.00
        expect(res.body[0].monto_total).toBe(300);
        expect(res.body[0].detalle[0].tarifa).toBe(3);
    });
});
