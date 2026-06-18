import React, { useState, useEffect, useCallback } from 'react';

function getAuthHeaders() {
  if (typeof window === 'undefined') return {};
  const token = sessionStorage.getItem('session_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function DashboardSupervisor() {
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLotes = useCallback(async () => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/lotes/estado`,
        { headers: getAuthHeaders() }
      );
      if (!res.ok) throw new Error(`Error del servidor: ${res.status}`);
      const data = await res.json();
      setLotes(data.filter((l) => l.estado === 'abierto'));
      setError(null);
    } catch (err) {
      setError(err.message || 'Error de red');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLotes();
    const intervalo = setInterval(fetchLotes, 5000);
    return () => clearInterval(intervalo);
  }, [fetchLotes]);

  return (
    <div className="container">
      {loading && (
        <p className="status-msg" role="status" aria-live="polite">
          Cargando lotes...
        </p>
      )}

      {error && (
        <p className="error-msg" role="alert">
          Error al cargar los datos: {error}
        </p>
      )}

      {!loading && !error && (
        <>
          <header className="header">
            <h1>Dashboard de Supervisión</h1>
            <button className="btn-reporte">Generar Reporte de Nómina</button>
          </header>

          <main className="grid">
            {lotes.length === 0 ? (
              <p className="empty-msg">No hay lotes abiertos en este momento.</p>
            ) : (
              lotes.map((lote) => {
                const porcentaje = (lote.piezas_acumuladas / lote.total_piezas_requeridas) * 100;
                const limiteCritico = porcentaje > 90;

                return (
                  <div
                    key={lote.id}
                    className={`lote-card${limiteCritico ? ' border-alert' : ''}`}
                  >
                    <div className="lote-header">
                      <h3>{lote.id}</h3>
                      {limiteCritico && (
                        <span className="badge-alert">Límite Cercano</span>
                      )}
                    </div>

                    <div className="progress-info">
                      <p>
                        Progreso:{' '}
                        <strong>
                          {lote.piezas_acumuladas} / {lote.total_piezas_requeridas}
                        </strong>{' '}
                        piezas
                      </p>
                      <p>Disponibles: {lote.piezas_disponibles}</p>
                    </div>

                    <div className="progress-bar-container">
                      <div
                        className={`progress-bar ${limiteCritico ? 'bg-danger' : 'bg-success'}`}
                        style={{ width: `${Math.min(porcentaje, 100)}%` }}
                        role="progressbar"
                        aria-valuenow={Math.round(porcentaje)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </main>
        </>
      )}

      <style jsx>{`
        .container {
          padding: 2rem;
          background: #f4f6f9;
          min-height: 100vh;
          font-family: sans-serif;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }
        h1 {
          color: #1e293b;
          font-size: 1.8rem;
        }
        .btn-reporte {
          background: #0f172a;
          color: white;
          padding: 0.6rem 1.2rem;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: bold;
        }
        .status-msg {
          color: #64748b;
          font-size: 1.1rem;
          text-align: center;
          padding: 4rem 0;
        }
        .error-msg {
          color: #b91c1c;
          background: #fee2e2;
          padding: 1rem 1.5rem;
          border-radius: 8px;
          border-left: 5px solid #ef4444;
          margin: 1rem 0;
        }
        .empty-msg {
          color: #64748b;
          font-size: 1rem;
          grid-column: 1 / -1;
          text-align: center;
          padding: 3rem 0;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.5rem;
        }
        .lote-card {
          background: white;
          padding: 1.5rem;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
          transition: 0.3s;
        }
        .border-alert {
          border-left: 5px solid #ef4444;
        }
        .lote-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }
        h3 {
          color: #334155;
          margin: 0;
        }
        .badge-alert {
          background: #fee2e2;
          color: #b91c1c;
          padding: 0.2rem 0.6rem;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: bold;
        }
        .progress-info {
          color: #64748b;
          font-size: 0.95rem;
          margin-bottom: 1rem;
        }
        .progress-info p {
          margin: 0.3rem 0;
        }
        .progress-bar-container {
          width: 100%;
          background: #e2e8f0;
          height: 10px;
          border-radius: 10px;
          overflow: hidden;
        }
        .progress-bar {
          height: 100%;
          transition: width 0.5s ease-in-out;
        }
        .bg-success {
          background: #10b981;
        }
        .bg-danger {
          background: #ef4444;
        }
      `}</style>
    </div>
  );
}
