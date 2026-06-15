import React, { useEffect } from 'react';

export default function DashboardSupervisor() {
  // Datos simulados iniciales (Se llenarán con el GET /api/lotes/estado/:id)
  const lotes = [
    { id: 'LOTE-001', totales: 1000, acumuladas: 950, estado: 'activo' },
    { id: 'LOTE-002', totales: 500, acumuladas: 200, estado: 'activo' }
  ];

  // Implementación de Polling para refrescar datos cada 5 segundos
  useEffect(() => {
    const intervalo = setInterval(async () => {
      try {
        // Aquí harían el GET a /api/lotes/estado para todos los lotes activos
        // const res = await fetch('/api/lotes/estado/activos');
        // const data = await res.json();
        // setLotes(data);
        console.log("Actualizando dashboard en tiempo real...");
      } catch (e) {
        console.error("Error al actualizar:", e);
      }
    }, 5000);

    return () => clearInterval(intervalo); // Limpiar al salir de la pantalla
  }, []);

  return (
    <div className="container">
      <header className="header">
        <h1>Dashboard de Supervisión</h1>
        <button className="btn-reporte">Generar Reporte de Nómina</button>
      </header>

      <main className="grid">
        {lotes.map((lote) => {
          const porcentaje = (lote.acumuladas / lote.totales) * 100;
          const limiteCritico = porcentaje > 90; // Validación de alerta >90%

          return (
            <div key={lote.id} className={`lote-card ${limiteCritico ? 'border-alert' : ''}`}>
              <div className="lote-header">
                <h3>{lote.id}</h3>
                {limiteCritico && <span className="badge-alert">Límite Cercano</span>}
              </div>
              
              <div className="progress-info">
                <p>Progreso: <strong>{lote.acumuladas} / {lote.totales}</strong> piezas</p>
                <p>Disponibles: {lote.totales - lote.acumuladas}</p>
              </div>

              
              <div className="progress-bar-container">
                <div 
                  className={`progress-bar ${limiteCritico ? 'bg-danger' : 'bg-success'}`}
                  style={{ width: `${porcentaje}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </main>

      <style jsx>{`
        .container { padding: 2rem; background: #f4f6f9; min-height: 100vh; font-family: sans-serif; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
        h1 { color: #1e293b; font-size: 1.8rem; }
        .btn-reporte { background: #0f172a; color: white; padding: 0.6rem 1.2rem; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; }
        
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; }
        .lote-card { background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); transition: 0.3s; }
        .border-alert { border-left: 5px solid #ef4444; }
        
        .lote-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
        h3 { color: #334155; margin: 0; }
        .badge-alert { background: #fee2e2; color: #b91c1c; padding: 0.2rem 0.6rem; border-radius: 20px; font-size: 0.8rem; font-weight: bold; }
        
        .progress-info { color: #64748b; font-size: 0.95rem; margin-bottom: 1rem; }
        .progress-info p { margin: 0.3rem 0; }
        
        .progress-bar-container { width: 100%; background: #e2e8f0; height: 10px; border-radius: 10px; overflow: hidden; }
        .progress-bar { height: 100%; transition: width 0.5s ease-in-out; }
        .bg-success { background: #10b981; }
        .bg-danger { background: #ef4444; }
      `}</style>
    </div>
  );
}
