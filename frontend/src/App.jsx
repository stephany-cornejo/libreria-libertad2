import { useEffect, useState } from 'react';
import api from './services/api';

function App() {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [perfil, setPerfil] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [verificando, setVerificando] = useState(true);

  useEffect(() => {
    api.get('/api/perfil')
      .then((respuesta) => {
        setPerfil(respuesta.data);
      })
      .catch(() => {
        setPerfil(null);
      })
      .finally(() => {
        setVerificando(false);
      });
  }, []);

  async function iniciarSesion(evento) {
    evento.preventDefault();
    setError('');
    setCargando(true);

    try {
      await api.get('/sanctum/csrf-cookie');

      await api.post('/login', {
        usuario,
        password,
      });

      const respuesta = await api.get('/api/perfil');

      setPerfil(respuesta.data);
      setPassword('');
    } catch (err) {
      setError(
        err.response?.data?.errors?.usuario?.[0] ||
        err.response?.data?.message ||
        'No se pudo iniciar sesión.'
      );
    } finally {
      setCargando(false);
    }
  }

  async function cerrarSesion() {
    setError('');

    try {
      await api.post('/logout');
      setPerfil(null);
      setUsuario('');
      setPassword('');
    } catch {
      setError('No se pudo cerrar la sesión.');
    }
  }

  if (verificando) {
    return <p>Verificando sesión...</p>;
  }

  return (
    <main style={{
      maxWidth: '420px',
      margin: '80px auto',
      fontFamily: 'Arial',
      padding: '20px'
    }}>
      <h1>Librería Independencia</h1>

      {perfil ? (
        <section>
          <h2>Bienvenido, {perfil.nombre}</h2>
          <p>Usuario: {perfil.usuario}</p>
          <p>Rol: {perfil.rol}</p>
          <p>Estado: {perfil.estado}</p>

          <button onClick={cerrarSesion}>
            Cerrar sesión
          </button>
        </section>
      ) : (
        <form onSubmit={iniciarSesion}>
          <h2>Iniciar sesión</h2>

          <label htmlFor="usuario">Usuario</label>
          <input
            id="usuario"
            type="text"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            required
          />

          <br /><br />

          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <br /><br />

          <button type="submit" disabled={cargando}>
            {cargando ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      )}

      {error && (
        <p style={{ color: 'red' }}>{error}</p>
      )}
    </main>
  );
}

export default App;
