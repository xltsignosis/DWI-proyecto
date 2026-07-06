import React, { useState } from 'react';
import { apiUrl } from '../lib/api';
import { useRouter } from 'next/router';



export default function PanelOperador() {
  const [loteId, setLoteId] = useState('');
  const [piezasNuevas, setPiezasNuevas] = useState('');
  const [lote, setLote] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(false);
  const router = useRouter();

  const consultarLote = async (referencia) => {
    const valor = referencia.trim();
    if (!valor) {
      setLote(null);
      return null;
    }

    const token = localStorage.getItem('token');
    const response = await fetch(apiUrl(`/api/lotes/estado/${encodeURIComponent(valor)}`), {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    const data = await response.json();

    if (response.status === 401) {
      throw new Error('Sesión inválida. Cierra sesión e inicia sesión de nuevo.');
    }

    if (!response.ok) {
      throw new Error(data.error || 'No se pudo consultar el lote');
    }

    setLote(data);
    return data;
  };

  const manejarCambioLote = async (e) => {
    const valor = e.target.value;
    setLoteId(valor);
    setMensaje(null);
    setError(false);

    try {
      await consultarLote(valor);
    } catch (err) {
      setLote(null);
      if (valor.trim()) {
        setError(true);
        setMensaje(err.message);
      }
    }
  };

  const manejarRegistro = async (e) => {
    e.preventDefault();
    setMensaje(null);
    setError(false);

    try {
      const usuarioString = localStorage.getItem('usuario');
      const token = localStorage.getItem('token');

      if (!usuarioString) {
        throw new Error("No hay sesión activa. Por favor, inicia sesión de nuevo.");
      }

      const usuario = JSON.parse(usuarioString);
      if (!usuario?.id) {
        localStorage.removeItem('usuario');
        localStorage.removeItem('token');
        throw new Error("Sesión inválida. Cierra sesión e inicia sesión de nuevo.");
      }

      const response = await fetch(apiUrl('/api/produccion/registrar'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          lote_id: lote?.id || loteId,
          usuario_id: usuario.id,
          piezas_nuevas: Number(piezasNuevas)
        }),
      });

      const data = await response.json();

      if (response.status === 400) {
        setError(true);
        setMensaje(data.error || 'Error: Límite excedido.');
        return;
      }

      if (!response.ok) throw new Error(data.detalle ? `${data.error}: ${data.detalle}` : data.error || 'Error en el servidor');

      setLote(data.lote || null);
      setMensaje(`${piezasNuevas} piezas registradas correctamente en el lote ${loteId}.`);
      setPiezasNuevas('');

    } catch (err) {
      setError(true);
      setMensaje(err.message || "Ocurrió un error al comunicar con el servidor.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    sessionStorage.removeItem('session_token');
    router.push('/');
  }

  return (
    <div className="container">
      <header className="topbar">
        <div>
          <span className="eyebrow">Producción</span>
          <h1>Panel de Operador</h1>
        </div>
        <button className="btn-logout" onClick={handleLogout}>Cerrar sesión</button>
      </header>

      <div className="card">
        <div className="card-header">
          <div>
            <h2>Registro de piezas</h2>
            <p>Consulta el lote y registra la producción del turno.</p>
          </div>
          {lote && <span className={`status-pill ${lote.estado === 'cerrado' ? 'is-closed' : ''}`}>{lote.estado}</span>}
        </div>

        <form onSubmit={manejarRegistro} className="form-group">
          <div className="field">
            <label>ID o código del lote</label>
            <input type="text" value={loteId} onChange={manejarCambioLote} required placeholder="Ej. 5 o LOTE-003" />
          </div>

          {lote && (
            <div className="lote-status">
              <div>
                <span>Disponibles</span>
                <strong>{lote.piezas_disponibles}</strong>
              </div>
              <div className="lote-meta">
                <span>{lote.codigo_lote}</span>
                <small>{lote.piezas_acumuladas} / {lote.total_piezas_requeridas} piezas registradas</small>
              </div>
            </div>
          )}

          <div className="field">
            <label>Número de piezas fabricadas</label>
            <input type="number" min="1" max={lote?.piezas_disponibles || undefined} value={piezasNuevas} onChange={(e) => setPiezasNuevas(e.target.value)} required placeholder="Ej. 15" />
          </div>

          <button type="submit" className="btn-primary">Registrar Piezas</button>
        </form>

        {mensaje && (
          <div className={`alert ${error ? 'alert-danger' : 'alert-success'}`}>
            {mensaje}
          </div>
        )}
      </div>

      <style jsx>{`
        .container { min-height: 100vh; background: #f3f6fb; color: #0f172a; font-family: sans-serif; padding: 1.5rem; }
        .topbar { display: flex; justify-content: space-between; align-items: center; max-width: 760px; margin: 0 auto 1.5rem; gap: 1rem; }
        .eyebrow { color: #2563eb; font-size: 0.78rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
        h1 { margin: 0.2rem 0 0; font-size: 1.8rem; color: #0f172a; }
        .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 18px 45px rgba(15, 23, 42, 0.10); width: 100%; max-width: 760px; margin: 0 auto; border: 1px solid #e2e8f0; }
        .card-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 1.5rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 1rem; }
        h2 { margin: 0 0 0.35rem; color: #1e293b; }
        p { color: #64748b; margin: 0; font-size: 0.95rem; }
        .form-group { display: flex; flex-direction: column; gap: 1.2rem; }
        .field { display: flex; flex-direction: column; gap: 0.45rem; }
        label { font-weight: 600; font-size: 0.85rem; color: #334155; }
        input { padding: 0.85rem 0.95rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 1rem; background: #ffffff; }
        input:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
        .lote-status { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 1rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
        .lote-status span { color: #64748b; font-size: 0.85rem; font-weight: 600; }
        .lote-status strong { color: #0f172a; font-size: 2rem; line-height: 1; }
        .lote-meta { display: grid; gap: 0.25rem; text-align: right; }
        .lote-meta span { color: #1d4ed8; font-size: 1rem; }
        .lote-status small { color: #475569; }
        .status-pill { background: #dcfce7; color: #15803d; border-radius: 999px; padding: 0.35rem 0.7rem; font-size: 0.78rem; font-weight: 800; text-transform: capitalize; }
        .status-pill.is-closed { background: #fee2e2; color: #b91c1c; }
        .btn-primary { background: #2563eb; color: white; padding: 0.9rem; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; box-shadow: 0 8px 18px rgba(37, 99, 235, 0.25); }
        .btn-primary:hover { background: #1d4ed8; }
        .alert { margin-top: 1.5rem; padding: 1rem; border-radius: 8px; font-weight: bold; text-align: center; }
        .alert-danger { background: #fee2e2; color: #b91c1c; border: 1px solid #f87171; }
        .alert-success { background: #dcfce7; color: #15803d; border: 1px solid #4ade80; }
        .btn-logout { background: white; color: #b91c1c; border: 1px solid #fecaca; padding: 0.65rem 1rem; border-radius: 8px; cursor: pointer; font-weight: 800; box-shadow: 0 6px 16px rgba(15, 23, 42, 0.08); }
        .btn-logout:hover { background: #fee2e2; }
        @media (max-width: 640px) {
          .container { padding: 1rem; }
          .topbar, .card-header, .lote-status { flex-direction: column; align-items: stretch; }
          .btn-logout { width: 100%; }
          .lote-meta { text-align: left; }
        }
      `}</style>
    </div>
  );
}
