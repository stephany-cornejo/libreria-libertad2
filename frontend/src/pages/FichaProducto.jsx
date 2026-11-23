import { useEffect, useState } from 'react';
import api from '../services/api';

export default function FichaProducto({ producto, puedeEditar, cerrar }) {
  const [archivos, setArchivos] = useState([]);
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const ruta = '/api/productos/' + producto.id + '/archivos';

  useEffect(() => {
    const controlador = new AbortController();
    api.get(ruta, { signal: controlador.signal }).then(r => setArchivos(r.data)).catch(() => {
      if (!controlador.signal.aborted) setAviso('No se pudieron cargar los archivos.');
    });
    return () => controlador.abort();
  }, [ruta]);

  async function subir(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const datos = new FormData(form);
    const archivo = datos.get('archivo');
    if (!['image/jpeg','image/png','application/pdf'].includes(archivo.type) || archivo.size > 2097152) {
      setAviso('Selecciona un PDF, JPG o PNG de hasta 2 MB.');
      return;
    }
    setOcupado(true);
    try {
      const { data } = await api.post(ruta, datos);
      setArchivos(lista => [...lista, data]);
      form.reset();
      setAviso('Archivo guardado.');
    } catch (error) {
      setAviso(error.response?.data?.errors?.archivo?.[0] || 'No se pudo guardar el archivo.');
    } finally {
      setOcupado(false);
    }
  }

  async function descargar(archivo) {
    try {
      const { data } = await api.get(ruta + '/' + archivo.id, { responseType: 'blob' });
      const enlace = document.createElement('a');
      enlace.href = URL.createObjectURL(data);
      enlace.download = archivo.nombre;
      enlace.click();
      setTimeout(() => URL.revokeObjectURL(enlace.href), 30000);
    } catch {
      setAviso('No se pudo descargar el archivo.');
    }
  }

  return <section className="catalogo-confirmacion">
    <h2 id="detalle-producto">{producto.nombre}</h2>
    <p>{producto.codigo} · {producto.categoria?.nombre}</p>
    <p>{producto.descripcion}</p>
    <p>Precio: ${Number(producto.precio).toFixed(2)} · Existencias: {producto.stock} · Mínimo: {producto.stock_minimo}</p>
    <h3>Archivos del producto</h3>
    <ul>{archivos.map(a => <li key={a.id}><button onClick={() => descargar(a)}>{a.nombre}</button></li>)}</ul>
    {puedeEditar && <form onSubmit={subir}><label>PDF, JPG o PNG (hasta 2 MB)
      <input name="archivo" type="file" accept=".pdf,.jpg,.jpeg,.png" required /></label>
      <button disabled={ocupado}>Adjuntar</button></form>}
    {aviso && <p role="status">{aviso}</p>}
    <button onClick={cerrar}>Cerrar</button>
  </section>;
}
