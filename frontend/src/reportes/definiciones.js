// Definición única de cada reporte a partir de las respuestas de la API.
// La misma estructura alimenta la pantalla, el PDF y el Excel:
//
// {
//   titulo, archivo, periodo: { desde, hasta } | null, filtro: string | null,
//   resumen:  [{ etiqueta, valor, tipo }],
//   graficos: [{ titulo, formato, datos: [{ etiqueta, valor }] }],
//   tablas:   [{ titulo, columnas: [{ titulo, clave, tipo, ancho }], filas, totales? }],
// }
//
// Tipos de valor: 'texto' | 'entero' | 'dinero' | 'fecha' | 'estado'.

export const ESTADOS_EXISTENCIA = {
  agotado: 'Agotado',
  stock_bajo: 'Stock bajo',
  disponible: 'Disponible',
};

const numero = (valor) => Number(valor ?? 0);

function sumar(filas, clave) {
  return filas.reduce((total, fila) => total + numero(fila[clave]), 0);
}

/** Valor del inventario agrupado por categoría, de mayor a menor. */
export function valorPorCategoria(productos) {
  const grupos = new Map();
  for (const p of productos) grupos.set(p.categoria, (grupos.get(p.categoria) ?? 0) + numero(p.valor));
  return [...grupos]
    .map(([etiqueta, valor]) => ({ etiqueta, valor: Math.round(valor * 100) / 100 }))
    .sort((a, b) => b.valor - a.valor || a.etiqueta.localeCompare(b.etiqueta, 'es'));
}

// ─────────────────────────────────────────────────────────────
// Existencias actuales / agotados / stock bajo
// ─────────────────────────────────────────────────────────────
export function documentoExistencias(datos, { filtro = null } = {}) {
  const { totales, productos } = datos;
  const porCategoria = valorPorCategoria(productos);

  return {
    titulo: 'Reporte de existencias',
    archivo: 'reporte-existencias',
    periodo: null,
    filtro,
    resumen: [
      { etiqueta: 'Productos', valor: totales.productos, tipo: 'entero' },
      { etiqueta: 'Unidades en existencia', valor: totales.unidades, tipo: 'entero' },
      { etiqueta: 'Valor del inventario', valor: numero(totales.valor), tipo: 'dinero' },
      { etiqueta: 'Agotados', valor: totales.agotados, tipo: 'entero' },
      { etiqueta: 'Con stock bajo', valor: totales.stock_bajo, tipo: 'entero' },
    ],
    // Un gráfico con todas las barras en cero (p. ej. solo agotados) no aporta información.
    graficos: porCategoria.some((d) => d.valor > 0)
      ? [{ titulo: 'Valor del inventario por categoría', formato: 'dinero', datos: porCategoria }]
      : [],
    tablas: [{
      titulo: 'Existencias por producto',
      columnas: [
        { titulo: 'Código', clave: 'codigo', tipo: 'texto', ancho: 18 },
        { titulo: 'Producto', clave: 'nombre', tipo: 'texto', ancho: 34 },
        { titulo: 'Categoría', clave: 'categoria', tipo: 'texto', ancho: 24 },
        { titulo: 'Estado', clave: 'estado', tipo: 'estado', ancho: 13 },
        { titulo: 'Stock', clave: 'stock', tipo: 'entero', ancho: 10 },
        { titulo: 'Stock mínimo', clave: 'stock_minimo', tipo: 'entero', ancho: 13 },
        { titulo: 'Precio', clave: 'precio', tipo: 'dinero', ancho: 12 },
        { titulo: 'Valor', clave: 'valor', tipo: 'dinero', ancho: 14 },
      ],
      filas: productos.map((p) => ({ ...p, precio: numero(p.precio), valor: numero(p.valor) })),
      totales: { codigo: 'Total', stock: totales.unidades, valor: numero(totales.valor) },
    }],
  };
}

