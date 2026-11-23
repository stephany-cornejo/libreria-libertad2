import { useEffect, useState } from 'react';
import api from '../services/api';
import Dialogo from '../components/Dialogo';
import {
  ahoraLocal,
  detalleError,
  fechaLegible,
  fechaLocalAIso,
  formatoCantidad,
  formatoDinero,
} from '../services/formato';
import './Usuarios.css';
import './Inventario.css';

const POR_PAGINA = 20;
const filtrosVacios = { buscar: '', tipo: '', concepto: '', producto_id: '', desde: '', hasta: '' };
const CONCEPTOS_CON_PRECIO = ['compra', 'reposicion', 'venta'];

// ─────────────────────────────────────────────────────────────
// Formulario de registro de una entrada o una salida
// ─────────────────────────────────────────────────────────────
function RegistroMovimiento({ tipo, conceptos, productos, proveedores, esAdministrador, inicial, alGuardar, alCancelar }) {
  const esEntrada = tipo === 'entrada';
  const opciones = conceptos.filter((c) => c.tipo === tipo && (!c.solo_administrador || esAdministrador));

  const [datos, setDatos] = useState({
    producto_id: inicial?.producto_id ? String(inicial.producto_id) : '',
    concepto: inicial?.concepto ?? opciones[0]?.valor ?? '',
    cantidad: '',
    proveedor_id: '',
    precio_unitario: '',
    referencia: '',
    fecha: '',
    motivo: '',
  });
  const [filtroProducto, setFiltroProducto] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const concepto = opciones.find((c) => c.valor === datos.concepto);
  const producto = productos.find((p) => String(p.id) === datos.producto_id);
  const cantidad = Number.parseInt(datos.cantidad, 10);
  const cantidadValida = Number.isInteger(cantidad) && cantidad > 0;
  const sinExistencias = !esEntrada && producto && producto.stock === 0;
  const excedeStock = !esEntrada && producto && cantidadValida && cantidad > producto.stock;
  const stockResultante = producto && cantidadValida ? producto.stock + (esEntrada ? cantidad : -cantidad) : null;
  const muestraPrecio = CONCEPTOS_CON_PRECIO.includes(datos.concepto);

  const texto = filtroProducto.trim().toLocaleLowerCase('es');
  const productosVisibles = texto
    ? productos.filter((p) => String(p.id) === datos.producto_id
      || `${p.codigo} ${p.nombre}`.toLocaleLowerCase('es').includes(texto))
    : productos;

  function cambiar(evento) {
    const { name, value } = evento.target;
    setDatos((actual) => ({ ...actual, [name]: value }));
  }

  function cambiarConcepto(evento) {
    const valor = evento.target.value;
    const nuevo = opciones.find((c) => c.valor === valor);
    setDatos((actual) => ({
      ...actual,
      concepto: valor,
      proveedor_id: nuevo?.admite_proveedor ? actual.proveedor_id : '',
      precio_unitario: CONCEPTOS_CON_PRECIO.includes(valor) ? actual.precio_unitario : '',
    }));
  }

  async function guardar(evento) {
    evento.preventDefault();
    setGuardando(true);
    setError('');

    try {
      const { data } = await api.post(`/api/movimientos/${esEntrada ? 'entradas' : 'salidas'}`, {
        producto_id: Number(datos.producto_id),
        concepto: datos.concepto,
        cantidad,
        proveedor_id: concepto?.admite_proveedor && datos.proveedor_id ? Number(datos.proveedor_id) : null,
        precio_unitario: muestraPrecio && datos.precio_unitario !== '' ? datos.precio_unitario : null,
        referencia: datos.referencia.trim() || null,
        fecha: fechaLocalAIso(datos.fecha),
        motivo: datos.motivo.trim() || null,
      });
      alGuardar(data);
    } catch (fallo) {
      setError(detalleError(fallo, 'No se pudo registrar el movimiento.'));
      setGuardando(false);
    }
  }

  return (
    <Dialogo tituloId="registro-titulo" guardando={guardando} alCancelar={alCancelar} ancho="760px">
      <form className="usuarios-formulario" onSubmit={guardar}>
        <h2 id="registro-titulo">{esEntrada ? 'Registrar entrada de inventario' : 'Registrar salida de inventario'}</h2>
        {error && <p role="alert" className="aviso aviso-error">{error}</p>}

        <div className="campo-ancho campo-grupo">
          <label htmlFor="registro-producto">Producto*</label>
          <input
            type="search"
            placeholder="Escribe para filtrar por código o nombre"
            value={filtroProducto}
            disabled={guardando}
            onChange={(e) => setFiltroProducto(e.target.value)}
            aria-label="Filtrar la lista de productos"
            aria-controls="registro-producto"
          />
          <select id="registro-producto" name="producto_id" value={datos.producto_id} onChange={cambiar} disabled={guardando} required>
            <option value="">
              {productosVisibles.length ? `Seleccionar producto (${productosVisibles.length})` : 'Ningún producto coincide'}
            </option>
            {productosVisibles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.codigo} — {p.nombre} · stock {formatoCantidad.format(p.stock)}
              </option>
            ))}
          </select>
        </div>

        <label>
          Concepto*
          <select name="concepto" value={datos.concepto} onChange={cambiarConcepto} disabled={guardando} required>
            {opciones.map((c) => <option key={c.valor} value={c.valor}>{c.etiqueta}</option>)}
          </select>
        </label>

        <label>
          Cantidad*
          <input
            type="number"
            name="cantidad"
            inputMode="numeric"
            min="1"
            max={!esEntrada && producto ? producto.stock || 1 : 1000000}
            step="1"
            value={datos.cantidad}
            onChange={cambiar}
            disabled={guardando || sinExistencias}
            required
          />
        </label>

        {concepto?.admite_proveedor && (
          <label>
            {concepto.requiere_proveedor ? 'Proveedor*' : 'Proveedor (opcional)'}
            <select name="proveedor_id" value={datos.proveedor_id} onChange={cambiar} disabled={guardando} required={concepto.requiere_proveedor}>
              <option value="">{proveedores.length ? 'Seleccionar proveedor' : 'No hay proveedores activos'}</option>
              {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </label>
        )}

        {muestraPrecio && (
          <label>
            {esEntrada ? 'Costo unitario (opcional)' : 'Precio unitario de venta'}
            <input
              type="number"
              name="precio_unitario"
              min="0"
              max="99999999.99"
              step="0.01"
              placeholder={!esEntrada && producto ? `${producto.precio} (precio vigente)` : '0.00'}
              value={datos.precio_unitario}
              onChange={cambiar}
              disabled={guardando}
            />
          </label>
        )}

        <label>
          Referencia (opcional)
          <input name="referencia" maxLength={80} placeholder="N.º de factura o documento" value={datos.referencia} onChange={cambiar} disabled={guardando} />
        </label>

        <label>
          Fecha y hora
          <input type="datetime-local" name="fecha" max={ahoraLocal()} value={datos.fecha} onChange={cambiar} disabled={guardando} />
          <span className="campo-ayuda">Déjala vacía para usar la fecha y hora actuales.</span>
        </label>

        <label className="campo-ancho">
          {concepto?.requiere_motivo ? 'Motivo*' : 'Motivo (opcional)'}
          <input
            name="motivo"
            maxLength={250}
            placeholder={concepto?.motivo_predeterminado ? `Si lo dejas vacío: «${concepto.motivo_predeterminado}»` : 'Describe por qué se registra este movimiento'}
            value={datos.motivo}
            onChange={cambiar}
            disabled={guardando}
            required={concepto?.requiere_motivo}
          />
        </label>

        {producto && (
          <p className={`inventario-vista-previa${excedeStock || sinExistencias ? ' vista-previa-error' : ''}`} aria-live="polite">
            {sinExistencias
              ? `«${producto.nombre}» no tiene existencias disponibles.`
              : excedeStock
                ? `La cantidad supera las existencias disponibles (${formatoCantidad.format(producto.stock)}).`
                : (
                  <>
                    Existencias de «{producto.nombre}»: <strong>{formatoCantidad.format(producto.stock)}</strong>
                    {stockResultante !== null && <> → quedarán <strong>{formatoCantidad.format(stockResultante)}</strong></>}
                    {stockResultante !== null && stockResultante <= producto.stock_minimo && (
                      <span className="vista-previa-aviso">
                        {stockResultante === 0 ? ' · el producto quedará agotado' : ` · por debajo del mínimo (${producto.stock_minimo})`}
                      </span>
                    )}
                  </>
                )}
          </p>
        )}

        <div className="usuarios-acciones">
          <button type="submit" className="accion-principal" disabled={guardando || sinExistencias || excedeStock}>
            {guardando ? 'Registrando…' : esEntrada ? 'Registrar entrada' : 'Registrar salida'}
          </button>
          <button type="button" disabled={guardando} onClick={alCancelar}>Cancelar</button>
        </div>
      </form>
    </Dialogo>
  );
}

