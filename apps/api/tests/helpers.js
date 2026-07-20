function createQueryMock({ data = null, error = null } = {}) {
    const builder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        single: jest.fn().mockImplementation(() => {
            const singleData = Array.isArray(data) ? (data[0] ?? null) : data;
            return Promise.resolve({ data: singleData, error });
        }),
        maybeSingle: jest.fn().mockImplementation(() => {
            const singleData = Array.isArray(data) ? (data[0] ?? null) : data;
            return Promise.resolve({ data: singleData, error });
        }),
        then: (onFulfilled, onRejected) =>
            Promise.resolve({ data, error }).then(onFulfilled, onRejected),
    };
    return builder;
}

const ADMIN_USER = { id: 'admin-1', nombre: 'Admin Test', rol: 'administrador' };
const SUPERVISOR_USER = { id: 'sup-1', nombre: 'Supervisor Test', rol: 'supervisor' };
const OPERADOR_USER = { id: 'op-1', nombre: 'Operador Test', rol: 'operador' };

module.exports = {
    createQueryMock,
    ADMIN_USER,
    SUPERVISOR_USER,
    OPERADOR_USER,
};
