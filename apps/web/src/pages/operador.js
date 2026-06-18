import React, { useState } from 'react';
import { API_URL } from '../lib/api';

export default function PanelOperador() {
  const [loteId, setLoteId] = useState('');
  const [piezasNuevas, setPiezasNuevas] = useState('');
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(false);

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

      const response = await fetch(`${API_URL}/api/produccion/registrar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          lote_id: loteId,
          usuario_id: usuario.id,
          piezas_nuevas: parseInt(piezasNuevas)
        }),
      });

      const data = await response.json();

      if (response.status === 400) {
        setError(true);
        setMensaje(data.error || 'Error: Límite excedido.');
        return;
      }

      if (!response.ok) throw new Error(data.error || 'Error en el servidor');

      setMensaje(`${piezasNuevas} piezas registradas correctamente en el lote ${loteId}.`);
      setPiezasNuevas('');

    } catch (err) {
      setError(true);
      setMensaje(err.message || "Ocurrió un error al comunicar con el servidor.");
    }
  };

  return (
    <div className="container">
      <div className="card">
        <h2>Panel de Operador</h2>
        <p>Registro de producción</p>

        <form onSubmit={manejarRegistro} className="form-group">
          <label>ID Numérico del Lote:</label>
          <input type="number" value={loteId} onChange={(e) => setLoteId(e.target.value)} required placeholder="Ej. 1" />

          <label>Número de Piezas Fabricadas:</label>
          <input type="number" min="1" value={piezasNuevas} onChange={(e) => setPiezasNuevas(e.target.value)} required placeholder="Ej. 15" />

          <button type="submit" className="btn-primary">Registrar Piezas</button>
        </form>

        {mensaje && (
          <div className={`alert ${error ? 'alert-danger' : 'alert-success'}`}>
            {mensaje}
          </div>
        )}
      </div>

      <style jsx>{`
        .container { display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #0f172a; font-family: sans-serif; }
        .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); width: 100%; max-width: 400px; }
        h2 { margin-bottom: 0.5rem; color: #1e293b; }
        p { color: #64748b; margin-bottom: 1.5rem; font-size: 0.95rem; }
        .form-group { display: flex; flex-direction: column; gap: 1.2rem; }
        label { font-weight: 600; font-size: 0.85rem; color: #334155; }
        input { padding: 0.8rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 1rem; }
        input:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
        .btn-primary { background: #2563eb; color: white; padding: 0.8rem; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; }
        .btn-primary:hover { background: #1d4ed8; }
        .alert { margin-top: 1.5rem; padding: 1rem; border-radius: 6px; font-weight: bold; text-align: center; }
        .alert-danger { background: #fee2e2; color: #b91c1c; border: 1px solid #f87171; }
        .alert-success { background: #dcfce7; color: #15803d; border: 1px solid #4ade80; }
      `}</style>
    </div>
  );
}
