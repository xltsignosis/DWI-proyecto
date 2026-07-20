import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { apiUrl } from '../lib/api';

function getAuthHeaders() {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('token') || sessionStorage.getItem('session_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function DashboardSupervisor() {
  const router = useRouter();
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [codigo, setCodigo] = useState('');
  const [total, setTotal] = useState('');
  const [rolUsuario, setRolUsuario] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [editForm, setEditForm] = useState({ codigo_lote: '', total_piezas_requeridas: '' });

  const fetchLotes = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/lotes/estado'), { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`Error del servidor: ${res.status}`);
      const data = await res.json();
      setLotes(data);
      setError(null);
    } catch (err) {
      setError(err.message || 'Error de red');
    } finally {
      setLoading(false);
    }
  }, []);

  const crearLote = async () => {
    if (!codigo || !total) return;
    try {
      const res = await fetch(apiUrl('/api/lotes'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ codigo_lote: codigo, total_piezas_requeridas: parseInt(total) })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al crear lote');
      }
      setCodigo('');
      setTotal('');
      fetchLotes();
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    const usuarioStr = localStorage.getItem('usuario');
    if (usuarioStr) {
      try {
        const usuario = JSON.parse(usuarioStr);
        setRolUsuario(usuario.rol);
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    const cargaInicial = setTimeout(fetchLotes, 0);
    const intervalo = setInterval(fetchLotes, 5000);
    return () => {
      clearTimeout(cargaInicial);
      clearInterval(intervalo);
    };
  }, [fetchLotes]);

  const editarLote = async (id) => {
    try {
      const res = await fetch(apiUrl(`/api/lotes/${id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          codigo_lote: editForm.codigo_lote,
          total_piezas_requeridas: parseInt(editForm.total_piezas_requeridas),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al actualizar lote');
      }
      setEditandoId(null);
      fetchLotes();
    } catch (err) {
      setError(err.message);
    }
  };

  const eliminarLote = async (id) => {
    if (!window.confirm('¿Eliminar este lote? Esta acción no se puede deshacer.')) return;
    try {
      const res = await fetch(apiUrl(`/api/lotes/${id}`), {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al eliminar lote');
      }
      fetchLotes();
    } catch (err) {
      setError(err.message);
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
      {loading && <p className="status-msg" role="status">Cargando lotes...</p>}
      {error && <p className="error-msg" role="alert">Error al cargar los datos: {error}</p>}

      {!loading && !error && (
        <>
          <header className="header">
            <div>
              <span className="eyebrow">Supervisión</span>
              <h1>Dashboard de Producción</h1>
            </div>
            <div className="header-actions">
              <button className="btn-reporte" onClick={() => router.push('/nomina')}>Generar reporte</button>
              <button className="btn-logout" onClick={handleLogout}>Cerrar sesión</button>
            </div>
          </header>
          

          <form className="crear-lote" onSubmit={(e) => { e.preventDefault(); crearLote(); }}>
            <div>
              <label>Código del lote</label>
              <input placeholder="Código del lote" value={codigo} onChange={e => setCodigo(e.target.value)} />
            </div>
            <div>
              <label>Total de piezas</label>
              <input type="number" placeholder="Total de piezas" value={total} onChange={e => setTotal(e.target.value)} />
            </div>
            <button className="btn-crear" type="submit">Crear lote</button>
          </form>

          <main className="grid">
            {lotes.length === 0 ? (
              <p className="empty-msg">No hay lotes registrados.</p>
            ) : (
              lotes.map((lote) => {
                const limiteCritico = lote.limite_cercano || lote.porcentaje > 90;
                return (
                  <div key={lote.id} className={`lote-card${limiteCritico ? ' border-alert' : ''}`}>
                    <div className="lote-header">
                      <div>
                        <h3>{lote.codigo_lote}</h3>
                        <span className={`estado-pill ${lote.estado === 'cerrado' ? 'is-closed' : ''}`}>{lote.estado}</span>
                      </div>
                      {limiteCritico && <span className="badge-alert">Límite Cercano</span>}
                    </div>
                    <div className="progress-info">
                      <div className="metric">
                        <span>Progreso</span>
                        <strong>{lote.piezas_acumuladas} / {lote.total_piezas_requeridas}</strong>
                      </div>
                      <div className="metric">
                        <span>Disponibles</span>
                        <strong>{lote.piezas_disponibles}</strong>
                      </div>
                    </div>
                    <div className="progress-bar-container">
                      <div
                        className={`progress-bar ${limiteCritico ? 'bg-danger' : 'bg-success'}`}
                        style={{ width: `${Math.min(lote.porcentaje, 100)}%` }}
                      />
                    </div>
                    {editandoId === lote.id ? (
                      <form className="edit-form" onSubmit={(e) => { e.preventDefault(); editarLote(lote.id); }}>
                        <input
                          value={editForm.codigo_lote}
                          onChange={e => setEditForm({ ...editForm, codigo_lote: e.target.value })}
                          placeholder="Código del lote"
                        />
                        <input
                          type="number"
                          value={editForm.total_piezas_requeridas}
                          onChange={e => setEditForm({ ...editForm, total_piezas_requeridas: e.target.value })}
                          placeholder="Total de piezas"
                        />
                        <div className="edit-form-actions">
                          <button className="btn-guardar" type="submit">Guardar</button>
                          <button className="btn-cancelar" type="button" onClick={() => setEditandoId(null)}>Cancelar</button>
                        </div>
                      </form>
                    ) : (
                      <div className="lote-acciones">
                        <button
                          className="btn-editar"
                          onClick={() => {
                            setEditandoId(lote.id);
                            setEditForm({ codigo_lote: lote.codigo_lote, total_piezas_requeridas: String(lote.total_piezas_requeridas) });
                          }}
                        >
                          Editar
                        </button>
                        {rolUsuario === 'administrador' && (
                          <button className="btn-eliminar" onClick={() => eliminarLote(lote.id)}>
                            Eliminar
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </main>
        </>
      )}

      <style jsx>{`
        .container { padding: 2rem; background: #f3f6fb; min-height: 100vh; font-family: sans-serif; color: #0f172a; }
        .header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
        .header-actions { display: flex; justify-content: flex-end; align-items: center; gap: 0.75rem; }
        .eyebrow { color: #2563eb; font-size: 0.78rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
        h1 { color: #0f172a; font-size: 1.9rem; margin: 0.2rem 0 0; }
        .btn-reporte { background: #0f172a; color: white; padding: 0.7rem 1rem; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; box-shadow: 0 8px 18px rgba(15, 23, 42, 0.18); }
        .crear-lote { display: grid; grid-template-columns: minmax(180px, 1fr) minmax(160px, 220px) auto; gap: 1rem; align-items: end; margin-bottom: 2rem; background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; box-shadow: 0 10px 26px rgba(15, 23, 42, 0.06); }
        .crear-lote div { display: flex; flex-direction: column; gap: 0.4rem; }
        label { color: #334155; font-size: 0.85rem; font-weight: 700; }
        .crear-lote input { padding: 0.75rem 0.9rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.95rem; flex: 1; }
        .crear-lote input:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.10); }
        .btn-crear { background: #2563eb; color: white; padding: 0.8rem 1.2rem; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; }
        .status-msg { color: #64748b; font-size: 1.1rem; text-align: center; padding: 4rem 0; }
        .error-msg { color: #b91c1c; background: #fee2e2; padding: 1rem 1.5rem; border-radius: 8px; border-left: 5px solid #ef4444; margin: 1rem 0; }
        .empty-msg { color: #64748b; font-size: 1rem; grid-column: 1 / -1; text-align: center; padding: 3rem 0; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; }
        .lote-card { background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08); transition: 0.3s; border: 1px solid #e2e8f0; }
        .lote-card:hover { transform: translateY(-2px); box-shadow: 0 16px 36px rgba(15, 23, 42, 0.12); }
        .border-alert { border-left: 5px solid #ef4444; }
        .lote-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
        h3 { color: #334155; margin: 0; }
        .badge-alert { background: #fee2e2; color: #b91c1c; padding: 0.25rem 0.65rem; border-radius: 999px; font-size: 0.8rem; font-weight: bold; }
        .estado-pill { display: inline-block; margin-top: 0.35rem; background: #dcfce7; color: #15803d; border-radius: 999px; padding: 0.25rem 0.6rem; font-size: 0.75rem; font-weight: 800; text-transform: capitalize; }
        .estado-pill.is-closed { background: #fee2e2; color: #b91c1c; }
        .progress-info { color: #64748b; font-size: 0.95rem; margin-bottom: 1rem; display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
        .metric { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.85rem; display: grid; gap: 0.25rem; }
        .metric span { color: #64748b; font-size: 0.78rem; font-weight: 700; }
        .metric strong { color: #0f172a; font-size: 1.1rem; }
        .progress-bar-container { width: 100%; background: #e2e8f0; height: 10px; border-radius: 10px; overflow: hidden; }
        .progress-bar { height: 100%; transition: width 0.5s ease-in-out; }
        .bg-success { background: #10b981; }
        .bg-danger { background: #ef4444; }
        

        .btn-logout { 
        background: white; 
        color: #b91c1c; 
        border: 1px solid #fecaca; 
        padding: 0.7rem 1rem; 
        border-radius: 8px; 
        cursor: pointer; 
        font-weight: bold; 
        }
      .btn-logout:hover { background: #fee2e2; }
        .lote-acciones { display: flex; gap: 0.5rem; margin-top: 1rem; }
        .btn-editar { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; padding: 0.4rem 0.85rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 600; }
        .btn-editar:hover { background: #e2e8f0; }
        .btn-eliminar { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; padding: 0.4rem 0.85rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 600; }
        .btn-eliminar:hover { background: #fecaca; }
        .edit-form { margin-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
        .edit-form input { padding: 0.55rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.9rem; }
        .edit-form input:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
        .edit-form-actions { display: flex; gap: 0.5rem; }
        .btn-guardar { background: #2563eb; color: white; border: none; padding: 0.45rem 1rem; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.85rem; }
        .btn-guardar:hover { background: #1d4ed8; }
        .btn-cancelar { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; padding: 0.45rem 1rem; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.85rem; }
        .btn-cancelar:hover { background: #e2e8f0; }
      @media (max-width: 760px) {
        .container { padding: 1rem; }
        .header { align-items: stretch; flex-direction: column; }
        .header-actions { justify-content: stretch; flex-direction: column; }
        .btn-reporte, .btn-logout { width: 100%; }
        .crear-lote { grid-template-columns: 1fr; }
      }
      @media (max-width: 520px) {
        .progress-info { grid-template-columns: 1fr; }
      }
      `}</style>
    </div>
  );
}
