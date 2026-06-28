import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import Nomina from '../src/pages/nomina';

const mockPush = jest.fn();

jest.mock('next/router', () => ({
  useRouter: () => ({ push: mockPush, pathname: '/nomina' }),
}));

global.URL.createObjectURL = jest.fn(() => 'blob:test-url');
global.URL.revokeObjectURL = jest.fn();

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

beforeEach(() => {
  localStorage.clear();
  global.fetch = jest.fn();
  mockPush.mockClear();
  global.URL.createObjectURL.mockClear();
  global.URL.revokeObjectURL.mockClear();
  process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001';
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Nomina', () => {

  test('muestra el selector de periodo al cargar', async () => {
    setupAdminUser();
    global.fetch = jest.fn().mockImplementation(() => new Promise(() => {}));
    render(<Nomina />);
    await act(async () => {});
    expect(screen.getByLabelText(/fecha inicio/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/fecha fin/i)).toBeInTheDocument();
  });

  test('muestra el cálculo correcto: 100 piezas × $5.50 = $550.00', async () => {
    setupAdminUser();
    mockFetchOkReporte();
    render(<Nomina />);
    await act(async () => {});
    setFechas();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /calcular/i })); });
    await waitFor(() => expect(screen.getByText('Operador Test')).toBeInTheDocument());
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText(/\$550\.00/i)).toBeInTheDocument();
  });

  test('muestra estado loading mientras se calcula', async () => {
    setupAdminUser();
    let resolvePromise;
    global.fetch = jest.fn().mockReturnValue(new Promise(resolve => { resolvePromise = resolve; }));
    render(<Nomina />);
    await act(async () => {});
    setFechas();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /calcular/i })); });
    expect(screen.getByRole('status')).toHaveTextContent(/calculando/i);
    await act(async () => { resolvePromise({ ok: true, json: async () => [] }); });
  });

  test('muestra mensaje de error cuando falla el fetch', async () => {
    setupAdminUser();
    global.fetch = jest.fn().mockRejectedValue(new Error('Network Error'));
    render(<Nomina />);
    await act(async () => {});
    setFechas();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /calcular/i })); });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Network Error/i));
  });

  test('muestra mensaje cuando no hay resultados', async () => {
    setupAdminUser();
    mockFetchOkReporte([]);
    render(<Nomina />);
    await act(async () => {});
    setFechas();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /calcular/i })); });
    await waitFor(() => expect(screen.getByText(/no hay registros/i)).toBeInTheDocument());
  });

  test('botón Exportar PDF dispara el fetch con formato pdf', async () => {
    setupAdminUser();
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => REPORTE_FIXTURE })
      .mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['%PDF'], { type: 'application/pdf' }) });
    render(<Nomina />);
    await act(async () => {});
    setFechas();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /calcular/i })); });
    await waitFor(() => expect(screen.getByText('Operador Test')).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /exportar pdf/i })); });
    await waitFor(() => {
      const exportCall = global.fetch.mock.calls.find(c => c[0].includes('/api/nomina/exportar'));
      expect(exportCall).toBeDefined();
      expect(JSON.parse(exportCall[1].body)).toMatchObject({ formato: 'pdf' });
    });
  });

  test('botón Exportar Excel dispara el fetch con formato excel', async () => {
    setupAdminUser();
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => REPORTE_FIXTURE })
      .mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['xlsx'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }) });
    render(<Nomina />);
    await act(async () => {});
    setFechas();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /calcular/i })); });
    await waitFor(() => expect(screen.getByText('Operador Test')).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /exportar excel/i })); });
    await waitFor(() => {
      const exportCall = global.fetch.mock.calls.find(c => c[0].includes('/api/nomina/exportar'));
      expect(exportCall).toBeDefined();
      expect(JSON.parse(exportCall[1].body)).toMatchObject({ formato: 'excel' });
    });
  });

  test('redirige a / si el rol es operador', async () => {
    setupOperadorUser();
    global.fetch = jest.fn();
    render(<Nomina />);
    await act(async () => {});
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/'));
  });

  test('el botón calcular está deshabilitado sin fechas seleccionadas', async () => {
    setupAdminUser();
    global.fetch = jest.fn().mockImplementation(() => new Promise(() => {}));
    render(<Nomina />);
    await act(async () => {});
    expect(screen.getByRole('button', { name: /calcular/i })).toBeDisabled();
  });

  // Líneas 24-25: redirige cuando no hay usuario o token en localStorage
  test('redirige a / cuando no hay usuario en localStorage', async () => {
    localStorage.clear();
    render(<Nomina />);
    await act(async () => {});
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/'));
  });

  // Líneas 70-71: error cuando res.ok es false en calcularNomina
  test('muestra error cuando el servidor responde con error en calcularNomina', async () => {
    setupAdminUser();
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: jest.fn().mockResolvedValue({ error: 'Fechas inválidas' }),
    });
    render(<Nomina />);
    await act(async () => {});
    setFechas();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /calcular/i })); });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/fechas inválidas/i));
  });

  // Líneas 81-90: error del servidor en exportar
  test('muestra error cuando exportar falla en el servidor', async () => {
    setupAdminUser();
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => REPORTE_FIXTURE })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Error al exportar' }) });
    render(<Nomina />);
    await act(async () => {});
    setFechas();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /calcular/i })); });
    await waitFor(() => expect(screen.getByText('Operador Test')).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /exportar pdf/i })); });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/error al exportar/i));
  });

  // Líneas 177-185: toggleExpandido — expandir y colapsar filas
  test('expande y colapsa el detalle de un operador al hacer click', async () => {
    setupAdminUser();
    mockFetchOkReporte();
    render(<Nomina />);
    await act(async () => {});
    setFechas();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /calcular/i })); });
    await waitFor(() => expect(screen.getByText('Operador Test')).toBeInTheDocument());

    // Expandir
    fireEvent.click(screen.getByText('Operador Test'));
    await waitFor(() => expect(screen.getByText('LOTE-001')).toBeInTheDocument());

    // Colapsar
    fireEvent.click(screen.getByText('Operador Test'));
    await waitFor(() => expect(screen.queryByText('LOTE-001')).not.toBeInTheDocument());
  });

});