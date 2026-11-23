// Utilidades de presentación compartidas por los módulos de inventario.

export const formatoCantidad = new Intl.NumberFormat('es-SV');

export const formatoDinero = new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' });

const formatoFechaHora = new Intl.DateTimeFormat('es-SV', { dateStyle: 'medium', timeStyle: 'short' });

/** Fecha ISO de la API → texto legible en la zona horaria del navegador. */
export function fechaLegible(iso) {
  return iso ? formatoFechaHora.format(new Date(iso)) : '';
}

/** Valor de un <input type="datetime-local"> (hora local) → ISO en UTC para la API. */
export function fechaLocalAIso(valor) {
  return valor ? new Date(valor).toISOString() : null;
}

/** Fecha y hora local actual en el formato de <input type="datetime-local">. */
export function ahoraLocal() {
  const ahora = new Date();
  ahora.setMinutes(ahora.getMinutes() - ahora.getTimezoneOffset());
  return ahora.toISOString().slice(0, 16);
}

/** Mensaje legible a partir de un error de Axios con respuesta de Laravel. */
export function detalleError(error, mensaje) {
  const datos = error.response?.data;
  if (datos?.errors) return Object.values(datos.errors).flat().join(' ');
  return datos?.mensaje || datos?.message || mensaje;
}
