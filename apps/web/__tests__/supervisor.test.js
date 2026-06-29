import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import DashboardSupervisor from '../src/pages/supervisor';

jest.mock('next/router', () => ({
  useRouter: () => ({ push: jest.fn(), pathname: '/supervisor' }),
}));

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

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001';
  sessionStorage.clear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('DashboardSupervisor', () => {
  test('muestra estado loading inicialmente', () => {
    global.fetch = jest.fn().mockImplementation(() => new Promise(() => {}));
    render(<DashboardSupervisor />);
    expect(screen.getByRole('status')).toHaveTextContent(/cargando lotes/i);
  });

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

  test('muestra mensaje de error en caso de error de red', async () => {
    mockFetchNetworkError('Network Error');
    render(<DashboardSupervisor />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Network Error/i);
    });
  });

  test('muestra mensaje de error cuando el servidor responde con error', async () => {
    mockFetchServerError(503);
    render(<DashboardSupervisor />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/503/);
    });
  });

  test('muestra mensaje cuando no hay lotes abiertos', async () => {
    mockFetchOk([]);
    render(<DashboardSupervisor />);
    await waitFor(() => {
      expect(screen.getByText(/no hay lotes registrados/i)).toBeInTheDocument();
    });
  });

  test('muestra lotes abiertos y cerrados devueltos por el backend', async () => {
    mockFetchOk([
      { id: 1, codigo_lote: 'LOTE-A', total_piezas_requeridas: 1000, piezas_acumuladas: 500, piezas_disponibles: 500, porcentaje: 50, limite_cercano: false, estado: 'abierto' },
      { id: 2, codigo_lote: 'LOTE-B', total_piezas_requeridas: 500, piezas_acumuladas: 200, piezas_disponibles: 300, porcentaje: 40, limite_cercano: false, estado: 'cerrado' },
    ]);
    render(<DashboardSupervisor />);
    await waitFor(() => expect(screen.getByText('LOTE-A')).toBeInTheDocument());
    expect(screen.getByText('LOTE-B')).toBeInTheDocument();
  });

  test('muestra la alerta Límite Cercano cuando porcentaje > 90%', async () => {
    mockFetchOk([
      { id: 1, codigo_lote: 'LOTE-X', total_piezas_requeridas: 100, piezas_acumuladas: 91, piezas_disponibles: 9, porcentaje: 91, limite_cercano: true, estado: 'abierto' },
    ]);
    render(<DashboardSupervisor />);
    await waitFor(() => {
      expect(screen.getByText('Límite Cercano')).toBeInTheDocument();
    });
  });

  test('no muestra la alerta Límite Cercano cuando porcentaje es exactamente 90%', async () => {
    mockFetchOk([
      { id: 1, codigo_lote: 'LOTE-X', total_piezas_requeridas: 100, piezas_acumuladas: 90, piezas_disponibles: 10, porcentaje: 90, limite_cercano: false, estado: 'abierto' },
    ]);
    render(<DashboardSupervisor />);
    await waitFor(() => expect(screen.getByText('LOTE-X')).toBeInTheDocument());
    expect(screen.queryByText('Límite Cercano')).not.toBeInTheDocument();
  });

  test('no muestra la alerta Límite Cercano cuando porcentaje < 90%', async () => {
    mockFetchOk([
      { id: 1, codigo_lote: 'LOTE-X', total_piezas_requeridas: 100, piezas_acumuladas: 89, piezas_disponibles: 11, porcentaje: 89, limite_cercano: false, estado: 'abierto' },
    ]);
    render(<DashboardSupervisor />);
    await waitFor(() => expect(screen.getByText('LOTE-X')).toBeInTheDocument());
    expect(screen.queryByText('Límite Cercano')).not.toBeInTheDocument();
  });

  test('el polling realiza fetch cada 5 segundos', async () => {
    jest.useFakeTimers();
    mockFetchOk(LOTES_ABIERTOS);
    render(<DashboardSupervisor />);
    await act(async () => { jest.advanceTimersByTime(0); await Promise.resolve(); await Promise.resolve(); });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    await act(async () => { jest.advanceTimersByTime(5000); await Promise.resolve(); await Promise.resolve(); });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    await act(async () => { jest.advanceTimersByTime(5000); await Promise.resolve(); await Promise.resolve(); });
    expect(global.fetch).toHaveBeenCalledTimes(3);
    jest.useRealTimers();
  });

  test('limpia el intervalo al desmontar el componente', async () => {
    jest.useFakeTimers();
    mockFetchOk(LOTES_ABIERTOS);
    const { unmount } = render(<DashboardSupervisor />);
    await act(async () => { jest.advanceTimersByTime(0); await Promise.resolve(); await Promise.resolve(); });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    unmount();
    global.fetch.mockClear();
    act(() => { jest.advanceTimersByTime(15000); });
    expect(global.fetch).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  test('incluye el token de sesión en el header Authorization', async () => {
    sessionStorage.setItem('session_token', 'test-session-token');
    mockFetchOk(LOTES_ABIERTOS);
    render(<DashboardSupervisor />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toContain('/api/lotes/estado');
    expect(options.headers).toMatchObject({ Authorization: 'Bearer test-session-token' });
  });

  test('hace el fetch sin Authorization cuando no hay token', async () => {
    mockFetchOk(LOTES_ABIERTOS);
    render(<DashboardSupervisor />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers).not.toHaveProperty('Authorization');
  });

  test('crea un lote exitosamente al enviar el formulario', async () => {
    mockFetchOk(LOTES_ABIERTOS);
    render(<DashboardSupervisor />);
    await waitFor(() => expect(screen.getByText('LOTE-001')).toBeInTheDocument());

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText(/código del lote/i), { target: { value: 'LOTE-NEW' } });
      fireEvent.change(screen.getByPlaceholderText(/total de piezas/i), { target: { value: '200' } });
      fireEvent.click(screen.getByText(/crear lote/i));
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/lotes'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  test('muestra error cuando crearLote falla en el servidor', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue(LOTES_ABIERTOS) })
      .mockResolvedValueOnce({ ok: false, json: jest.fn().mockResolvedValue({ error: 'Lote duplicado' }) });

    render(<DashboardSupervisor />);
    await waitFor(() => expect(screen.getByText('LOTE-001')).toBeInTheDocument());

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText(/código del lote/i), { target: { value: 'LOTE-DUP' } });
      fireEvent.change(screen.getByPlaceholderText(/total de piezas/i), { target: { value: '100' } });
      fireEvent.click(screen.getByText(/crear lote/i));
    });

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/lote duplicado/i));
  });

  test('no llama fetch si codigo o total están vacíos', async () => {
    mockFetchOk(LOTES_ABIERTOS);
    render(<DashboardSupervisor />);
    await waitFor(() => expect(screen.getByText('LOTE-001')).toBeInTheDocument());

    const callsBefore = global.fetch.mock.calls.length;
    await act(async () => {
      fireEvent.click(screen.getByText(/crear lote/i));
    });
    expect(global.fetch.mock.calls.length).toBe(callsBefore);
  });

  test('navega a /nomina al hacer click en Generar Reporte', async () => {
    const pushMock = jest.fn();
    jest.spyOn(require('next/router'), 'useRouter').mockReturnValue({ push: pushMock, pathname: '/supervisor' });

    mockFetchOk(LOTES_ABIERTOS);
    render(<DashboardSupervisor />);
    await waitFor(() => expect(screen.getByText('LOTE-001')).toBeInTheDocument());

    fireEvent.click(screen.getByText(/generar reporte/i));
    expect(pushMock).toHaveBeenCalledWith('/nomina');
  });
});