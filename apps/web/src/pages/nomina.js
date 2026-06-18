import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { API_URL } from '../lib/api';

function formatMXN(monto) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(monto);
}

export default function Nomina() {
  const router = useRouter();
  const [accesoDenegado, setAccesoDenegado] = useState(false);
  const [inicio, setInicio] = useState('');
  const [fin, setFin] = useState('');
  const [reporte, setReporte] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [calculado, setCalculado] = useState(false);
  const [expandidos, setExpandidos] = useState(new Set());

  useEffect(() => {
    const usuarioStr = localStorage.getItem('usuario');
    const token = localStorage.getItem('token');

    if (!usuarioStr || !token) {
      router.push('/');
      return;
    }

    const usuario = JSON.parse(usuarioStr);
    if (usuario.rol !== 'administrador') {
      setAccesoDenegado(true);
    }
  }, []);

  function token() {
    return localStorage.getItem('token');
  }

  async function calcularNomina() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_URL}/api/nomina/reporte?inicio=${inicio}&fin=${fin}`,
        { headers: { Authorization: `Bearer ${token()}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      setReporte(data);
      setCalculado(true);
    } catch (err) {
      setError(err.message || 'Error de red');
    } finally {
      setLoading(false);
    }
  }

  async function exportar(formato) {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/nomina/exportar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({ inicio, fin, formato }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al exportar');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nomina_${inicio}_${fin}.${formato === 'pdf' ? 'pdf' : 'xlsx'}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Error al exportar');
    }
  }

  function toggleExpandido(id) {
    setExpandidos(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (accesoDenegado) {
    return (
      <div className="container">
        <p className="error-msg" role="alert">
          Acceso denegado: solo administradores pueden ver la nómina.
        </p>
        <style jsx>{estilos}</style>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="header">
        <h1>Reporte de Nómina</h1>
      </header>

      <section className="periodo-selector">
        <div className="campo">
          <label htmlFor="inicio">Fecha inicio</label>
          <input
            id="inicio"
            type="date"
            value={inicio}
            onChange={e => setInicio(e.target.value)}
          />
        </div>
        <div className="campo">
          <label htmlFor="fin">Fecha fin</label>
          <input
            id="fin"
            type="date"
            value={fin}
            onChange={e => setFin(e.target.value)}
          />
        </div>
        <button
          className="btn-calcular"
          onClick={calcularNomina}
          disabled={!inicio || !fin || loading}
        >
          {loading ? 'Calculando...' : 'Calcular nómina'}
        </button>
      </section>

      {error && (
        <p className="error-msg" role="alert">
          {error}
        </p>
      )}

      {loading && (
        <p className="status-msg" role="status" aria-live="polite">
          Calculando nómina...
        </p>
      )}

      {calculado && !loading && !error && reporte.length === 0 && (
        <p className="empty-msg">No hay registros de producción en el periodo seleccionado.</p>
      )}

      {reporte.length > 0 && !loading && (
        <>
          <div className="acciones-export">
            <button
              className="btn-export btn-pdf"
              onClick={() => exportar('pdf')}
              aria-label="Exportar PDF"
            >
              Exportar PDF
            </button>
            <button
              className="btn-export btn-excel"
              onClick={() => exportar('excel')}
              aria-label="Exportar Excel"
            >
              Exportar Excel
            </button>
          </div>

          <table className="tabla-nomina">
            <thead>
              <tr>
                <th></th>
                <th>Operador</th>
                <th>Piezas totales</th>
                <th>Monto a pagar</th>
              </tr>
            </thead>
            <tbody>
              {reporte.map(op => (
                <React.Fragment key={op.operador_id}>
                  <tr
                    className="fila-operador"
                    onClick={() => toggleExpandido(op.operador_id)}
                  >
                    <td className="toggle">{expandidos.has(op.operador_id) ? '▼' : '▶'}</td>
                    <td>{op.nombre}</td>
                    <td>{op.piezas_totales}</td>
                    <td className="monto">{formatMXN(op.monto_total)}</td>
                  </tr>
                  {expandidos.has(op.operador_id) && op.detalle.map((d, i) => (
                    <tr key={i} className="fila-detalle">
                      <td></td>
                      <td colSpan={3} className="detalle-celda">
                        <span className="chip">{d.lote}</span>
                        <span className="chip">{d.tipo_pieza}</span>
                        {d.piezas} pzs × {formatMXN(d.tarifa)} ={' '}
                        <strong>{formatMXN(d.subtotal)}</strong>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </>
      )}

      <style jsx>{estilos}</style>
    </div>
  );
}

const estilos = `
  .container { padding: 2rem; background: #f4f6f9; min-height: 100vh; font-family: sans-serif; }
  .header { margin-bottom: 1.5rem; }
  h1 { color: #1e293b; font-size: 1.8rem; }
  .periodo-selector { display: flex; gap: 1rem; align-items: flex-end; flex-wrap: wrap; margin-bottom: 1.5rem; background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
  .campo { display: flex; flex-direction: column; gap: 0.4rem; }
  label { font-weight: 600; font-size: 0.85rem; color: #334155; }
  input[type="date"] { padding: 0.6rem 0.8rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 1rem; }
  .btn-calcular { background: #2563eb; color: white; padding: 0.65rem 1.4rem; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s; }
  .btn-calcular:hover:not(:disabled) { background: #1d4ed8; }
  .btn-calcular:disabled { background: #94a3b8; cursor: not-allowed; }
  .status-msg { color: #64748b; font-size: 1rem; text-align: center; padding: 2rem; }
  .error-msg { color: #b91c1c; background: #fee2e2; padding: 1rem 1.5rem; border-radius: 8px; border-left: 5px solid #ef4444; margin-bottom: 1rem; }
  .empty-msg { color: #64748b; text-align: center; padding: 2rem; }
  .acciones-export { display: flex; gap: 0.75rem; margin-bottom: 1rem; }
  .btn-export { padding: 0.55rem 1.1rem; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s; }
  .btn-pdf { background: #dc2626; color: white; }
  .btn-pdf:hover { background: #b91c1c; }
  .btn-excel { background: #16a34a; color: white; }
  .btn-excel:hover { background: #15803d; }
  .tabla-nomina { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
  .tabla-nomina thead { background: #1e293b; color: white; }
  .tabla-nomina th { padding: 0.75rem 1rem; text-align: left; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; }
  .tabla-nomina td { padding: 0.75rem 1rem; border-bottom: 1px solid #f1f5f9; font-size: 0.95rem; }
  .fila-operador { cursor: pointer; transition: background 0.15s; }
  .fila-operador:hover { background: #f8fafc; }
  .toggle { color: #64748b; font-size: 0.8rem; width: 1.5rem; }
  .monto { font-weight: bold; color: #15803d; }
  .fila-detalle td { background: #f8fafc; color: #64748b; font-size: 0.88rem; }
  .detalle-celda { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
  .chip { background: #e2e8f0; border-radius: 4px; padding: 0.1rem 0.5rem; font-size: 0.8rem; font-weight: 600; color: #475569; }
`;
