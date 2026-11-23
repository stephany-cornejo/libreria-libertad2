import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { detalleError } from '../services/formato';
import { PRESETS, describirPeriodo, fechaIso, rangoPreset, validarPeriodo } from '../services/periodo';
import {
  documentoExistencias,
  documentoIndicadores,
  documentoMovimientos,
  documentoVentas,
} from '../reportes/definiciones';
import { exportarReporte, formatearValor } from '../reportes/exportar';
import { BarrasHorizontales, ColumnasPorDia, Indicadores } from '../components/Graficos';
import { SERIES } from '../components/escalaGraficos';
import './Usuarios.css';
import './Inventario.css';
import './Reportes.css';

const PESTANAS = [
  { clave: 'indicadores', etiqueta: 'Indicadores' },
  { clave: 'existencias', etiqueta: 'Existencias' },
  { clave: 'ventas', etiqueta: 'Ventas y rotación' },
  { clave: 'movimientos', etiqueta: 'Movimientos por periodo' },
];

const FILTROS_ESTADO = [
  { valor: '', etiqueta: 'Todos los productos' },
  { valor: 'agotados', etiqueta: 'Agotados' },
  { valor: 'stock_bajo', etiqueta: 'Con stock bajo' },
  { valor: 'disponibles', etiqueta: 'Disponibles (sobre el mínimo)' },
];

const CLASE_ESTADO = { agotado: 'estado-agotado', stock_bajo: 'estado-bajo', disponible: 'estado-activo' };
const formatoUnidades = (valor) => formatearValor(valor, 'entero');
const formatoDinero = (valor) => formatearValor(valor, 'dinero');

function conTono(resumen) {
  return resumen.map((item) => ({
    ...item,
    tono: /agotad/i.test(item.etiqueta) && item.valor > 0 ? 'peligro'
      : /stock bajo/i.test(item.etiqueta) && item.valor > 0 ? 'aviso' : undefined,
  }));
}