// ─────────────────────────────────────────────────────────────
// Productos más vendidos y de poca rotación
// ─────────────────────────────────────────────────────────────
export function documentoVentas(ventas, rotacion, periodo) {
  const masVendidos = ventas.mas_vendidos.map((p) => ({ ...p, importe: numero(p.importe) }));
  const sinVentas = rotacion.productos.filter((p) => p.unidades_vendidas === 0).length;

  return {
    titulo: 'Reporte de ventas y rotación',
    archivo: 'reporte-ventas-rotacion',
    periodo,
    filtro: null,
    resumen: [
      { etiqueta: 'Ventas registradas', valor: ventas.totales.ventas, tipo: 'entero' },
      { etiqueta: 'Unidades vendidas', valor: ventas.totales.unidades, tipo: 'entero' },
      { etiqueta: 'Importe vendido', valor: numero(ventas.totales.importe), tipo: 'dinero' },
      { etiqueta: 'Productos sin ventas (de los listados)', valor: sinVentas, tipo: 'entero' },
    ],
    graficos: [
      { titulo: 'Productos más vendidos (unidades)', formato: 'entero', datos: masVendidos.map((p) => ({ etiqueta: p.nombre, valor: p.unidades })) },
    ],
    tablas: [
      {
        titulo: 'Productos más vendidos',
        columnas: [
          { titulo: '#', clave: 'posicion', tipo: 'entero', ancho: 6 },
          { titulo: 'Código', clave: 'codigo', tipo: 'texto', ancho: 18 },
          { titulo: 'Producto', clave: 'nombre', tipo: 'texto', ancho: 36 },
          { titulo: 'Unidades', clave: 'unidades', tipo: 'entero', ancho: 12 },
          { titulo: 'Importe', clave: 'importe', tipo: 'dinero', ancho: 14 },
        ],
        filas: masVendidos.map((p, i) => ({ ...p, posicion: i + 1 })),
        totales: { codigo: 'Total', unidades: sumar(masVendidos, 'unidades'), importe: sumar(masVendidos, 'importe') },
      },
      {
        titulo: 'Productos de poca rotación',
        columnas: [
          { titulo: 'Código', clave: 'codigo', tipo: 'texto', ancho: 18 },
          { titulo: 'Producto', clave: 'nombre', tipo: 'texto', ancho: 32 },
          { titulo: 'Categoría', clave: 'categoria', tipo: 'texto', ancho: 22 },
          { titulo: 'Vendidas en el periodo', clave: 'unidades_vendidas', tipo: 'entero', ancho: 14 },
          { titulo: 'Stock', clave: 'stock', tipo: 'entero', ancho: 10 },
          { titulo: 'Valor inmovilizado', clave: 'valor_inmovilizado', tipo: 'dinero', ancho: 16 },
          { titulo: 'Última venta', clave: 'ultima_venta', tipo: 'fecha', ancho: 14 },
          { titulo: 'Días sin venta', clave: 'dias_sin_venta', tipo: 'entero', ancho: 12 },
        ],
        filas: rotacion.productos.map((p) => ({ ...p, valor_inmovilizado: numero(p.valor_inmovilizado) })),
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────
// Movimientos por periodo
// ─────────────────────────────────────────────────────────────
export function documentoMovimientos(movimientos, periodo) {
  const { totales } = movimientos;
  const diasConMovimiento = movimientos.por_dia.filter((d) => d.entradas || d.salidas);

  return {
    titulo: 'Reporte de movimientos por periodo',
    archivo: 'reporte-movimientos',
    periodo,
    filtro: null,
    resumen: [
      { etiqueta: 'Entradas registradas', valor: totales.movimientos_entrada, tipo: 'entero' },
      { etiqueta: 'Unidades que entraron', valor: totales.unidades_entrada, tipo: 'entero' },
      { etiqueta: 'Salidas registradas', valor: totales.movimientos_salida, tipo: 'entero' },
      { etiqueta: 'Unidades que salieron', valor: totales.unidades_salida, tipo: 'entero' },
      { etiqueta: 'Variación neta de unidades', valor: totales.variacion_neta, tipo: 'entero' },
    ],
    graficos: [],
    tablas: [
      {
        titulo: 'Movimientos por concepto',
        columnas: [
          { titulo: 'Tipo', clave: 'tipo_etiqueta', tipo: 'texto', ancho: 12 },
          { titulo: 'Concepto', clave: 'etiqueta', tipo: 'texto', ancho: 22 },
          { titulo: 'Movimientos', clave: 'movimientos', tipo: 'entero', ancho: 14 },
          { titulo: 'Unidades', clave: 'unidades', tipo: 'entero', ancho: 12 },
          { titulo: 'Importe', clave: 'importe', tipo: 'dinero', ancho: 14 },
        ],
        filas: movimientos.por_concepto.map((c) => ({
          ...c,
          tipo_etiqueta: c.tipo === 'entrada' ? 'Entrada' : 'Salida',
          importe: numero(c.importe),
        })),
      },
      {
        titulo: 'Movimientos por día',
        columnas: [
          { titulo: 'Fecha', clave: 'fecha', tipo: 'fecha', ancho: 14 },
          { titulo: 'Unidades que entraron', clave: 'entradas', tipo: 'entero', ancho: 18 },
          { titulo: 'Unidades que salieron', clave: 'salidas', tipo: 'entero', ancho: 18 },
          { titulo: 'Variación neta', clave: 'neto', tipo: 'entero', ancho: 14 },
        ],
        filas: diasConMovimiento.map((d) => ({ ...d, neto: d.entradas - d.salidas })),
        totales: {
          fecha: 'Total',
          entradas: totales.unidades_entrada,
          salidas: totales.unidades_salida,
          neto: totales.variacion_neta,
        },
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────
// Indicadores generales
// ─────────────────────────────────────────────────────────────
export function documentoIndicadores(inventario, ventas, movimientos, periodo) {
  const { totales } = inventario;

  return {
    titulo: 'Indicadores de inventario',
    archivo: 'indicadores-inventario',
    periodo,
    filtro: null,
    resumen: [
      { etiqueta: 'Valor del inventario', valor: numero(totales.valor), tipo: 'dinero' },
      { etiqueta: 'Unidades en existencia', valor: totales.unidades, tipo: 'entero' },
      { etiqueta: 'Productos con existencias', valor: totales.productos_disponibles, tipo: 'entero' },
      { etiqueta: 'Productos agotados', valor: totales.agotados, tipo: 'entero' },
      { etiqueta: 'Productos con stock bajo', valor: totales.stock_bajo, tipo: 'entero' },
      { etiqueta: 'Importe vendido en el periodo', valor: numero(ventas.totales.importe), tipo: 'dinero' },
      { etiqueta: 'Unidades vendidas en el periodo', valor: ventas.totales.unidades, tipo: 'entero' },
      { etiqueta: 'Variación neta de unidades', valor: movimientos.totales.variacion_neta, tipo: 'entero' },
    ],
    graficos: [
      {
        titulo: 'Valor del inventario por categoría',
        formato: 'dinero',
        datos: inventario.por_categoria
          .map((c) => ({ etiqueta: c.nombre, valor: numero(c.valor) }))
          .sort((a, b) => b.valor - a.valor),
      },
    ],
    tablas: [{
      titulo: 'Inventario por categoría',
      columnas: [
        { titulo: 'Categoría', clave: 'nombre', tipo: 'texto', ancho: 28 },
        { titulo: 'Productos', clave: 'productos', tipo: 'entero', ancho: 12 },
        { titulo: 'Agotados', clave: 'agotados', tipo: 'entero', ancho: 12 },
        { titulo: 'Unidades', clave: 'unidades', tipo: 'entero', ancho: 12 },
        { titulo: 'Valor', clave: 'valor', tipo: 'dinero', ancho: 16 },
      ],
      filas: inventario.por_categoria.map((c) => ({ ...c, valor: numero(c.valor) })),
      totales: {
        nombre: 'Total',
        productos: totales.productos,
        agotados: totales.agotados,
        unidades: totales.unidades,
        valor: numero(totales.valor),
      },
    }],
  };
}
