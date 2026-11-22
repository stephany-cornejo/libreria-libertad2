
import { useEffect, useState } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Link,
  NavLink,
  Outlet,
  useNavigate,
} from 'react-router-dom';

import api from './services/api';
import Usuarios from './pages/Usuarios';
import Catalogo from './pages/Catalogo';
import './App.css';

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
    <main className="login">
      <section className="login-panel">
        <header className="login-marca">
          <h1>Librería Independencia</h1>
          <p>Sistema de gestión de inventario</p>
        </header>

        <form onSubmit={iniciarSesion} className="login-formulario">
          <h2>Iniciar sesión</h2>

          <label htmlFor="usuario">Usuario</label>
          <input
            id="usuario"
            autoComplete="username"
            type="text"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            required
          />

          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            autoComplete="current-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && <p role="alert" className="aviso aviso-error">{error}</p>}

          <button type="submit" className="accion-principal" disabled={cargando}>
            {cargando ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </section>
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
      <header className="cabecera">
        <div className="cabecera-interior">
          <strong className="marca">Librería Independencia</strong>

          <div className="sesion">
            <span>{perfil.nombre} · {perfil.rol}</span>
            <button type="button" onClick={cerrarSesion}>Cerrar sesión</button>
          </div>

          <nav aria-label="Navegación principal" className="navegacion">
            <NavLink to="/dashboard" end>Panel de Control</NavLink>
            {modulosPermitidos.map(({ nombre, ruta }) => (
              <NavLink key={ruta} to={ruta}>{nombre}</NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="contenido">
        {error && <p role="alert" className="aviso aviso-error">{error}</p>}
        <Outlet />
      </main>
    </>
  );
}

const formatoCantidad = new Intl.NumberFormat('es-SV');
const formatoInventario = new Intl.NumberFormat('es-SV', {
  style: 'currency',
  currency: 'USD',
});

const indicadores = [
  ['skuDisponibles', 'Stock total disponible (SKU)', formatoCantidad],
  ['unidadesDisponibles', 'Unidades totales disponibles', formatoCantidad],
  ['valorInventario', 'Valor total en inventario', formatoInventario],
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
      <h1>Panel de Control</h1>
      {error && <p role="alert">{error}</p>}
      {!resumen && !error && <p role="status">Cargando indicadores…</p>}
      {resumen && (
        <>
          <div style={estilos.indicadores}>
            {indicadores.map(([clave, titulo, formato]) => (
              <article key={clave} style={estilos.tarjeta}>
                <h3>{titulo}</h3>
                <strong style={estilos.valorIndicador}>{formato.format(resumen[clave])}</strong>
              </article>
            ))}
          </div>

          <section aria-labelledby="titulo-categorias">
            <h2 id="titulo-categorias">Categorías</h2>
            {resumen.categorias.length ? (
              <ul style={estilos.enlacesCategorias}>
                {resumen.categorias.map(({ id, nombre }) => (
                  <li key={id}><Link to={`/productos?categoria=${id}`}>{nombre}</Link></li>
                ))}
              </ul>
            ) : <p>Aún no hay categorías registradas.</p>}
          </section>

          <section aria-labelledby="titulo-destacados">
            <h2 id="titulo-destacados">Destacados</h2>
            {resumen.destacados.length ? (
              <div style={estilos.indicadores}>
                {resumen.destacados.map(({ id, codigo, nombre, precio, stock }) => (
                  <article key={id} style={estilos.tarjeta}>
                    <h3>{nombre}</h3>
                    <span>{codigo}</span>
                    <strong>{formatoInventario.format(precio)}</strong>
                    <span>Unidades disponibles: {formatoCantidad.format(stock)}</span>
                  </article>
                ))}
              </div>
            ) : <p>Aún no hay productos con existencias.</p>}
          </section>
        </>
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
      <p className="contenido" role="status">
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
                  <section className="modulo-pendiente">
                    <h1>{nombre}</h1>
                    <p className="aviso">Este módulo está pendiente de implementación.</p>
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
  enlacesCategorias: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 16,
    listStyle: 'none',
    padding: 0,
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