// ─────────────────────────────────────────────────────────────
// Tabla genérica de reporte
// ─────────────────────────────────────────────────────────────
function TablaReporte({ tabla, descripcion }) {
  const esNumero = (tipo) => tipo === 'entero' || tipo === 'dinero';
  const idTitulo = `tabla-${tabla.titulo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  return (
    <section className="reporte-tabla" aria-labelledby={idTitulo}>
      <div className="grafico-cabecera">
        <h3 id={idTitulo}>{tabla.titulo}</h3>
        {descripcion && <p>{descripcion}</p>}
      </div>
      {tabla.filas.length === 0 ? (
        <p className="aviso">Sin datos para los criterios seleccionados.</p>
      ) : (
        <div className="usuarios-tabla-contenedor">
          <table className="usuarios-tabla">
            <thead>
              <tr>{tabla.columnas.map((c) => <th key={c.clave} className={esNumero(c.tipo) ? 'tabla-cifra' : undefined}>{c.titulo}</th>)}</tr>
            </thead>
            <tbody>
              {tabla.filas.map((fila, i) => (
                <tr key={fila.id ?? fila.fecha ?? fila.concepto ?? i}>
                  {tabla.columnas.map((c) => {
                    const texto = formatearValor(fila[c.clave], c.tipo);
                    if (c.tipo === 'estado') {
                      return <td key={c.clave}><span className={`estado-registro ${CLASE_ESTADO[fila[c.clave]] ?? ''}`}>{texto}</span></td>;
                    }
                    return (
                      <td key={c.clave} className={[esNumero(c.tipo) && 'tabla-cifra', c.clave === 'codigo' && 'tabla-codigo', c.clave === 'nombre' && 'tabla-nombre'].filter(Boolean).join(' ') || undefined}>
                        {texto}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            {tabla.totales && (
              <tfoot>
                <tr>
                  {tabla.columnas.map((c) => (
                    <td key={c.clave} className={esNumero(c.tipo) ? 'tabla-cifra' : undefined}>
                      {c.clave in tabla.totales ? formatearValor(tabla.totales[c.clave], esNumero(c.tipo) ? c.tipo : 'texto') : ''}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Módulo de reportes
// ─────────────────────────────────────────────────────────────
export default function Reportes({ perfil }) {
  const [pestana, setPestana] = useState('indicadores');
  const [preset, setPreset] = useState('30d');
  const [periodo, setPeriodo] = useState(() => rangoPreset('30d'));
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [categorias, setCategorias] = useState([]);
  const [datos, setDatos] = useState({});
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [exportando, setExportando] = useState(null);
  const [aviso, setAviso] = useState(null);

  const usaPeriodo = pestana !== 'existencias';
  const errorPeriodo = usaPeriodo ? validarPeriodo(periodo) : null;
  const [hoy] = useState(() => fechaIso(new Date()));

  useEffect(() => {
    api.get('/api/categorias').then(({ data }) => setCategorias(data)).catch(() => setCategorias([]));
  }, []);

  // Consulta los datos de la pestaña activa cuando cambian el periodo o los filtros.
  useEffect(() => {
    if (errorPeriodo) return undefined;

    const controlador = new AbortController();
    const opciones = { signal: controlador.signal };
    const conPeriodo = (extra = {}) => ({ ...opciones, params: { desde: periodo.desde, hasta: periodo.hasta, ...extra } });

    const consultas = {
      indicadores: () => Promise.all([
        api.get('/api/reportes/inventario', opciones),
        api.get('/api/reportes/ventas', conPeriodo()),
        api.get('/api/reportes/movimientos', conPeriodo()),
      ]).then(([inventario, ventas, movimientos]) => ({ inventario: inventario.data, ventas: ventas.data, movimientos: movimientos.data })),
      existencias: () => api.get('/api/reportes/existencias', {
        ...opciones,
        params: { estado: filtroEstado || undefined, categoria_id: filtroCategoria || undefined },
      }).then(({ data }) => ({ existencias: data })),
      ventas: () => Promise.all([
        api.get('/api/reportes/ventas', conPeriodo({ limite: 10 })),
        api.get('/api/reportes/rotacion', conPeriodo({ limite: 15 })),
      ]).then(([ventas, rotacion]) => ({ ventas: ventas.data, rotacion: rotacion.data })),
      movimientos: () => api.get('/api/reportes/movimientos', conPeriodo()).then(({ data }) => ({ movimientos: data })),
    };

    const espera = setTimeout(() => {
      setCargando(true);
      consultas[pestana]()
        .then((resultado) => { setDatos((actual) => ({ ...actual, [pestana]: resultado })); setError(''); })
        .catch((fallo) => {
          if (!controlador.signal.aborted) setError(detalleError(fallo, 'No se pudo cargar el reporte.'));
        })
        .finally(() => {
          if (!controlador.signal.aborted) setCargando(false);
        });
    }, 250);

    return () => { clearTimeout(espera); controlador.abort(); };
  }, [pestana, periodo.desde, periodo.hasta, filtroEstado, filtroCategoria, errorPeriodo]);

  const actual = datos[pestana];
  const documento = useMemo(() => {
    if (!actual) return null;
    switch (pestana) {
      case 'indicadores': return documentoIndicadores(actual.inventario, actual.ventas, actual.movimientos, actual.movimientos.periodo);
      case 'existencias': {
        const estado = FILTROS_ESTADO.find((f) => f.valor === filtroEstado)?.etiqueta;
        const categoria = categorias.find((c) => String(c.id) === filtroCategoria)?.nombre;
        return documentoExistencias(actual.existencias, { filtro: [estado, categoria && `categoría ${categoria}`].filter(Boolean).join(', ') });
      }
      case 'ventas': return documentoVentas(actual.ventas, actual.rotacion, actual.ventas.periodo);
      case 'movimientos': return documentoMovimientos(actual.movimientos, actual.movimientos.periodo);
      default: return null;
    }
  }, [actual, pestana, filtroEstado, filtroCategoria, categorias]);

  function elegirPreset(clave) {
    setPreset(clave);
    if (clave !== 'personalizado') setPeriodo(rangoPreset(clave));
  }

  function cambiarFecha(evento) {
    const { name, value } = evento.target;
    setPreset('personalizado');
    setPeriodo((p) => ({ ...p, [name]: value }));
  }

  function cambiarPestana(clave) {
    setPestana(clave);
    setAviso(null);
    setError('');
  }

  async function exportar(extension) {
    setExportando(extension);
    setAviso(null);
    try {
      const nombre = await exportarReporte(documento, extension, { generadoPor: perfil?.nombre ?? '', generadoEn: new Date() });
      setAviso({ tipo: 'exito', texto: `Reporte descargado: ${nombre}` });
    } catch (fallo) {
      console.error(fallo);
      setAviso({ tipo: 'error', texto: `No se pudo generar el ${extension === 'pdf' ? 'PDF' : 'archivo de Excel'}. Intenta de nuevo.` });
    } finally {
      setExportando(null);
    }
  }

  // Ventas por día rellenando los días sin ventas con cero.
  const ventasPorDia = useMemo(() => {
    if (pestana !== 'indicadores' || !actual) return [];
    const importes = new Map(actual.ventas.por_dia.map((d) => [d.fecha, Number(d.importe)]));
    return actual.movimientos.por_dia.map((d) => ({ fecha: d.fecha, importe: importes.get(d.fecha) ?? 0 }));
  }, [actual, pestana]);

  const seriesMovimientos = [
    { clave: 'entradas', etiqueta: 'Unidades que entraron', color: SERIES.principal },
    { clave: 'salidas', etiqueta: 'Unidades que salieron', color: SERIES.secundaria },
  ];

  const desactivarExportacion = !documento || cargando || Boolean(errorPeriodo) || exportando !== null;
  const contexto = documento && (documento.periodo ? `Periodo: ${describirPeriodo(documento.periodo)}` : 'Existencias al momento de la consulta');

  return (
    <section className="usuarios-modulo">
      <header className="inventario-titulo">
        <h1>Reportes de inventario</h1>
        <p>Indicadores, existencias, ventas y movimientos, con exportación a PDF y Excel.</p>
      </header>

      <div className="reporte-pestanas" role="tablist" aria-label="Tipo de reporte">
        {PESTANAS.map((p) => (
          <button
            key={p.clave}
            type="button"
            role="tab"
            id={`pestana-${p.clave}`}
            aria-selected={pestana === p.clave}
            aria-controls="panel-reporte"
            tabIndex={pestana === p.clave ? 0 : -1}
            onClick={() => cambiarPestana(p.clave)}
            onKeyDown={(e) => {
              const indice = PESTANAS.findIndex((x) => x.clave === pestana);
              const destino = e.key === 'ArrowRight' ? (indice + 1) % PESTANAS.length : e.key === 'ArrowLeft' ? (indice - 1 + PESTANAS.length) % PESTANAS.length : null;
              if (destino !== null) {
                e.preventDefault();
                cambiarPestana(PESTANAS[destino].clave);
                document.getElementById(`pestana-${PESTANAS[destino].clave}`)?.focus();
              }
            }}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      <div id="panel-reporte" role="tabpanel" aria-labelledby={`pestana-${pestana}`} className="reporte-panel" aria-busy={cargando}>
        {/* Controles: periodo o filtros, y exportación */}
        <div className="reporte-controles">
          {usaPeriodo ? (
            <div className="reporte-periodo">
              <div className="periodo-presets" role="group" aria-label="Periodos predefinidos">
                {PRESETS.map((p) => (
                  <button key={p.clave} type="button" aria-pressed={preset === p.clave} onClick={() => elegirPreset(p.clave)}>
                    {p.etiqueta}
                  </button>
                ))}
              </div>
              <div className="periodo-fechas">
                <label>Desde<input type="date" name="desde" value={periodo.desde} max={hoy} onChange={cambiarFecha} aria-invalid={Boolean(errorPeriodo)} /></label>
                <label>Hasta<input type="date" name="hasta" value={periodo.hasta} max={hoy} onChange={cambiarFecha} aria-invalid={Boolean(errorPeriodo)} /></label>
              </div>
            </div>
          ) : (
            <div className="periodo-fechas">
              <label>
                Estado
                <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
                  {FILTROS_ESTADO.map((f) => <option key={f.valor} value={f.valor}>{f.etiqueta}</option>)}
                </select>
              </label>
              <label>
                Categoría
                <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
                  <option value="">Todas</option>
                  {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </label>
            </div>
          )}

          <div className="reporte-exportar">
            <button type="button" className="accion-principal" disabled={desactivarExportacion} onClick={() => exportar('pdf')}>
              {exportando === 'pdf' ? 'Generando PDF…' : 'Exportar PDF'}
            </button>
            <button type="button" className="accion-principal" disabled={desactivarExportacion} onClick={() => exportar('xlsx')}>
              {exportando === 'xlsx' ? 'Generando Excel…' : 'Exportar Excel'}
            </button>
          </div>
        </div>

        {errorPeriodo && <p role="alert" className="aviso aviso-error">{errorPeriodo}</p>}
        {error && <p role="alert" className="aviso aviso-error">{error}</p>}
        {aviso && (
          <p role={aviso.tipo === 'error' ? 'alert' : 'status'} className={`aviso ${aviso.tipo === 'error' ? 'aviso-error' : 'usuarios-exito'}`}>
            {aviso.texto}
          </p>
        )}
        {!documento && !error && !errorPeriodo && <p role="status" className="aviso">Cargando reporte…</p>}

        {documento && (
          <div className={`reporte-contenido${cargando ? ' tabla-actualizando' : ''}`}>
            <p className="reporte-contexto">
              {contexto}
              {documento.filtro && <> · {documento.filtro}</>}
            </p>

            <Indicadores items={conTono(documento.resumen)} formatear={formatearValor} />

            {pestana === 'indicadores' && (
              <>
                <div className="reporte-graficos">
                  <BarrasHorizontales
                    titulo="Valor del inventario por categoría"
                    descripcion="Precio de venta × unidades en existencia."
                    datos={documento.graficos[0].datos}
                    formato={formatoDinero}
                    limite={12}
                  />
                  <ColumnasPorDia
                    titulo="Entradas y salidas por día"
                    descripcion="Unidades movidas en el periodo."
                    dias={actual.movimientos.por_dia}
                    series={seriesMovimientos}
                    formato={formatoUnidades}
                  />
                </div>
                <ColumnasPorDia
                  titulo="Ventas por día"
                  descripcion="Importe vendido cada día del periodo."
                  dias={ventasPorDia}
                  series={[{ clave: 'importe', etiqueta: 'Importe vendido', color: SERIES.principal }]}
                  formato={formatoDinero}
                />
                <TablaReporte tabla={documento.tablas[0]} />
              </>
            )}

            {pestana === 'existencias' && (
              <>
                {!filtroCategoria && documento.graficos[0]?.datos.length > 1 && (
                  <BarrasHorizontales
                    titulo="Valor del inventario por categoría"
                    descripcion="Según el filtro aplicado."
                    datos={documento.graficos[0].datos}
                    formato={formatoDinero}
                    limite={12}
                  />
                )}
                <TablaReporte tabla={documento.tablas[0]} />
              </>
            )}

            {pestana === 'ventas' && (
              <>
                <BarrasHorizontales
                  titulo="Productos más vendidos"
                  descripcion="Unidades vendidas en el periodo."
                  datos={documento.graficos[0].datos}
                  formato={formatoUnidades}
                />
                <TablaReporte tabla={documento.tablas[0]} />
                <TablaReporte
                  tabla={documento.tablas[1]}
                  descripcion="Productos con existencias que menos se vendieron en el periodo, empezando por los que no tuvieron ventas. El valor inmovilizado es el precio de venta de las unidades en existencia."
                />
              </>
            )}

            {pestana === 'movimientos' && (
              <>
                <ColumnasPorDia
                  titulo="Entradas y salidas por día"
                  descripcion="Unidades movidas en el periodo."
                  dias={actual.movimientos.por_dia}
                  series={seriesMovimientos}
                  formato={formatoUnidades}
                />
                <TablaReporte tabla={documento.tablas[0]} />
                <TablaReporte tabla={documento.tablas[1]} descripcion="Solo se listan los días con movimientos." />
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
