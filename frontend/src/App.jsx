
import { useEffect, useState } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Link,
  Outlet,
  useNavigate,
} from 'react-router-dom';

import api from './services/api';
import Usuarios from './pages/Usuarios';
import Catalogo from './pages/Catalogo';

// Módulos del sistema
const modulos = [
  { nombre: 'Productos', ruta: '/productos' },
  { nombre: 'Categorías', ruta: '/categorias', admin: true },
  { nombre: 'Proveedores', ruta: '/proveedores', pendiente: true, admin: true },
  { nombre: 'Usuarios', ruta: '/usuarios', admin: true },
  { nombre: 'Movimientos', ruta: '/movimientos', pendiente: true },
  { nombre: 'Reportes', ruta: '/reportes', pendiente: true },
];

// LOGIN
function Login({ onLogin }) {
  const navigate = useNavigate();

  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

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

      onLogin(respuesta.data);
      navigate('/dashboard', { replace: true });

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

  return (
    <main style={estilos.login}>
      <h1>Librería Independencia</h1>
      <p>Sistema de Gestión de Inventario</p>

      <form
        onSubmit={iniciarSesion}
        style={estilos.formulario}
      >
        <h2>Iniciar sesión</h2>

        <label htmlFor="usuario">Usuario</label>
        <input
          id="usuario"
          type="text"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          required
        />

        <label htmlFor="password">Contraseña</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && (
          <p style={{ color: 'crimson' }}>
            {error}
          </p>
        )}

        <button type="submit" disabled={cargando}>
          {cargando ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </main>
  );
}

// ESTRUCTURA PRINCIPAL Y NAVBAR
function PanelLayout({ perfil, onLogout }) {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const modulosPermitidos = modulos.filter(
    (modulo) =>
      !modulo.admin || perfil.rol === 'Administrador'
  );

  async function cerrarSesion() {
    setError('');

    try {
      await api.post('/logout');

      onLogout();
      navigate('/login', { replace: true });

    } catch {
      setError('No se pudo cerrar la sesión.');
    }
  }

  return (
    <>
      <header style={estilos.cabecera}>
        <strong style={estilos.logo}>
          Librería Independencia
        </strong>

        <nav style={estilos.navegacion}>
          <Link to="/dashboard">
            Dashboard
          </Link>

          {modulosPermitidos.map(({ nombre, ruta }) => (
            <Link key={ruta} to={ruta}>
              {nombre}
            </Link>
          ))}
        </nav>

        <div style={estilos.sesion}>
          <span>
            {perfil.nombre} ({perfil.rol})
          </span>

          <button onClick={cerrarSesion}>
            Cerrar sesión
          </button>
        </div>
      </header>

      {error && (
        <p role="alert" style={{ color: 'crimson' }}>
          {error}
        </p>
      )}

      <main style={estilos.contenido}>
        <Outlet />
      </main>
    </>
  );
}

const indicadores = [
  ['totalProductos', 'Productos registrados'],
  ['productosConStockBajo', 'Productos en el mínimo o por debajo'],
  ['totalUsuarios', 'Usuarios registrados'],
  ['usuariosActivos', 'Usuarios activos'],
  ['usuariosInactivos', 'Usuarios inactivos'],
];

function Dashboard() {
  const [resumen, setResumen] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controlador = new AbortController();

    api.get('/api/resumen', { signal: controlador.signal })
      .then(({ data }) => setResumen(data))
      .catch(() => {
        if (!controlador.signal.aborted) setError('No se pudieron cargar los indicadores.');
      });

    return () => controlador.abort();
  }, []);

  return (
    <section>
      <h1>Resumen general del sistema</h1>
      {error && <p role="alert">{error}</p>}
      {!resumen && !error && <p role="status">Cargando indicadores…</p>}
      {resumen && (
        <div style={estilos.indicadores}>
          {indicadores.filter(([clave]) => clave in resumen).map(([clave, titulo]) => (
            <article key={clave} style={estilos.tarjeta}>
              <h3>{titulo}</h3>
              <strong style={estilos.valorIndicador}>{resumen[clave]}</strong>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}


// CONTROL GENERAL DE AUTENTICACIÓN Y RUTAS
function App() {
  const [perfil, setPerfil] = useState(null);
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

  if (verificando) {
    return (
      <p style={{ padding: 24 }}>
        Verificando sesión...
      </p>
    );
  }

  return (
    <BrowserRouter>
      <Routes>

        {/* Login */}
        <Route
          path="/login"
          element={
            perfil ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Login onLogin={setPerfil} />
            )
          }
        />

        {/* Rutas protegidas */}
        <Route
          element={
            perfil ? (
              <PanelLayout
                perfil={perfil}
                onLogout={() => setPerfil(null)}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >

          {/* Dashboard */}
          <Route
            path="/dashboard"
            element={<Dashboard />}
          />

          <Route
            path="/productos"
            element={<Catalogo key="productos" recurso="productos" puedeEditar={perfil?.rol === 'Administrador'} />}
          />
          <Route
            path="/categorias"
            element={
              perfil?.rol === 'Administrador'
                ? <Catalogo key="categorias" recurso="categorias" puedeEditar />
                : <Navigate to="/dashboard" replace />
            }
          />

          {modulos.filter(({ pendiente }) => pendiente).map(({ nombre, ruta, admin }) => (
            <Route
              key={ruta}
              path={ruta}
              element={
                !admin || perfil?.rol === 'Administrador' ? (
                  <section>
                    <h1>{nombre}</h1>
                    <p>Este módulo está pendiente de implementación.</p>
                  </section>
                ) : (
                  <Navigate to="/dashboard" replace />
                )
              }
            />
          ))}

          {/* Administración de usuarios */}
          <Route
            path="/usuarios"
            element={
              perfil?.rol === 'Administrador' ? (
                <Usuarios />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            }
          />

        </Route>

        {/* Redirección predeterminada */}
        <Route
          path="*"
          element={
            <Navigate
              to={perfil ? '/dashboard' : '/login'}
              replace
            />
          }
        />

      </Routes>
    </BrowserRouter>
  );
}

// ESTILOS GENERALES
const estilos = {
  login: {
    maxWidth: 450,
    margin: '80px auto',
    padding: 24,
  },

  formulario: {
    display: 'grid',
    gap: 14,
    marginTop: 24,
    padding: 24,
    background: '#fff',
    borderRadius: 12,
    border: '1px solid #ddd',
  },

  cabecera: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 20,
    padding: 20,
    background: '#fff',
    borderBottom: '1px solid #ddd',
  },

  logo: {
    fontSize: 18,
    whiteSpace: 'nowrap',
  },

  navegacion: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 16,
  },

  sesion: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },

  contenido: {
    maxWidth: 1200,
    margin: 'auto',
    padding: 24,
  },

  indicadores: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 20,
    marginTop: 24,
  },

  tarjeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 24,
    background: '#fff',
    border: '1px solid #ddd',
    borderRadius: 12,
    color: '#222',
  },

  valorIndicador: {
    fontSize: 32,
    fontWeight: 'bold',
  },
};

export default App;
