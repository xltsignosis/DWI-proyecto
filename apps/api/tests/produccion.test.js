const supertest = require('supertest');
const { createQueryMock } = require('./helpers');

let mockFromImpl;

jest.mock('../src/supabaseClient', () => ({
    auth: { getUser: jest.fn() },
    from: (...args) => mockFromImpl(...args),
}));

const app = require('../src/server');

function loteMock(overrides = {}) {
    return {
        id: 1,
        codigo_lote: 'LOTE-001',
        total_piezas_requeridas: 100,
        piezas_acumuladas: 80,
        estado: 'abierto',
        fecha_cierre: null,
        ...overrides,
    };
}

function setupMocks({ lote, insertError = null, updateError = null } = {}) {
    let loteCallCount = 0;
    mockFromImpl = jest.fn().mockImplementation((table) => {
        if (table === 'lotes') {
            loteCallCount += 1;
            // 1ra llamada: consultarLotePorReferencia (SELECT) -> sin error
            if (loteCallCount === 1) return createQueryMock({ data: lote });
            // 2da llamada: actualizarLoteConEstado (UPDATE) -> aquí sí aplica el error
            return createQueryMock({ data: lote, error: updateError });
        }
        if (table === 'registros_produccion') {
            return createQueryMock({ data: [{ id: 1 }], error: insertError });
        }
        return createQueryMock({ data: [] });
    });
}

beforeEach(() => {
    setupMocks({ lote: loteMock() });
});

describe('POST /api/produccion/registrar', () => {
    test('retorna 401 si no se envía usuario_id', async () => {
        const res = await supertest(app)
            .post('/api/produccion/registrar')
            .send({ lote_id: 1, piezas_nuevas: 10 });

        expect(res.status).toBe(401);
        expect(res.body.error).toMatch(/sesión inválida/i);
    });

    test('retorna 404 si el lote no existe', async () => {
        setupMocks({ lote: null });

        const res = await supertest(app)
            .post('/api/produccion/registrar')
            .send({ lote_id: 999, usuario_id: 'op-1', piezas_nuevas: 10 });

        expect(res.status).toBe(404);
    });

    test('retorna 400 si el lote ya está cerrado', async () => {
        setupMocks({ lote: loteMock({ estado: 'cerrado' }) });

        const res = await supertest(app)
            .post('/api/produccion/registrar')
            .send({ lote_id: 1, usuario_id: 'op-1', piezas_nuevas: 5 });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/lote ya está cerrado/i);
    });

    test('retorna 400 si piezas_nuevas es cero o negativo (inválido)', async () => {
        const res = await supertest(app)
            .post('/api/produccion/registrar')
            .send({ lote_id: 1, usuario_id: 'op-1', piezas_nuevas: 0 });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/datos inválidos/i);
    });

    test('retorna 400 si piezas_nuevas es negativo (inválido)', async () => {
        const res = await supertest(app)
            .post('/api/produccion/registrar')
            .send({ lote_id: 1, usuario_id: 'op-1', piezas_nuevas: -10 });

        expect(res.status).toBe(400);
    });

    test('retorna 400 si el registro excede el total del lote', async () => {
        const res = await supertest(app)
            .post('/api/produccion/registrar')
            .send({ lote_id: 1, usuario_id: 'op-1', piezas_nuevas: 30 });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/supera el límite/i);
    });

    test('registra correctamente cuando las piezas están dentro del límite (lote sigue abierto)', async () => {
        const res = await supertest(app)
            .post('/api/produccion/registrar')
            .send({ lote_id: 1, usuario_id: 'op-1', piezas_nuevas: 15 });

        expect(res.status).toBe(200);
        expect(res.body.estado).toBe('abierto');
        expect(res.body.mensaje).toMatch(/producción registrada/i);
    });

    test('cierra el lote automáticamente cuando se completa exactamente el total', async () => {
        setupMocks({ lote: loteMock({ piezas_acumuladas: 80 }) });

        const res = await supertest(app)
            .post('/api/produccion/registrar')
            .send({ lote_id: 1, usuario_id: 'op-1', piezas_nuevas: 20 });

        expect(res.status).toBe(200);
        expect(res.body.estado).toBe('cerrado');
    });

    test('acepta lote_id como código de lote (string) en lugar de ID numérico', async () => {
        const res = await supertest(app)
            .post('/api/produccion/registrar')
            .send({ lote_id: 'LOTE-001', usuario_id: 'op-1', piezas_nuevas: 10 });

        expect(res.status).toBe(200);
    });

    test('retorna 500 si falla la inserción del registro de producción', async () => {
        setupMocks({ lote: loteMock(), insertError: new Error('Insert failed') });

        const res = await supertest(app)
            .post('/api/produccion/registrar')
            .send({ lote_id: 1, usuario_id: 'op-1', piezas_nuevas: 10 });

        expect(res.status).toBe(500);
        expect(res.body.error).toMatch(/error al guardar el registro/i);
    });

    test('retorna 500 si falla la actualización del lote', async () => {
        setupMocks({ lote: loteMock(), updateError: new Error('Update failed') });

        const res = await supertest(app)
            .post('/api/produccion/registrar')
            .send({ lote_id: 1, usuario_id: 'op-1', piezas_nuevas: 10 });

        expect(res.status).toBe(500);
        expect(res.body.error).toMatch(/error al actualizar el lote/i);
    });

    describe('[hallazgos]', () => {
        test('el endpoint NO verifica el JWT: cualquier usuario_id enviado en el body es aceptado', async () => {
            const res = await supertest(app)
                .post('/api/produccion/registrar')
                .send({ lote_id: 1, usuario_id: 'usuario-inventado-sin-sesion', piezas_nuevas: 5 });

            expect(res.status).toBe(200);
        });

        test('acepta piezas_nuevas con decimales (no se valida que sea un entero)', async () => {
            const res = await supertest(app)
                .post('/api/produccion/registrar')
                .send({ lote_id: 1, usuario_id: 'op-1', piezas_nuevas: 2.75 });

            expect(res.status).toBe(200);
        });
    });
});
