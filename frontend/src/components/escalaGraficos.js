// Constantes y cálculos compartidos por los gráficos (sin componentes).

// Serie principal y secundaria: paleta validada para daltonismo sobre fondo blanco.
export const SERIES = { principal: '#2a78d6', secundaria: '#eb6834' };

/** Máximo "redondo" del eje y sus marcas (4 intervalos). */
export function escalaEje(maximo) {
  if (maximo <= 0) return { tope: 4, marcas: [0, 1, 2, 3, 4] };
  const crudo = maximo / 4;
  const potencia = 10 ** Math.floor(Math.log10(crudo));
  const paso = [1, 2, 2.5, 5, 10].map((f) => f * potencia).find((p) => p >= crudo);
  return { tope: paso * 4, marcas: [0, 1, 2, 3, 4].map((i) => i * paso) };
}
