import { useEffect, useState } from 'react';
import api from '../services/api';
import Dialogo from '../components/Dialogo';
import { detalleError, formatoCantidad } from '../services/formato';
import './Usuarios.css';
import './Inventario.css';

const campos = [
  { nombre: 'codigo', etiqueta: 'Código*', maxLength: 50, required: true },
  { nombre: 'nombre', etiqueta: 'Nombre*', maxLength: 150, required: true },
  { nombre: 'contacto', etiqueta: 'Persona de contacto', maxLength: 100 },
  { nombre: 'email', etiqueta: 'Correo electrónico', type: 'email', maxLength: 191 },
  { nombre: 'telefono', etiqueta: 'Teléfono', type: 'tel', maxLength: 30, pattern: '[0-9+\\(\\)\\-\\s]+', title: 'Solo números, espacios y los signos + ( ) -' },
  { nombre: 'direccion', etiqueta: 'Dirección', maxLength: 250 },
];

const formularioVacio = Object.fromEntries(campos.map(({ nombre }) => [nombre, '']));

/** Convierte los campos vacíos en null para no guardar cadenas vacías. */
function datosParaEnviar(formulario) {
  return Object.fromEntries(Object.entries(formulario).map(([clave, valor]) => [clave, valor.trim() || null]));
}

