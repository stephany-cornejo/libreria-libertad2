
import { useEffect, useState } from 'react';
import api from '../services/api';
import './Usuarios.css';

const formularioVacio = {
  name: '',
  usuario: '',
  email: '',
  password: '',
  id_rol: '',
  estado: 'activo',
};

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [formulario, setFormulario] = useState({ ...formularioVacio });
  const [editando, setEditando] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function cargarDatos() {
    const [respuestaUsuarios, respuestaRoles] = await Promise.all([
      api.get('/api/usuarios'),
      api.get('/api/roles'),
    ]);

    setUsuarios(respuestaUsuarios.data);
    setRoles(respuestaRoles.data);
  }

  useEffect(() => {
    cargarDatos().catch(() => {
      setError('No se pudo cargar la información de usuarios.');
    });
  }, []);

  function cambiarCampo(evento) {
    const { name, value } = evento.target;

    setFormulario((anterior) => ({
      ...anterior,
      [name]: value,
    }));
  }

  function editar(usuario) {
    setEditando(usuario.id);
    setFormulario({
      name: usuario.name,
      usuario: usuario.usuario,
      email: usuario.email ?? '',
      password: '',
      id_rol: String(usuario.id_rol),
      estado: usuario.estado,
    });

    setMensaje('');
    setError('');
  }

  function cancelar() {
    setEditando(null);
    setFormulario({ ...formularioVacio });
    setError('');
  }

  async function guardar(evento) {
    evento.preventDefault();
    setGuardando(true);
    setMensaje('');
    setError('');

    const datos = {
      ...formulario,
      email: formulario.email || null,
      id_rol: Number(formulario.id_rol),
    };

    if (editando && !datos.password) {
      delete datos.password;
    }

    try {
      if (editando) {
        await api.put(`/api/usuarios/${editando}`, datos);
      } else {
        await api.post('/api/usuarios', datos);
      }

      await cargarDatos();
      cancelar();
      setMensaje('Usuario guardado correctamente.');
    } catch (err) {
      const errores = err.response?.data?.errors;
      const detalle = errores
        ? Object.values(errores).flat().join(' ')
        : err.response?.data?.mensaje ||
          err.response?.data?.message ||
          'No se pudo guardar el usuario.';

      setError(detalle);
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEstado(usuario) {
    const nuevoEstado =
      usuario.estado === 'activo' ? 'inactivo' : 'activo';

    setError('');
    setMensaje('');

    try {
      await api.put(`/api/usuarios/${usuario.id}`, {
        name: usuario.name,
        usuario: usuario.usuario,
        email: usuario.email,
        id_rol: usuario.id_rol,
        estado: nuevoEstado,
      });

      await cargarDatos();

      if (editando === usuario.id) {
        cancelar();
      }

      setMensaje('Estado actualizado correctamente.');
    } catch (err) {
      setError(
        err.response?.data?.mensaje ||
        err.response?.data?.message ||
        'No se pudo modificar el estado.'
      );
    }
  }

  return (
    <section className="usuarios-modulo">
      <h1>Usuarios</h1>

      {mensaje && <p role="status" className="aviso usuarios-exito">{mensaje}</p>}
      {error && <p role="alert" className="aviso aviso-error">{error}</p>}

      <form onSubmit={guardar} className="usuarios-formulario">
        <h2>{editando ? 'Editar usuario' : 'Nuevo usuario'}</h2>

        <label>
          Nombre completo*
          <input
            name="name"
            value={formulario.name}
            onChange={cambiarCampo}
            maxLength={100}
            required
          />
        </label>

        <label>
          Usuario*
          <input
            name="usuario"
            value={formulario.usuario}
            onChange={cambiarCampo}
            maxLength={50}
            required
          />
        </label>

        <label>
          {editando ? 'Correo electrónico' : 'Correo electrónico*'}
          <input
            type="email"
            name="email"
            value={formulario.email}
            onChange={cambiarCampo}
            maxLength={191}
            required={!editando}
          />
        </label>

        <label>
          {editando ? 'Nueva contraseña (opcional)' : 'Contraseña*'}
          <input
            type="password"
            name="password"
            value={formulario.password}
            onChange={cambiarCampo}
            minLength={8}
            required={!editando}
          />
        </label>

        <label>
          Rol
          <select
            name="id_rol"
            value={formulario.id_rol}
            onChange={cambiarCampo}
            required
          >
            <option value="">Seleccionar rol</option>
            {roles.map((rol) => (
              <option key={rol.id} value={rol.id}>
                {rol.nombre}
              </option>
            ))}
          </select>
        </label>

        <label>
          Estado
          <select
            name="estado"
            value={formulario.estado}
            onChange={cambiarCampo}
          >
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </select>
        </label>

        <div className="usuarios-acciones">
          <button type="submit" className="accion-principal" disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar usuario'}
          </button>

          {editando && (
            <button type="button" onClick={cancelar}>
              Cancelar
            </button>
          )}
        </div>
      </form>

      <h2>Usuarios registrados</h2>

      <div className="usuarios-tabla-contenedor">
        <table className="usuarios-tabla">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((item) => (
              <tr key={item.id}>
                <td className="tabla-nombre">{item.name}</td>
                <td className="tabla-codigo">{item.usuario}</td>
                <td>{item.rol?.nombre ?? 'Sin rol'}</td>
                <td>
                  <span className={item.estado === 'activo' ? 'estado-registro estado-activo' : 'estado-registro'}>
                    {item.estado === 'activo' ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td>
                  <div className="tabla-acciones">
                    <button type="button" onClick={() => editar(item)}>Editar</button>
                    <button type="button" onClick={() => cambiarEstado(item)}>
                      {item.estado === 'activo' ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
