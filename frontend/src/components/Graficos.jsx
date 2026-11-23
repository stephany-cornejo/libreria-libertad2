import { useState } from 'react';
import { SERIES, escalaEje } from './escalaGraficos';
import './Graficos.css';

const compacto = new Intl.NumberFormat('es-SV', { notation: 'compact', maximumFractionDigits: 1 });
const fechaEje = new Intl.DateTimeFormat('es-SV', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fechaLarga = new Intl.DateTimeFormat('es-SV', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

const aUtc = (iso) => {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d));
};

// ─────────────────────────────────────────────────────────────
// Barras horizontales: una serie, valor al final de cada barra
// ─────────────────────────────────────────────────────────────
export function BarrasHorizontales({ titulo, descripcion, datos, formato, limite = 10 }) {
  const [activa, setActiva] = useState(null);
  const visibles = datos.slice(0, limite);
  const maximo = Math.max(0, ...visibles.map((d) => d.valor)) || 1;
  const total = datos.reduce((suma, d) => suma + d.valor, 0);

  return (
    <figure className="grafico">
      <figcaption className="grafico-cabecera">
        <h3>{titulo}</h3>
        {descripcion && <p>{descripcion}</p>}
      </figcaption>
      {visibles.length === 0 ? (
        <p className="grafico-vacio">Sin datos para el periodo seleccionado.</p>
      ) : (
        <ul className="barras" onMouseLeave={() => setActiva(null)}>
          {visibles.map((dato, i) => {
            const porcentaje = total ? Math.round((dato.valor / total) * 1000) / 10 : 0;
            return (
              <li
                key={dato.etiqueta}
                className={`barras-fila${activa !== null && activa !== i ? ' barras-atenuada' : ''}`}
                tabIndex={0}
                aria-label={`${dato.etiqueta}: ${formato(dato.valor)} (${porcentaje}% del total)`}
                onMouseEnter={() => setActiva(i)}
                onFocus={() => setActiva(i)}
                onBlur={() => setActiva(null)}
              >
                <span className="barras-etiqueta" title={dato.etiqueta}>{dato.etiqueta}</span>
                <span className="barras-pista">
                  <span className="barras-barra" style={{ width: `${(dato.valor / maximo) * 100}%`, background: SERIES.principal }} />
                  <span className="barras-valor">{formato(dato.valor)}</span>
                  {activa === i && (
                    <span className="grafico-tooltip barras-tooltip" role="presentation">
                      <strong>{dato.etiqueta}</strong>
                      <span>{formato(dato.valor)} · {porcentaje}% del total</span>
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {datos.length > visibles.length && (
        <p className="grafico-nota">Se muestran los {visibles.length} primeros de {datos.length}. La tabla incluye todos.</p>
      )}
    </figure>
  );
}

// ─────────────────────────────────────────────────────────────
// Columnas por día: una o varias series agrupadas
// ─────────────────────────────────────────────────────────────
export function ColumnasPorDia({ titulo, descripcion, dias, series, formato }) {
  const [activo, setActivo] = useState(null);
  const maximo = Math.max(0, ...dias.flatMap((d) => series.map((s) => d[s.clave] ?? 0)));
  const { tope, marcas } = escalaEje(maximo);
  const cadaCuanto = Math.max(1, Math.ceil(dias.length / 8));
  const hayDatos = maximo > 0;
  const dia = activo !== null ? dias[activo] : null;

  return (
    <figure className="grafico">
      <figcaption className="grafico-cabecera">
        <h3>{titulo}</h3>
        {descripcion && <p>{descripcion}</p>}
      </figcaption>

      {series.length > 1 && (
        <ul className="grafico-leyenda" aria-label="Leyenda">
          {series.map((s) => (
            <li key={s.clave}><span className="leyenda-muestra" style={{ background: s.color }} />{s.etiqueta}</li>
          ))}
        </ul>
      )}

      {!hayDatos ? (
        <p className="grafico-vacio">Sin movimientos en el periodo seleccionado.</p>
      ) : (
        <div className="columnas" onMouseLeave={() => setActivo(null)}>
          <div className="columnas-eje" aria-hidden="true">
            {[...marcas].reverse().map((m) => <span key={m}>{compacto.format(m)}</span>)}
          </div>
          <div className="columnas-area">
            {marcas.map((m) => (
              <span key={m} className={`columnas-guia${m === 0 ? ' columnas-base' : ''}`} style={{ bottom: `${(m / tope) * 100}%` }} aria-hidden="true" />
            ))}
            <div className="columnas-grupos">
              {dias.map((d, i) => (
                <div
                  key={d.fecha}
                  className={`columnas-grupo${activo === i ? ' columnas-grupo-activo' : ''}`}
                  tabIndex={0}
                  aria-label={`${fechaLarga.format(aUtc(d.fecha))}: ${series.map((s) => `${s.etiqueta} ${formato(d[s.clave] ?? 0)}`).join(', ')}`}
                  onMouseEnter={() => setActivo(i)}
                  onFocus={() => setActivo(i)}
                  onBlur={() => setActivo(null)}
                >
                  <div className="columnas-barras">
                    {series.map((s) => {
                      const valor = d[s.clave] ?? 0;
                      return (
                        <span
                          key={s.clave}
                          className="columnas-barra"
                          style={{ height: `${(valor / tope) * 100}%`, background: s.color, minHeight: valor > 0 ? 2 : 0 }}
                        />
                      );
                    })}
                  </div>
                  <span className="columnas-x" aria-hidden="true">
                    {i % cadaCuanto === 0 ? fechaEje.format(aUtc(d.fecha)) : ''}
                  </span>
                </div>
              ))}
            </div>
            {dia && (
              <div
                className="grafico-tooltip columnas-tooltip"
                style={{ left: `${((activo + 0.5) / dias.length) * 100}%` }}
                data-borde={activo < dias.length * 0.2 ? 'inicio' : activo > dias.length * 0.8 ? 'fin' : undefined}
                role="presentation"
              >
                <strong>{fechaLarga.format(aUtc(dia.fecha))}</strong>
                {series.map((s) => (
                  <span key={s.clave} className="tooltip-serie">
                    <span className="leyenda-muestra" style={{ background: s.color }} />
                    {s.etiqueta}: <b>{formato(dia[s.clave] ?? 0)}</b>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </figure>
  );
}

// ─────────────────────────────────────────────────────────────
// Indicadores (stat tiles)
// ─────────────────────────────────────────────────────────────
export function Indicadores({ items, formatear }) {
  return (
    <dl className="reporte-indicadores">
      {items.map((item) => (
        <div key={item.etiqueta} className={`reporte-indicador${item.tono ? ` indicador-${item.tono}` : ''}`}>
          <dt>{item.etiqueta}</dt>
          <dd>{formatear(item.valor, item.tipo)}</dd>
        </div>
      ))}
    </dl>
  );
}
