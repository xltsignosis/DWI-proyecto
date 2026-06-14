import React, { useState } from 'react';

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
      // Petición POST /api/produccion/registrar
      const response = await fetch('/api/produccion/registrar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Aquí iría el token JWT en el futuro
        },
        body: JSON.stringify({
          lote_id: loteId,
          piezas_nuevas: parseInt(piezasNuevas)
        }),
      });

      const data = await response.json();

      // Validación del Límite de Piezas (El backend rechaza con 400)
      if (response.status === 400) {
        setError(true);
        setMensaje(`Error: Límite excedido. El lote solo acepta ${data.piezas_disponibles} piezas más.`);
        return;
      }

      if (!response.ok) throw new Error('Error en el servidor');

      
      setMensaje(` ${piezasNuevas} piezas registradas correctamente en el lote ${loteId}.`);
      setPiezasNuevas(''); 

    } catch (err) {
      setError(true);
      setMensaje("Ocurrió un error al intentar comunicar con el servidor.");
    }
  };

  return (
    <div className="container">
      <div className="card">
        <h2>Panel de Operador</h2>
        <p>Registro de producción</p>

        <form onSubmit={manejarRegistro} className="form-group">
          <label>ID del Lote de Producción:</label>
          <input 
            type="text" 
            value={loteId} 
            onChange={(e) => setLoteId(e.target.value)} 
            required 
            placeholder="Ej. LOTE-001"
          />

          <label>Número de Piezas Fabricadas:</label>
          <input 
            type="number" 
            min="1"
            value={piezasNuevas} 
            onChange={(e) => setPiezasNuevas(e.target.value)} 
            required 
            placeholder="Ej. 15"
          />

          <button type="submit" className="btn-primary">Registrar Piezas</button>
        </form>

        
        {mensaje && (
          <div className={`alert ${error ? 'alert-danger' : 'alert-success'}`}>
            {mensaje}
          </div>
        )}
      </div>

      
      <style jsx>{`
        .container { display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f4f6f9; font-family: sans-serif; }
        .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); width: 100%; max-width: 400px; }
        h2 { margin-bottom: 0.5rem; color: #333; }
        p { color: #666; margin-bottom: 1.5rem; font-size: 0.9rem; }
        .form-group { display: flex; flex-direction: column; gap: 1rem; }
        label { font-weight: bold; font-size: 0.9rem; color: #444; }
        input { padding: 0.75rem; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem; }
        .btn-primary { background: #2563eb; color: white; padding: 0.75rem; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; transition: 0.2s; }
        .btn-primary:hover { background: #1d4ed8; }
        .alert { margin-top: 1.5rem; padding: 1rem; border-radius: 4px; font-weight: bold; text-align: center; }
        .alert-danger { background: #fee2e2; color: #b91c1c; border: 1px solid #f87171; }
        .alert-success { background: #dcfce7; color: #15803d; border: 1px solid #4ade80; }
      `}</style>
    </div>
  );
}