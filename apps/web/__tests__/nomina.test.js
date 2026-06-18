import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import Nomina from '../src/pages/nomina';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
jest.mock('next/router', () => ({
  useRouter: () => ({ push: jest.fn(), pathname: '/nomina' }),
}));

// URL.createObjectURL / revokeObjectURL no existen en JSDOM
global.URL.createObjectURL = jest.fn(() => 'blob:test-url');
global.URL.revokeObjectURL = jest.fn();

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const REPORTE_FIXTURE = [
  {
    operador_id: 'op-1',
    nombre: 'Operador Test',
    piezas_totales: 100,
    monto_total: 550,
    detalle: [
      { lote: 'LOTE-001', tipo_pieza: 'tipo_a', piezas: 100, tarifa: 5.5, subtotal: 550 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function setupAdminUser() {
  localStorage.setItem('token', 'test-token');
  localStorage.setItem('usuario', JSON.stringify({ id: 'admin-1', nombre: 'Admin', rol: 'administrador' }));
}

function setupOperadorUser() {
  localStorage.setItem('token', 'test-token');
  localStorage.setItem('usuario', JSON.stringify({ id: 'op-1', nombre: 'Operador', rol: 'operador' }));
}

function mockFetchOkReporte(data = REPORTE_FIXTURE) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue(data),
  });
}

function setFechas() {
  fireEvent.change(screen.getByLabelText(/fecha inicio/i), { target: { value: '2024-01-01' } });
  fireEvent.change(screen.getByLabelText(/fecha fin/i), { target: { value: '2024-01-31' } });
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------
beforeEach(() => {
  localStorage.clear();
  global.fetch = jest.fn();
  global.URL.createObjectURL.mockClear();
  global.URL.revokeObjectURL.mockClear();
  process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001';
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Nomina', () => {
  // 1. Render inicial con selector de periodo
  test('muestra el selector de periodo al cargar', async () => {
    setupAdminUser();
    global.fetch = jest.fn().mockImplementation(() => new Promise(() => {}));

    render(<Nomina />);
    await act(async () => {});

    expect(screen.getByLabelText(/fecha inicio/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/fecha fin/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /calcular nómina/i })).toBeInTheDocument();
  });

  // 2. Cálculo correcto: 100 piezas × $5.50 = $550.00
  test('muestra el cálculo correcto: 100 piezas × $5.50 = $550.00', async () => {
    setupAdminUser();
    mockFetchOkReporte();

    render(<Nomina />);
    await act(async () => {});

    setFechas();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /calcular nómina/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('Operador Test')).toBeInTheDocument();
    });

    expect(screen.getByText('100')).toBeInTheDocument();
    // Formatted as MXN: $550.00
    expect(screen.getByText(/\$550\.00/i)).toBeInTheDocument();
  });

  // 3. Estado loading durante el fetch
  test('muestra estado loading mientras se calcula', async () => {
    setupAdminUser();

    let resolvePromise;
    global.fetch = jest.fn().mockReturnValue(
      new Promise(resolve => { resolvePromise = resolve; })
    );

    render(<Nomina />);
    await act(async () => {});

    setFechas();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /calcular nómina/i }));
    });

    expect(screen.getByRole('button', { name: /calculando/i })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(/calculando/i);

    // Resolver para limpiar act() warnings
    await act(async () => {
      resolvePromise({ ok: true, json: async () => [] });
    });
  });

  // 4. Estado error de red
  test('muestra mensaje de error cuando falla el fetch', async () => {
    setupAdminUser();
    global.fetch = jest.fn().mockRejectedValue(new Error('Network Error'));

    render(<Nomina />);
    await act(async () => {});

    setFechas();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /calcular nómina/i }));
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Network Error/i);
    });
  });

  // 5. Estado sin resultados
  test('muestra mensaje cuando no hay resultados', async () => {
    setupAdminUser();
    mockFetchOkReporte([]);

    render(<Nomina />);
    await act(async () => {});

    setFechas();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /calcular nómina/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/no hay registros/i)).toBeInTheDocument();
    });
  });

  // 6. Botón exportar PDF dispara fetch correcto
  test('botón Exportar PDF dispara el fetch con formato pdf', async () => {
    setupAdminUser();

    // Primer fetch: calcular nómina
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => REPORTE_FIXTURE })
      // Segundo fetch: exportar
      .mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(['%PDF'], { type: 'application/pdf' }),
      });

    render(<Nomina />);
    await act(async () => {});

    setFechas();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /calcular nómina/i }));
    });

    await waitFor(() => expect(screen.getByText('Operador Test')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /exportar pdf/i }));
    });

    await waitFor(() => {
      const exportCall = global.fetch.mock.calls.find(c =>
        c[0].includes('/api/nomina/exportar')
      );
      expect(exportCall).toBeDefined();
      expect(JSON.parse(exportCall[1].body)).toMatchObject({ formato: 'pdf' });
    });
  });

  // 7. Botón exportar Excel dispara fetch correcto
  test('botón Exportar Excel dispara el fetch con formato excel', async () => {
    setupAdminUser();

    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => REPORTE_FIXTURE })
      .mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(['xlsx'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      });

    render(<Nomina />);
    await act(async () => {});

    setFechas();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /calcular nómina/i }));
    });

    await waitFor(() => expect(screen.getByText('Operador Test')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /exportar excel/i }));
    });

    await waitFor(() => {
      const exportCall = global.fetch.mock.calls.find(c =>
        c[0].includes('/api/nomina/exportar')
      );
      expect(exportCall).toBeDefined();
      expect(JSON.parse(exportCall[1].body)).toMatchObject({ formato: 'excel' });
    });
  });

  // 8. Acceso denegado si rol no es administrador
  test('muestra acceso denegado si el rol es operador', async () => {
    setupOperadorUser();
    global.fetch = jest.fn();

    render(<Nomina />);
    await act(async () => {});

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/acceso denegado/i);
    });

    // El selector de periodo no debe mostrarse
    expect(screen.queryByLabelText(/fecha inicio/i)).not.toBeInTheDocument();
  });

  // Extra: el botón de calcular está deshabilitado sin fechas
  test('el botón calcular está deshabilitado sin fechas seleccionadas', async () => {
    setupAdminUser();
    global.fetch = jest.fn().mockImplementation(() => new Promise(() => {}));

    render(<Nomina />);
    await act(async () => {});

    expect(screen.getByRole('button', { name: /calcular nómina/i })).toBeDisabled();
  });
});