// ─────────────────────────────────────────────────────────────
// Alertas de existencias
// ─────────────────────────────────────────────────────────────
function AlertasExistencias({ alertas, alReponer, alVerHistorial }) {
  if (!alertas) return null;

  const grupos = [
    { clave: 'agotados', titulo: 'Productos agotados', clase: 'alerta-agotados' },
    { clave: 'stock_bajo', titulo: 'Con stock bajo', clase: 'alerta-bajo' },
  ];

  return (
    <section className="inventario-alertas" aria-label="Alertas de existencias">
      {grupos.map(({ clave, titulo, clase }) => (
        <details key={clave} className={`inventario-alerta ${clase}`}>
          <summary>
            <span className="alerta-cifra">{formatoCantidad.format(alertas.resumen[clave])}</span>
            <span className="alerta-titulo">{titulo}</span>
            <span className="alerta-ver">{alertas.resumen[clave] ? 'Ver lista' : 'Sin alertas'}</span>
          </summary>
          {alertas[clave].length > 0 && (
            <ul>
              {alertas[clave].map((p) => (
                <li key={p.id}>
                  <div className="alerta-producto">
                    <strong>{p.nombre}</strong>
                    <span className="inventario-secundario">
                      {p.codigo} · {p.categoria?.nombre} · {clave === 'agotados'
                        ? `mínimo ${p.stock_minimo}`
                        : `quedan ${p.stock} de ${p.stock_minimo}${p.faltante ? ` (faltan ${p.faltante})` : ''}`}
                    </span>
                  </div>
                  <div className="tabla-acciones">
                    <button type="button" onClick={() => alVerHistorial(p.id)}>Historial</button>
                    <button type="button" onClick={() => alReponer(p.id)}>Reponer</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </details>
      ))}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Módulo de movimientos
// ─────────────────────────────────────────────────────────────
export default function Movimientos({ esAdministrador }) {
  const [conceptos, setConceptos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [alertas, setAlertas] = useState(null);
  const [historial, setHistorial] = useState(null);
  const [filtros, setFiltros] = useState(filtrosVacios);
  const [pagina, setPagina] = useState(1);
  const [recarga, setRecarga] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [registro, setRegistro] = useState(null);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const etiquetas = Object.fromEntries(conceptos.map((c) => [c.valor, c.etiqueta]));
  const conceptosFiltro = conceptos.filter((c) => !filtros.tipo || c.tipo === filtros.tipo);
  const hayFiltros = Object.values(filtros).some(Boolean);

  // Catálogos y alertas: se recargan después de cada registro porque cambia el stock.
  useEffect(() => {
    const controlador = new AbortController();
    const opciones = { signal: controlador.signal };

    Promise.all([
      api.get('/api/movimientos/conceptos', opciones),
      api.get('/api/productos', opciones),
      api.get('/api/proveedores', { ...opciones, params: { estado: 'activo' } }),
      api.get('/api/inventario/alertas', opciones),
    ]).then(([respConceptos, respProductos, respProveedores, respAlertas]) => {
      setConceptos(respConceptos.data);
      setProductos(respProductos.data);
      setProveedores(respProveedores.data);
      setAlertas(respAlertas.data);
    }).catch((fallo) => {
      if (!controlador.signal.aborted) setError(detalleError(fallo, 'No se pudieron cargar los datos de inventario.'));
    });

    return () => controlador.abort();
  }, [recarga]);

  // Historial: se consulta 300 ms después del último cambio de filtros.
  useEffect(() => {
    const controlador = new AbortController();
    const espera = setTimeout(() => {
      setCargando(true);
      const params = Object.fromEntries(Object.entries(filtros).filter(([, valor]) => valor !== ''));
      api.get('/api/movimientos', { params: { ...params, page: pagina, por_pagina: POR_PAGINA }, signal: controlador.signal })
        .then(({ data }) => { setHistorial(data); setError(''); })
        .catch((fallo) => {
          if (!controlador.signal.aborted) setError(detalleError(fallo, 'No se pudo cargar el historial.'));
        })
        .finally(() => {
          if (!controlador.signal.aborted) setCargando(false);
        });
    }, 300);

    return () => { clearTimeout(espera); controlador.abort(); };
  }, [filtros, pagina, recarga]);

  function cambiarFiltro(evento) {
    const { name, value } = evento.target;
    setFiltros((actual) => ({
      ...actual,
      [name]: value,
      ...(name === 'tipo' ? { concepto: '' } : {}),
    }));
    setPagina(1);
  }

  function abrirRegistro(tipo, inicial = null) {
    setMensaje('');
    setRegistro({ tipo, inicial });
  }

  function verHistorialProducto(productoId) {
    setFiltros({ ...filtrosVacios, producto_id: String(productoId) });
    setPagina(1);
    document.getElementById('titulo-historial')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function registrado(movimiento) {
    const accion = movimiento.tipo === 'entrada' ? 'Entrada registrada' : 'Salida registrada';
    setRegistro(null);
    setMensaje(
      `${accion}: ${etiquetas[movimiento.concepto] ?? movimiento.concepto} de ${formatoCantidad.format(movimiento.cantidad)} `
      + `${movimiento.cantidad === 1 ? 'unidad' : 'unidades'} de «${movimiento.producto.nombre}». `
      + `Existencias: ${formatoCantidad.format(movimiento.stock_anterior)} → ${formatoCantidad.format(movimiento.stock_resultante)}.`,
    );
    setPagina(1);
    setRecarga((n) => n + 1);
  }

  const movimientos = historial?.data ?? [];

  return (
    <section className="usuarios-modulo">
      <header className="catalogo-cabecera">
        <div className="inventario-titulo">
          <h1>Movimientos de inventario</h1>
          <p>Registra entradas y salidas; las existencias se actualizan automáticamente.</p>
        </div>
        <div className="usuarios-acciones">
          <button type="button" className="accion-principal" disabled={!conceptos.length} onClick={() => abrirRegistro('entrada')}>
            + Registrar entrada
          </button>
          <button type="button" className="accion-principal" disabled={!conceptos.length} onClick={() => abrirRegistro('salida')}>
            − Registrar salida
          </button>
        </div>
      </header>

      {mensaje && <p role="status" className="aviso usuarios-exito">{mensaje}</p>}
      {error && <p role="alert" className="aviso aviso-error">{error}</p>}

      <AlertasExistencias
        alertas={alertas}
        alVerHistorial={verHistorialProducto}
        alReponer={(productoId) => abrirRegistro('entrada', { producto_id: productoId, concepto: 'reposicion' })}
      />

      {registro && (
        <RegistroMovimiento
          tipo={registro.tipo}
          inicial={registro.inicial}
          conceptos={conceptos}
          productos={productos}
          proveedores={proveedores}
          esAdministrador={esAdministrador}
          alGuardar={registrado}
          alCancelar={() => setRegistro(null)}
        />
      )}

      <h2 id="titulo-historial">Historial de movimientos</h2>

      <form className="inventario-filtros" role="search" onSubmit={(e) => e.preventDefault()}>
        <label className="campo-ancho">
          Buscar
          <input type="search" name="buscar" maxLength={100} placeholder="Producto, código, referencia o motivo" value={filtros.buscar} onChange={cambiarFiltro} />
        </label>
        <label>
          Producto
          <select name="producto_id" value={filtros.producto_id} onChange={cambiarFiltro}>
            <option value="">Todos</option>
            {productos.map((p) => <option key={p.id} value={p.id}>{p.codigo} — {p.nombre}</option>)}
          </select>
        </label>
        <label>
          Tipo
          <select name="tipo" value={filtros.tipo} onChange={cambiarFiltro}>
            <option value="">Entradas y salidas</option>
            <option value="entrada">Entradas</option>
            <option value="salida">Salidas</option>
          </select>
        </label>
        <label>
          Concepto
          <select name="concepto" value={filtros.concepto} onChange={cambiarFiltro}>
            <option value="">Todos</option>
            {conceptosFiltro.map((c) => <option key={c.valor} value={c.valor}>{c.etiqueta}</option>)}
          </select>
        </label>
        <label>
          Desde
          <input type="date" name="desde" value={filtros.desde} max={filtros.hasta || undefined} onChange={cambiarFiltro} />
        </label>
        <label>
          Hasta
          <input type="date" name="hasta" value={filtros.hasta} min={filtros.desde || undefined} onChange={cambiarFiltro} />
        </label>
        {hayFiltros && (
          <div className="filtros-limpiar">
            <button type="button" onClick={() => { setFiltros(filtrosVacios); setPagina(1); }}>Limpiar filtros</button>
          </div>
        )}
      </form>

      {cargando && !historial && <p role="status" className="aviso">Cargando historial…</p>}
      {historial && movimientos.length === 0 && (
        <p className="aviso">{hayFiltros ? 'Ningún movimiento coincide con los filtros.' : 'Aún no hay movimientos registrados.'}</p>
      )}

      {movimientos.length > 0 && (
        <>
          <div className={`usuarios-tabla-contenedor${cargando ? ' tabla-actualizando' : ''}`} aria-busy={cargando}>
            <table className="usuarios-tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Producto</th>
                  <th>Movimiento</th>
                  <th className="tabla-cifra">Cantidad</th>
                  <th className="tabla-cifra">Existencias</th>
                  <th className="tabla-cifra">Precio unit.</th>
                  <th>Proveedor</th>
                  <th>Registrado por</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((m) => {
                  const entrada = m.tipo === 'entrada';
                  return (
                    <tr key={m.id}>
                      <td className="inventario-nowrap">{fechaLegible(m.fecha)}</td>
                      <td className="inventario-producto">
                        <span className="tabla-nombre inventario-bloque">{m.producto?.nombre}</span>
                        <span className="inventario-secundario">{m.producto?.codigo}</span>
                      </td>
                      <td className="inventario-nowrap">
                        <span className={`estado-registro ${entrada ? 'mov-entrada' : 'mov-salida'}`}>{entrada ? 'Entrada' : 'Salida'}</span>
                        {' '}{etiquetas[m.concepto] ?? m.concepto}
                      </td>
                      <td className={`tabla-cifra ${entrada ? 'cantidad-entrada' : 'cantidad-salida'}`}>
                        {entrada ? '+' : '−'}{formatoCantidad.format(m.cantidad)}
                      </td>
                      <td className="tabla-cifra">
                        {formatoCantidad.format(m.stock_anterior)} → <strong>{formatoCantidad.format(m.stock_resultante)}</strong>
                      </td>
                      <td className="tabla-cifra">{m.precio_unitario !== null ? formatoDinero.format(m.precio_unitario) : '—'}</td>
                      <td className="inventario-proveedor">{m.proveedor?.nombre ?? '—'}</td>
                      <td className="inventario-usuario">{m.usuario?.name}</td>
                      <td className="inventario-motivo">
                        {m.motivo}
                        {m.referencia && <span className="inventario-secundario">Ref. {m.referencia}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <nav className="inventario-paginacion" aria-label="Paginación del historial">
            <p>
              Mostrando {formatoCantidad.format(historial.from)}–{formatoCantidad.format(historial.to)} de{' '}
              <strong>{formatoCantidad.format(historial.total)}</strong> movimientos
            </p>
            <div className="usuarios-acciones">
              <button type="button" disabled={pagina <= 1 || cargando} onClick={() => setPagina((p) => p - 1)}>Anterior</button>
              <span className="paginacion-actual">Página {historial.current_page} de {historial.last_page}</span>
              <button type="button" disabled={pagina >= historial.last_page || cargando} onClick={() => setPagina((p) => p + 1)}>Siguiente</button>
            </div>
          </nav>
        </>
      )}
    </section>
  );
}
