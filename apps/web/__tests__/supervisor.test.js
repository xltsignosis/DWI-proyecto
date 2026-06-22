import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import DashboardSupervisor from '../src/pages/supervisor';

jest.mock('next/router', () => ({
  useRouter: () => ({ push: jest.fn(), pathname: '/supervisor' }),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const LOTES_ABIERTOS = [
  {
    id: 1,
    codigo_lote: 'LOTE-001',
    total_piezas_requeridas: 1000,
    piezas_acumuladas: 500,
    piezas_disponibles: 500,
    porcentaje: 50,
    limite_cercano: false,
    estado: 'abierto'
  },
  {
    id: 2,
    codigo_lote: 'LOTE-002',
    total_piezas_requeridas: 500,
    piezas_acumuladas: 460,
    piezas_disponibles: 40,
    porcentaje: 92,
    limite_cercano: true,
    estado: 'abierto'
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mockFetchOk(data) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue(data),
  });
}

function mockFetchNetworkError(message = 'Network Error') {
  global.fetch = jest.fn().mockRejectedValue(new Error(message));
}

function mockFetchServerError(status = 500) {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status });
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------
beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001';
  sessionStorage.clear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('DashboardSupervisor', () => {
  // 1. Estado loading
  test('muestra estado loading inicialmente', () => {
    global.fetch = jest.fn().mockImplementation(() => new Promise(() => {}));
    render(<DashboardSupervisor />);
    expect(screen.getByRole('status')).toHaveTextContent(/cargando lotes/i);
  });

  // 2. Render con datos reales
  test('muestra datos reales al resolver el fetch', async () => {
    mockFetchOk(LOTES_ABIERTOS);
    render(<DashboardSupervisor />);

    await waitFor(() => {
      expect(screen.getByText('LOTE-001')).toBeInTheDocument();
      expect(screen.getByText('LOTE-002')).toBeInTheDocument();
    });

    expect(screen.getByText(/500 \/ 1000/)).toBeInTheDocument();
    expect(screen.getByText(/Disponibles: 500/)).toBeInTheDocument();
  });

  // 3. Error de red
  test('muestra mensaje de error en caso de error de red', async () => {
    mockFetchNetworkError('Network Error');
    render(<DashboardSupervisor />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Network Error/i);
    });
  });

  // 3b. Error de servidor (res.ok === false)
  test('muestra mensaje de error cuando el servidor responde con error', async () => {
    mockFetchServerError(503);
    render(<DashboardSupervisor />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/503/);
    });
  });

  // 4. Lista vacía
  test('muestra mensaje cuando no hay lotes abiertos', async () => {
    mockFetchOk([]);
    render(<DashboardSupervisor />);

    await waitFor(() => {
      expect(screen.getByText(/no hay lotes registrados/i)).toBeInTheDocument();
    });
  });

  test('muestra lotes abiertos y cerrados devueltos por el backend', async () => {
    mockFetchOk([
      {
        id: 1,
        codigo_lote: 'LOTE-A',
        total_piezas_requeridas: 1000,
        piezas_acumuladas: 500,
        piezas_disponibles: 500,
        porcentaje: 50,
        limite_cercano: false,
        estado: 'abierto'
      },
      {
        id: 2,
        codigo_lote: 'LOTE-B',
        total_piezas_requeridas: 500,
        piezas_acumuladas: 200,
        piezas_disponibles: 300,
        porcentaje: 40,
        limite_cercano: false,
        estado: 'cerrado'
      },
    ]);
    render(<DashboardSupervisor />);

    await waitFor(() => expect(screen.getByText('LOTE-A')).toBeInTheDocument());
    expect(screen.getByText('LOTE-B')).toBeInTheDocument();
  });

  // 5. Alerta aparece cuando porcentaje > 90%
  test('muestra la alerta Límite Cercano cuando acumuladas/totales > 90%', async () => {
    mockFetchOk([
      {
        id: 1,
        codigo_lote: 'LOTE-X',
        total_piezas_requeridas: 100,
        piezas_acumuladas: 91,
        piezas_disponibles: 9,
        porcentaje: 91,
        limite_cercano: true,
        estado: 'abierto'
      },
    ]);
    render(<DashboardSupervisor />);

    await waitFor(() => {
      expect(screen.getByText('Límite Cercano')).toBeInTheDocument();
    });
  });

  // 6. Alerta NO aparece cuando porcentaje ≤ 90%
  test('no muestra la alerta Límite Cercano cuando acumuladas/totales es exactamente 90%', async () => {
    mockFetchOk([
      {
        id: 1,
        codigo_lote: 'LOTE-X',
        total_piezas_requeridas: 100,
        piezas_acumuladas: 90,
        piezas_disponibles: 10,
        porcentaje: 90,
        limite_cercano: false,
        estado: 'abierto'
      },
    ]);
    render(<DashboardSupervisor />);

    await waitFor(() => expect(screen.getByText('LOTE-X')).toBeInTheDocument());
    expect(screen.queryByText('Límite Cercano')).not.toBeInTheDocument();
  });

  test('no muestra la alerta Límite Cercano cuando acumuladas/totales < 90%', async () => {
    mockFetchOk([
      {
        id: 1,
        codigo_lote: 'LOTE-X',
        total_piezas_requeridas: 100,
        piezas_acumuladas: 89,
        piezas_disponibles: 11,
        porcentaje: 89,
        limite_cercano: false,
        estado: 'abierto'
      },
    ]);
    render(<DashboardSupervisor />);

    await waitFor(() => expect(screen.getByText('LOTE-X')).toBeInTheDocument());
    expect(screen.queryByText('Límite Cercano')).not.toBeInTheDocument();
  });

  // 7. Polling hace fetch cada 5 segundos
  test('el polling realiza fetch cada 5 segundos', async () => {
    jest.useFakeTimers();
    mockFetchOk(LOTES_ABIERTOS);

    render(<DashboardSupervisor />);

    // Fetch inicial
    await act(async () => {
      jest.advanceTimersByTime(0);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Avanzar 5 s → segundo fetch
    await act(async () => {
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);

    // Avanzar otros 5 s → tercer fetch
    await act(async () => {
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(global.fetch).toHaveBeenCalledTimes(3);

    jest.useRealTimers();
  });

  // 8. Cleanup del intervalo al desmontar
  test('limpia el intervalo al desmontar el componente', async () => {
    jest.useFakeTimers();
    mockFetchOk(LOTES_ABIERTOS);

    const { unmount } = render(<DashboardSupervisor />);

    // Esperar fetch inicial
    await act(async () => {
      jest.advanceTimersByTime(0);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);

    unmount();
    global.fetch.mockClear();

    // Avanzar 15 s: el intervalo ya no debe dispararse
    act(() => {
      jest.advanceTimersByTime(15000);
    });

    expect(global.fetch).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  // Auth header
  test('incluye el token de sesión en el header Authorization', async () => {
    sessionStorage.setItem('session_token', 'test-session-token');
    mockFetchOk(LOTES_ABIERTOS);

    render(<DashboardSupervisor />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toContain('/api/lotes/estado');
    expect(options.headers).toMatchObject({
      Authorization: 'Bearer test-session-token',
    });
  });

  // Sin token → fetch sin Authorization header
  test('hace el fetch sin Authorization cuando no hay token en sessionStorage', async () => {
    mockFetchOk(LOTES_ABIERTOS);

    render(<DashboardSupervisor />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers).not.toHaveProperty('Authorization');
  });
});
