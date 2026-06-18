import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { API_URL } from '../lib/api';

export default function Login() {
  const router = useRouter();
  const [credenciales, setCredenciales] = useState({ usuario: '', password: '' });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const manejarCambio = (e) => {
    const { name, value } = e.target;
    setCredenciales({ ...credenciales, [name]: value });
  };

  const iniciarSesion = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: credenciales.usuario,
          password: credenciales.password
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Credenciales incorrectas');
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('usuario', JSON.stringify(data.usuario));

      if (data.usuario.rol === 'operador') {
        router.push('/operador');
      } else if (data.usuario.rol === 'supervisor') {
        router.push('/supervisor');
      } else {
        router.push('/dashboard');
      }

    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="container">
      <div className="login-card">
        <div className="login-header">
          <h2>Sistema de Producción</h2>
          <p>Inicia sesión para continuar</p>
        </div>

        <form onSubmit={iniciarSesion} className="form-group">
          <div className="input-group">
            <label htmlFor="usuario">Usuario o Matrícula</label>
            <input
              type="text"
              id="usuario"
              name="usuario"
              value={credenciales.usuario}
              onChange={manejarCambio}
              placeholder="Ej. operador@prueba.com"
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">Contraseña</label>
            <input
              type="password"
              id="password"
              name="password"
              value={credenciales.password}
              onChange={manejarCambio}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="btn-primary" disabled={cargando}>
            {cargando ? 'Verificando...' : 'Entrar al Sistema'}
          </button>
        </form>
      </div>

      <style jsx>{`
        .container { display: flex; justify-content: center; align-items: center; min-height: 100vh; background-color: #0f172a; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
        .login-card { background: white; padding: 2.5rem; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); width: 100%; max-width: 400px; }
        .login-header { text-align: center; margin-bottom: 2rem; }
        .login-header h2 { color: #1e293b; margin-bottom: 0.5rem; font-size: 1.5rem; }
        .login-header p { color: #64748b; font-size: 0.95rem; }
        .form-group { display: flex; flex-direction: column; gap: 1.2rem; }
        .input-group { display: flex; flex-direction: column; gap: 0.4rem; }
        label { font-weight: 600; font-size: 0.85rem; color: #334155; }
        input { padding: 0.8rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 1rem; transition: border-color 0.2s; }
        input:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
        .btn-primary { background-color: #2563eb; color: white; padding: 0.8rem; border: none; border-radius: 6px; font-size: 1rem; font-weight: bold; cursor: pointer; transition: background-color 0.2s; margin-top: 0.5rem; }
        .btn-primary:hover:not(:disabled) { background-color: #1d4ed8; }
        .btn-primary:disabled { background-color: #94a3b8; cursor: not-allowed; }
        .error-message { background-color: #fee2e2; color: #b91c1c; padding: 0.75rem; border-radius: 6px; font-size: 0.85rem; font-weight: bold; text-align: center; border: 1px solid #f87171; }
      `}</style>
    </div>
  );
}