export default function Proveedores() {
  const [proveedores, setProveedores] = useState([]);
  const [buscar, setBuscar] = useState('');
  const [estado, setEstado] = useState('');
  const [cargando, setCargando] = useState(true);
  const [recarga, setRecarga] = useState(0);
  const [formulario, setFormulario] = useState(formularioVacio);
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState(null);
  const [porCambiar, setPorCambiar] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [errorFormulario, setErrorFormulario] = useState('');
  const [mensaje, setMensaje] = useState('');

  // La búsqueda se envía 300 ms después de dejar de escribir.
  useEffect(() => {
    const controlador = new AbortController();
    const espera = setTimeout(() => {
      setCargando(true);
      api.get('/api/proveedores', {
        params: { buscar: buscar.trim() || undefined, estado: estado || undefined },
        signal: controlador.signal,
      })
        .then(({ data }) => { setProveedores(data); setError(''); })
        .catch((fallo) => {
          if (!controlador.signal.aborted) setError(detalleError(fallo, 'No se pudieron cargar los proveedores.'));
        })
        .finally(() => {
          if (!controlador.signal.aborted) setCargando(false);
        });
    }, 300);

    return () => { clearTimeout(espera); controlador.abort(); };
  }, [buscar, estado, recarga]);

  function cancelar() {
    setCreando(false);
    setEditando(null);
    setErrorFormulario('');
    setFormulario(formularioVacio);
  }

  function nuevo() {
    cancelar();
    setMensaje('');
    setCreando(true);
  }

  function editar(proveedor) {
    setCreando(false);
    setErrorFormulario('');
    setMensaje('');
    setEditando(proveedor.id);
    setFormulario(Object.fromEntries(campos.map(({ nombre }) => [nombre, proveedor[nombre] ?? ''])));
  }

  async function guardar(evento) {
    evento.preventDefault();
    setGuardando(true);
    setErrorFormulario('');

    try {
      if (editando === null) {
        await api.post('/api/proveedores', datosParaEnviar(formulario));
        setMensaje('Proveedor registrado correctamente.');
      } else {
        await api.put(`/api/proveedores/${editando}`, datosParaEnviar(formulario));
        setMensaje('Proveedor actualizado correctamente.');
      }
      cancelar();
      setRecarga((n) => n + 1);
    } catch (fallo) {
      setErrorFormulario(detalleError(fallo, 'No se pudo guardar el proveedor.'));
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEstado() {
    const nuevoEstado = porCambiar.estado === 'activo' ? 'inactivo' : 'activo';
    setGuardando(true);

    try {
      const { data } = await api.patch(`/api/proveedores/${porCambiar.id}/estado`, { estado: nuevoEstado });
      setProveedores((lista) => lista
        .map((item) => (item.id === data.id ? data : item))
        .filter((item) => !estado || item.estado === estado));
      setMensaje(`Proveedor ${nuevoEstado === 'activo' ? 'activado' : 'desactivado'} correctamente.`);
      setPorCambiar(null);
    } catch (fallo) {
      setError(detalleError(fallo, 'No se pudo cambiar el estado del proveedor.'));
      setPorCambiar(null);
    } finally {
      setGuardando(false);
    }
  }

  const formularioProveedor = (
    <form className="usuarios-formulario" onSubmit={guardar}>
      <h2 id="proveedor-formulario-titulo">{editando === null ? 'Nuevo proveedor' : 'Editar proveedor'}</h2>
      {errorFormulario && <p role="alert" className="aviso aviso-error">{errorFormulario}</p>}
      {campos.map(({ nombre, etiqueta, ...atributos }) => (
        <label key={nombre}>
          {etiqueta}
          <input
            name={nombre}
            value={formulario[nombre]}
            disabled={guardando}
            onChange={(e) => setFormulario((datos) => ({ ...datos, [nombre]: e.target.value }))}
            {...atributos}
          />
        </label>
      ))}
      <div className="usuarios-acciones">
        <button type="submit" className="accion-principal" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar proveedor'}
        </button>
        <button type="button" disabled={guardando} onClick={cancelar}>Cancelar</button>
      </div>
    </form>
  );

  return (
    <section className="usuarios-modulo">
      <header className="catalogo-cabecera">
        <div className="inventario-titulo">
          <h1>Proveedores</h1>
          <p>Empresas que abastecen el inventario. Los proveedores no se eliminan: se desactivan para conservar su historial.</p>
        </div>
        <button type="button" className="accion-principal" disabled={guardando || creando} aria-expanded={creando} onClick={nuevo}>
          + Nuevo proveedor
        </button>
      </header>

      {mensaje && <p role="status" className="aviso usuarios-exito">{mensaje}</p>}
      {error && <p role="alert" className="aviso aviso-error">{error}</p>}

      {creando && formularioProveedor}
      {editando !== null && (
        <Dialogo tituloId="proveedor-formulario-titulo" guardando={guardando} alCancelar={cancelar}>
          {formularioProveedor}
        </Dialogo>
      )}

      {porCambiar && (
        <Dialogo tituloId="proveedor-estado-titulo" descripcionId="proveedor-estado-aviso" guardando={guardando} alCancelar={() => setPorCambiar(null)}>
          <div className="catalogo-confirmacion">
            <h2 id="proveedor-estado-titulo">
              {porCambiar.estado === 'activo' ? '¿Desactivar este proveedor?' : '¿Activar este proveedor?'}
            </h2>
            <p><strong>{porCambiar.nombre}</strong> <span className="inventario-secundario">({porCambiar.codigo})</span></p>
            <p id="proveedor-estado-aviso">
              {porCambiar.estado === 'activo'
                ? 'No podrá seleccionarse en nuevas compras ni reposiciones. Su historial se conserva.'
                : 'Volverá a estar disponible para registrar compras y reposiciones.'}
            </p>
            <div className="catalogo-confirmacion-acciones">
              <button type="button" disabled={guardando} onClick={() => setPorCambiar(null)}>Cancelar</button>
              <button
                type="button"
                className={porCambiar.estado === 'activo' ? 'accion-eliminar' : 'accion-principal'}
                disabled={guardando}
                onClick={cambiarEstado}
              >
                {guardando ? 'Procesando…' : porCambiar.estado === 'activo' ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          </div>
        </Dialogo>
      )}

      <form className="inventario-filtros" role="search" onSubmit={(e) => e.preventDefault()}>
        <label>
          Buscar
          <input type="search" placeholder="Código, nombre, contacto o correo" value={buscar} onChange={(e) => setBuscar(e.target.value)} maxLength={100} />
        </label>
        <label>
          Estado
          <select value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Todos</option>
            <option value="activo">Activos</option>
            <option value="inactivo">Inactivos</option>
          </select>
        </label>
      </form>

      {cargando && proveedores.length === 0 && <p role="status" className="aviso">Cargando proveedores…</p>}
      {!cargando && proveedores.length === 0 && !error && (
        <p className="aviso">{buscar || estado ? 'Ningún proveedor coincide con la búsqueda.' : 'Aún no hay proveedores registrados.'}</p>
      )}

      {proveedores.length > 0 && (
        <>
          <p className="inventario-conteo" aria-live="polite">
            {formatoCantidad.format(proveedores.length)} {proveedores.length === 1 ? 'proveedor' : 'proveedores'}
          </p>
          <div className="usuarios-tabla-contenedor">
            <table className="usuarios-tabla">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Contacto</th>
                  <th>Correo</th>
                  <th>Teléfono</th>
                  <th>Estado</th>
                  <th className="tabla-cifra">Movimientos</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {proveedores.map((proveedor) => (
                  <tr key={proveedor.id}>
                    <td className="tabla-codigo">{proveedor.codigo}</td>
                    <td className="tabla-nombre">{proveedor.nombre}</td>
                    <td>{proveedor.contacto}</td>
                    <td>{proveedor.email && <a href={`mailto:${proveedor.email}`}>{proveedor.email}</a>}</td>
                    <td className="inventario-nowrap">{proveedor.telefono}</td>
                    <td>
                      <span className={proveedor.estado === 'activo' ? 'estado-registro estado-activo' : 'estado-registro'}>
                        {proveedor.estado === 'activo' ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="tabla-cifra">{formatoCantidad.format(proveedor.movimientos_count ?? 0)}</td>
                    <td>
                      <div className="tabla-acciones">
                        <button type="button" disabled={guardando} onClick={() => editar(proveedor)}>Editar</button>
                        <button
                          type="button"
                          className={proveedor.estado === 'activo' ? 'accion-peligro' : undefined}
                          disabled={guardando}
                          onClick={() => { setMensaje(''); setPorCambiar(proveedor); }}
                        >
                          {proveedor.estado === 'activo' ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
