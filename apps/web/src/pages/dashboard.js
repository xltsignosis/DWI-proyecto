import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Dashboard() {
  const router = useRouter();

  useEffect(() => {
    const usuarioStr = localStorage.getItem('usuario');
    const token = localStorage.getItem('token');

    if (!usuarioStr || !token) {
      router.push('/');
      return;
    }

    const usuario = JSON.parse(usuarioStr);
    if (usuario.rol === 'administrador') {
      router.push('/nomina');
    } else if (usuario.rol === 'supervisor') {
      router.push('/supervisor');
    } else {
      router.push('/operador');
    }
  }, [router]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#0f172a', color: 'white', fontFamily: 'sans-serif' }}>
      <p>Redirigiendo...</p>
    </div>
  );
}