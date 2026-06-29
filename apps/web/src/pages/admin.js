import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { apiUrl } from '../lib/api';

function getAuthHeaders() {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('token') || sessionStorage.getItem('session_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const BADGE_COLORS = {
  administrador: { bg: '#dbeafe', color: '#1d4ed8' },
  supervisor: { bg: '#d1fae5', color: '#065f46' },
  operador: { bg: '#f3f4f6', color: '#374151' },
};

export default function AdminUsuarios() {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState('operador');
  const [creando, setCreando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState('');

  const fetchUsuarios = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/usuarios'), {
        headers: getAuthHeaders()
      });
      if (res.status === 401 || res.status === 403) {
        router.push('/');
        return;
      }
      if (!res.ok) throw new Error(`Error del servidor: ${res.status}`);
      const data = await res.json();
      setUsuarios(data);
      setError(null);
    } catch (err) {
      setError(err.message || 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
  let activo = true;
  async function cargar() {
    if (activo) await fetchUsuarios();
  }
  cargar();
  return () => { activo = false; };
}, [fetchUsuarios]);

  const crearUsuario = async (e) => {
    e.preventDefault();
    if (!nombre || !email || !password) return;
    setCreando(true);
    setError(null);
    setMensajeExito('');
    try {
      const res = await fetch(apiUrl('/api/usuarios'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ nombre, email, password, rol })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear usuario');
      setNombre('');
      setEmail('');
      setPassword('');
      setRol('operador');
      setMensajeExito(`Usuario ${data.nombre} creado correctamente.`);
      fetchUsuarios();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreando(false);
    }
  };

  const cerrarSesion = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    sessionStorage.removeItem('session_token');
    router.push('/');
  };

  return (
    <div className="container">
      <header className="header">
        <h1>Panel de Administración</h1>
        <button className="btn-cerrar" onClick={cerrarSesion}>Cerrar sesión</button>
      </header>

      <section className="seccion">
        <h2>Nuevo usuario</h2>
        <form className="form-crear" onSubmit={crearUsuario}>
          <input
            placeholder="Nombre completo"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            required
          />
          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          <select value={rol} onChange={e => setRol(e.target.value)}>
            <option value="operador">Operador</option>
            <option value="supervisor">Supervisor</option>
            <option value="administrador">Administrador</option>
          </select>
          <button className="btn-crear" type="submit" disabled={creando}>
            {creando ? 'Creando...' : 'Crear usuario'}
          </button>
        </form>
        {mensajeExito && <p className="msg-exito">{mensajeExito}</p>}
        {error && <p className="msg-error">{error}</p>}
      </section>

      <section className="seccion">
        <h2>Usuarios registrados</h2>
        {loading && <p className="status-msg">Cargando usuarios...</p>}
        {!loading && usuarios.length === 0 && (
          <p className="empty-msg">Sin usuarios registrados.</p>
        )}
        {!loading && usuarios.length > 0 && (
          <table className="tabla">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Fecha de creación</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map(u => {
                const badge = BADGE_COLORS[u.rol] || BADGE_COLORS.operador;
                return (
                  <tr key={u.id}>
                    <td>{u.nombre}</td>
                    <td>{u.email}</td>
                    <td>
                      <span className="badge" style={{ background: badge.bg, color: badge.color }}>
                        {u.rol}
                      </span>
                    </td>
                    <td>{u.fecha_creacion ? new Date(u.fecha_creacion).toLocaleDateString('es-MX') : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <style jsx>{`
        .container { padding: 2rem; background: #f4f6f9; min-height: 100vh; font-family: sans-serif; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
        h1 { color: #1e293b; font-size: 1.8rem; margin: 0; }
        h2 { color: #334155; font-size: 1.2rem; margin-bottom: 1rem; }
        .btn-cerrar { background: #ef4444; color: white; padding: 0.5rem 1.2rem; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; }
        .btn-cerrar:hover { background: #dc2626; }
        .seccion { background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); margin-bottom: 2rem; }
        .form-crear { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; }
        .form-crear input, .form-crear select { padding: 0.6rem 1rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.95rem; flex: 1; min-width: 160px; }
        .btn-crear { background: #2563eb; color: white; padding: 0.6rem 1.2rem; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; white-space: nowrap; }
        .btn-crear:hover:not(:disabled) { background: #1d4ed8; }
        .btn-crear:disabled { background: #94a3b8; cursor: not-allowed; }
        .msg-exito { color: #065f46; background: #d1fae5; padding: 0.75rem 1rem; border-radius: 6px; margin-top: 1rem; font-weight: bold; }
        .msg-error { color: #b91c1c; background: #fee2e2; padding: 0.75rem 1rem; border-radius: 6px; margin-top: 1rem; font-weight: bold; }
        .status-msg { color: #64748b; text-align: center; padding: 2rem 0; }
        .empty-msg { color: #94a3b8; text-align: center; padding: 2rem 0; font-size: 0.95rem; }
        .tabla { width: 100%; border-collapse: collapse; font-size: 0.95rem; }
        .tabla th { text-align: left; padding: 0.75rem 1rem; background: #f8fafc; color: #64748b; font-weight: 600; font-size: 0.8rem; text-transform: uppercase; border-bottom: 2px solid #e2e8f0; }
        .tabla td { padding: 0.75rem 1rem; border-bottom: 1px solid #f1f5f9; color: #334155; }
        .tabla tr:last-child td { border-bottom: none; }
        .tabla tr:hover td { background: #f8fafc; }
        .badge { padding: 0.2rem 0.7rem; border-radius: 20px; font-size: 0.78rem; font-weight: 600; }
      `}</style>
    </div>
  );
}
