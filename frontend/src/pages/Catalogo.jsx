import { useEffect, useState } from 'react';
import api from '../services/api';
import './Usuarios.css';

const camposCategoria = [
  { nombre: 'nombre', etiqueta: 'Nombre', maxLength: 100, required: true },
  { nombre: 'descripcion', etiqueta: 'Descripción', maxLength: 500 },
];

const camposProducto = [
  { nombre: 'codigo', etiqueta: 'Código', maxLength: 50, required: true },
  { nombre: 'nombre', etiqueta: 'Nombre', maxLength: 150, required: true },
  { nombre: 'categoria_id', etiqueta: 'Categoría', required: true },
  { nombre: 'descripcion', etiqueta: 'Descripción', maxLength: 500 },
  { nombre: 'precio', etiqueta: 'Precio', type: 'number', min: 0, max: 99999999.99, step: '0.01', required: true },
  { nombre: 'stock_minimo', etiqueta: 'Stock mínimo', type: 'number', min: 0, max: 4294967295, step: '1', required: true },
];

function detalleError(error, mensaje) {
  const datos = error.response?.data;
  return datos?.errors
    ? Object.values(datos.errors).flat().join(' ')
    : datos?.mensaje || datos?.message || mensaje;
}

export default function Catalogo({ recurso, puedeEditar }) {
  const esProducto = recurso === 'productos';
  const campos = esProducto ? camposProducto : camposCategoria;
  const titulo = esProducto ? 'Productos' : 'Categorías';
  const entidad = esProducto ? 'producto' : 'categoría';
  const url = `/api/${recurso}`;

  function formularioNuevo() {
    return Object.fromEntries(campos.map(({ nombre }) => [nombre, nombre === 'stock_minimo' ? '0' : '']));
  }

  const [formulario, setFormulario] = useState(formularioNuevo);
  const [registros, setRegistros] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [editando, setEditando] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    const controlador = new AbortController();
    const opciones = { signal: controlador.signal };

    Promise.all([
      api.get(url, opciones),
      esProducto && puedeEditar ? api.get('/api/categorias', opciones) : null,
    ]).then(([lista, opcionesCategoria]) => {
      setRegistros(lista.data);
      setCategorias(opcionesCategoria?.data ?? []);
    }).catch((fallo) => {
      if (!controlador.signal.aborted) setError(detalleError(fallo, 'No se pudo cargar el catálogo.'));
    }).finally(() => {
      if (!controlador.signal.aborted) setCargando(false);
    });

    return () => controlador.abort();
  }, [url, esProducto, puedeEditar]);

  function cancelar() {
    setEditando(null);
    setFormulario(formularioNuevo());
  }

  function editar(registro) {
    setError('');
    setMensaje('');
    setEditando(registro.id);
    setFormulario(Object.fromEntries(campos.map(({ nombre }) => [nombre, String(registro[nombre] ?? '')])));
  }

  async function guardar(evento) {
    evento.preventDefault();
    setGuardando(true);
    setError('');
    setMensaje('');

    try {
      const respuesta = editando === null
        ? await api.post(url, formulario)
        : await api.put(`${url}/${editando}`, formulario);
      const registro = respuesta.data;
      setRegistros((lista) => [...lista.filter(({ id }) => id !== registro.id), registro]
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')));
      cancelar();
      setMensaje('Registro guardado.');
    } catch (fallo) {
      setError(detalleError(fallo, 'No se pudo guardar el registro.'));
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(registro) {
    if (!window.confirm(`¿Eliminar «${registro.nombre}»?`)) return;

    setGuardando(true);
    setError('');
    setMensaje('');
    try {
      await api.delete(`${url}/${registro.id}`);
      setRegistros((lista) => lista.filter(({ id }) => id !== registro.id));
      if (editando === registro.id) cancelar();
      setMensaje('Registro eliminado.');
    } catch (fallo) {
      setError(detalleError(fallo, 'No se pudo eliminar el registro.'));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="usuarios-modulo">
      <h1>{titulo}</h1>
      {error && <p role="alert" className="usuarios-error">{error}</p>}
      {mensaje && <p role="status" className="usuarios-exito">{mensaje}</p>}
      {cargando && <p role="status">Cargando catálogo…</p>}

      {puedeEditar && !cargando && (
        <form className="usuarios-formulario" onSubmit={guardar}>
          <h3>{editando ? 'Editar' : esProducto ? 'Nuevo' : 'Nueva'} {entidad}</h3>
          {campos.map(({ nombre, etiqueta, ...atributos }) => {
            const props = {
              name: nombre,
              value: formulario[nombre],
              disabled: guardando,
              onChange: (evento) => {
                const { value } = evento.target;
                setFormulario((datos) => ({ ...datos, [nombre]: value }));
              },
            };

            return (
              <label key={nombre}>
                {etiqueta}
                {nombre === 'categoria_id' ? (
                  <select {...props} {...atributos}>
                    <option value="">Seleccionar categoría</option>
                    {categorias.map(({ id, nombre: opcion }) => <option key={id} value={id}>{opcion}</option>)}
                  </select>
                ) : (
                  <input {...props} {...atributos} />
                )}
              </label>
            );
          })}
          {esProducto && categorias.length === 0 && <p>Crea una categoría para registrar productos.</p>}
          <div className="usuarios-acciones">
            <button disabled={guardando || (esProducto && categorias.length === 0)}>
              {guardando ? 'Procesando…' : 'Guardar'}
            </button>
            {editando && <button type="button" disabled={guardando} onClick={cancelar}>Cancelar</button>}
          </div>
        </form>
      )}

      {!cargando && registros.length === 0 && !error && <p>No hay registros.</p>}
      {registros.length > 0 && (
        <div className="usuarios-tabla-contenedor">
          <table className="usuarios-tabla">
            <thead>
              <tr>
                {esProducto && <th>Código</th>}
                <th>Nombre</th>
                <th>Descripción</th>
                {esProducto && <><th>Categoría</th><th>Precio</th><th>Stock</th><th>Stock mínimo</th></>}
                {puedeEditar && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {registros.map((registro) => (
                <tr key={registro.id}>
                  {esProducto && <td>{registro.codigo}</td>}
                  <td>{registro.nombre}</td>
                  <td>{registro.descripcion}</td>
                  {esProducto && (
                    <>
                      <td>{registro.categoria.nombre}</td>
                      <td>{registro.precio}</td>
                      <td>{registro.stock}</td>
                      <td>{registro.stock_minimo}</td>
                    </>
                  )}
                  {puedeEditar && (
                    <td>
                      <button type="button" disabled={guardando} onClick={() => editar(registro)}>Editar</button>{' '}
                      <button type="button" disabled={guardando} onClick={() => eliminar(registro)}>Eliminar</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
