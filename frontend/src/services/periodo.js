// Periodos de consulta para reportes. Las fechas viajan como texto 'YYYY-MM-DD'.

export const DIAS_MAXIMOS = 366;

/** Fecha local 'YYYY-MM-DD' (sin desfase por zona horaria). */
export function fechaIso(fecha) {
  const local = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function sumarDias(fecha, dias) {
  const copia = new Date(fecha);
  copia.setDate(copia.getDate() + dias);
  return copia;
}

export const PRESETS = [
  { clave: '7d', etiqueta: 'Últimos 7 días' },
  { clave: '30d', etiqueta: 'Últimos 30 días' },
  { clave: '90d', etiqueta: 'Últimos 90 días' },
  { clave: 'mes', etiqueta: 'Este mes' },
  { clave: 'personalizado', etiqueta: 'Personalizado' },
];

/** Rango { desde, hasta } de un preset, relativo a `hoy`. */
export function rangoPreset(clave, hoy = new Date()) {
  const hasta = fechaIso(hoy);
  switch (clave) {
    case '7d': return { desde: fechaIso(sumarDias(hoy, -6)), hasta };
    case '90d': return { desde: fechaIso(sumarDias(hoy, -89)), hasta };
    case 'mes': return { desde: fechaIso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta };
    case '30d':
    default: return { desde: fechaIso(sumarDias(hoy, -29)), hasta };
  }
}

/** Días naturales entre dos fechas 'YYYY-MM-DD', ambos incluidos. */
export function diasDelPeriodo(desde, hasta) {
  const inicio = Date.UTC(...desde.split('-').map((n, i) => (i === 1 ? Number(n) - 1 : Number(n))));
  const fin = Date.UTC(...hasta.split('-').map((n, i) => (i === 1 ? Number(n) - 1 : Number(n))));
  return Math.round((fin - inicio) / 86400000) + 1;
}

/**
 * Valida un periodo y devuelve el mensaje de error o null si es válido.
 * Replica las reglas del backend para avisar antes de consultar.
 */
export function validarPeriodo({ desde, hasta }, hoy = new Date()) {
  const formato = /^\d{4}-\d{2}-\d{2}$/;
  if (!desde || !hasta) return 'Indica la fecha inicial y la fecha final.';
  if (!formato.test(desde) || !formato.test(hasta)) return 'Las fechas deben tener el formato AAAA-MM-DD.';
  if (desde > hasta) return 'La fecha inicial no puede ser posterior a la fecha final.';
  if (desde > fechaIso(hoy)) return 'El periodo no puede comenzar en una fecha futura.';
  if (diasDelPeriodo(desde, hasta) > DIAS_MAXIMOS) return `El periodo no puede superar ${DIAS_MAXIMOS} días.`;
  return null;
}

const formatoCorto = new Intl.DateTimeFormat('es-SV', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** '2026-11-01' → '1 nov 2026' */
export function fechaCorta(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return formatoCorto.format(new Date(Date.UTC(a, m - 1, d)));
}

export function describirPeriodo({ desde, hasta }) {
  return `${fechaCorta(desde)} – ${fechaCorta(hasta)}`;
}
