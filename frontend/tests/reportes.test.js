// Pruebas de cálculos, validación de periodos y exportaciones de reportes.
// Ejecutar con: npm test
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';

import { validarPeriodo, rangoPreset, diasDelPeriodo, fechaCorta } from '../src/services/periodo.js';
import {
  documentoExistencias,
  documentoMovimientos,
  documentoVentas,
  documentoIndicadores,
  valorPorCategoria,
} from '../src/reportes/definiciones.js';
import { formatearValor, generarExcel, generarPdf, nombreArchivo, nombreHoja } from '../src/reportes/exportar.js';
import { escalaEje } from '../src/components/escalaGraficos.js';

describe('escala de los gráficos', () => {
  test('redondea el máximo del eje a valores legibles', () => {
    assert.deepEqual(escalaEje(0), { tope: 4, marcas: [0, 1, 2, 3, 4] });
    assert.deepEqual(escalaEje(73), { tope: 80, marcas: [0, 20, 40, 60, 80] });
    assert.deepEqual(escalaEje(950), { tope: 1000, marcas: [0, 250, 500, 750, 1000] });
    assert.equal(escalaEje(22658.06).tope, 40000);
    for (const maximo of [1, 7, 19, 101, 3333, 88888]) assert.ok(escalaEje(maximo).tope >= maximo);
  });
});

// ── Datos con la misma forma que devuelve la API ─────────────
const existencias = {
  totales: { productos: 3, unidades: 14, valor: '22.00', agotados: 1, stock_bajo: 1 },
  productos: [
    { id: 1, codigo: 'AGO', nombre: 'Cuaderno rayado', categoria: 'Cuadernos', precio: '3.00', stock: 0, stock_minimo: 2, valor: '0.00', estado: 'agotado' },
    { id: 2, codigo: 'BAJ', nombre: 'Cuaderno cuadriculado', categoria: 'Cuadernos', precio: '2.50', stock: 4, stock_minimo: 5, valor: '10.00', estado: 'stock_bajo' },
    { id: 3, codigo: 'DIS', nombre: 'Lápiz HB', categoria: 'Escritura', precio: '1.20', stock: 10, stock_minimo: 5, valor: '12.00', estado: 'disponible' },
  ],
};

const movimientos = {
  periodo: { desde: '2026-11-01', hasta: '2026-11-05' },
  totales: { movimientos_entrada: 1, movimientos_salida: 2, unidades_entrada: 20, unidades_salida: 7, variacion_neta: 13 },
  por_concepto: [
    { tipo: 'entrada', concepto: 'compra', etiqueta: 'Compra', movimientos: 1, unidades: 20, importe: '90.00' },
    { tipo: 'salida', concepto: 'venta', etiqueta: 'Venta', movimientos: 2, unidades: 7, importe: '52.50' },
  ],
  por_dia: [
    { fecha: '2026-11-01', entradas: 0, salidas: 0 },
    { fecha: '2026-11-02', entradas: 20, salidas: 3 },
    { fecha: '2026-11-03', entradas: 0, salidas: 0 },
    { fecha: '2026-11-04', entradas: 0, salidas: 4 },
    { fecha: '2026-11-05', entradas: 0, salidas: 0 },
  ],
};

const ventas = {
  totales: { ventas: 3, unidades: 9, importe: '52.50' },
  por_dia: [],
  mas_vendidos: [
    { id: 7, codigo: 'REG', nombre: 'Regla 30 cm', unidades: 6, importe: '7.50' },
    { id: 8, codigo: 'LIB', nombre: 'Libro de cuentos', unidades: 3, importe: '45.00' },
  ],
};

const rotacion = {
  productos: [
    { id: 9, codigo: 'NUL', nombre: 'Sin ventas', categoria: 'Arte', stock: 8, unidades_vendidas: 0, valor_inmovilizado: '40.00', ultima_venta: null, dias_sin_venta: null },
    { id: 10, codigo: 'LEN', nombre: 'Lento', categoria: 'Arte', stock: 20, unidades_vendidas: 1, valor_inmovilizado: '80.00', ultima_venta: '2026-11-05T16:00:00Z', dias_sin_venta: 25 },
  ],
};

const inventario = {
  totales: { productos: 3, productos_disponibles: 2, unidades: 14, valor: '22.00', agotados: 1, stock_bajo: 1 },
  por_categoria: [
    { id: 1, nombre: 'Cuadernos', productos: 2, unidades: 4, valor: '10.00', agotados: 1 },
    { id: 2, nombre: 'Escritura', productos: 1, unidades: 10, valor: '12.00', agotados: 0 },
  ],
};

const periodo = { desde: '2026-11-01', hasta: '2026-11-30' };
const meta = { generadoPor: 'Administrador Principal', generadoEn: new Date(2026, 10, 22, 20, 30) };

// ── Periodos ──────────────────────────────────────────────────
describe('validación de periodos', () => {
  const hoy = new Date(2026, 10, 22);

  test('acepta un periodo correcto', () => {
    assert.equal(validarPeriodo({ desde: '2026-11-01', hasta: '2026-11-22' }, hoy), null);
  });

  test('rechaza fechas vacías, invertidas, futuras o periodos demasiado largos', () => {
    assert.match(validarPeriodo({ desde: '', hasta: '2026-11-22' }, hoy), /Indica/);
    assert.match(validarPeriodo({ desde: '2026-11-30', hasta: '2026-11-01' }, hoy), /posterior/);
    assert.match(validarPeriodo({ desde: '2026-12-01', hasta: '2026-12-10' }, hoy), /futura/);
    assert.match(validarPeriodo({ desde: '2025-01-01', hasta: '2026-11-22' }, hoy), /366/);
    assert.match(validarPeriodo({ desde: '01/11/2026', hasta: '2026-11-22' }, hoy), /formato/);
  });

  test('calcula los presets y los días incluidos', () => {
    assert.deepEqual(rangoPreset('7d', hoy), { desde: '2026-11-16', hasta: '2026-11-22' });
    assert.deepEqual(rangoPreset('30d', hoy), { desde: '2026-10-24', hasta: '2026-11-22' });
    assert.deepEqual(rangoPreset('mes', hoy), { desde: '2026-11-01', hasta: '2026-11-22' });
    assert.equal(diasDelPeriodo('2026-11-01', '2026-11-30'), 30);
    assert.equal(diasDelPeriodo('2026-01-01', '2026-12-31'), 365);
    assert.equal(fechaCorta('2026-11-01'), '1 nov 2026');
  });
});

// ── Cálculos de los reportes ─────────────────────────────────
describe('definición de reportes', () => {
  test('existencias: totales, filas numéricas y valor por categoría', () => {
    const doc = documentoExistencias(existencias, { filtro: 'Todos los productos' });
    const [tabla] = doc.tablas;
    assert.equal(doc.resumen.find((r) => r.etiqueta === 'Valor del inventario').valor, 22);
    assert.equal(tabla.filas.length, 3);
    assert.equal(tabla.filas[1].valor, 10);
    assert.equal(typeof tabla.filas[1].precio, 'number');
    assert.deepEqual(tabla.totales, { codigo: 'Total', stock: 14, valor: 22 });
    assert.deepEqual(valorPorCategoria(existencias.productos), [
      { etiqueta: 'Escritura', valor: 12 },
      { etiqueta: 'Cuadernos', valor: 10 },
    ]);
  });

  test('existencias: omite el gráfico cuando todos los valores son cero', () => {
    const soloAgotados = {
      totales: { productos: 1, unidades: 0, valor: '0.00', agotados: 1, stock_bajo: 0 },
      productos: [existencias.productos[0]],
    };
    assert.deepEqual(documentoExistencias(soloAgotados).graficos, []);
    assert.equal(documentoExistencias(existencias).graficos.length, 1);
  });

  test('ventas: ranking de más vendidos con totales y conteo de productos sin ventas', () => {
    const doc = documentoVentas(ventas, rotacion, periodo);
    const [masVendidos, pocaRotacion] = doc.tablas;
    assert.deepEqual(masVendidos.filas.map((f) => [f.posicion, f.codigo]), [[1, 'REG'], [2, 'LIB']]);
    assert.deepEqual(masVendidos.totales, { codigo: 'Total', unidades: 9, importe: 52.5 });
    assert.equal(doc.resumen.find((r) => r.etiqueta.startsWith('Productos sin ventas')).valor, 1);
    assert.equal(pocaRotacion.filas[0].valor_inmovilizado, 40);
    assert.deepEqual(doc.graficos[0].datos, [{ etiqueta: 'Regla 30 cm', valor: 6 }, { etiqueta: 'Libro de cuentos', valor: 3 }]);
  });

  test('movimientos: solo días con actividad y variación neta por día', () => {
    const doc = documentoMovimientos(movimientos, movimientos.periodo);
    const porDia = doc.tablas[1];
    assert.deepEqual(porDia.filas.map((f) => [f.fecha, f.neto]), [['2026-11-02', 17], ['2026-11-04', -4]]);
    assert.deepEqual(porDia.totales, { fecha: 'Total', entradas: 20, salidas: 7, neto: 13 });
    assert.equal(doc.tablas[0].filas[0].tipo_etiqueta, 'Entrada');
  });

  test('indicadores: categorías ordenadas por valor', () => {
    const doc = documentoIndicadores(inventario, ventas, movimientos, periodo);
    assert.deepEqual(doc.graficos[0].datos.map((d) => d.etiqueta), ['Escritura', 'Cuadernos']);
    assert.equal(doc.resumen.find((r) => r.etiqueta === 'Importe vendido en el periodo').valor, 52.5);
  });

  test('formatea valores para presentación', () => {
    assert.equal(formatearValor(1234, 'entero'), '1,234');
    assert.match(formatearValor(52.5, 'dinero'), /^(US)?\$52\.50$/);
    assert.equal(formatearValor('stock_bajo', 'estado'), 'Stock bajo');
    assert.equal(formatearValor(null, 'fecha'), '-');
    assert.equal(formatearValor('2026-11-02', 'fecha'), '2 nov 2026');
  });
});

// ── Exportaciones ─────────────────────────────────────────────
describe('exportación a Excel', () => {
  test('genera hojas con números reales, formatos, filtros y totales', async () => {
    const doc = documentoExistencias(existencias, { filtro: 'Todos los productos' });
    const buffer = await generarExcel(doc, meta);

    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(buffer);
    assert.deepEqual(libro.worksheets.map((h) => h.name), ['Resumen', 'Existencias por producto']);

    const resumen = libro.getWorksheet('Resumen');
    assert.equal(resumen.getCell('A2').value, 'Reporte de existencias');
    const filaValor = resumen.getColumn(1).values.indexOf('Valor del inventario');
    assert.equal(resumen.getCell(filaValor, 2).value, 22);
    assert.equal(resumen.getCell(filaValor, 2).numFmt, '"$"#,##0.00');

    const hoja = libro.getWorksheet('Existencias por producto');
    assert.deepEqual(hoja.getRow(1).values.slice(1), ['Código', 'Producto', 'Categoría', 'Estado', 'Stock', 'Stock mínimo', 'Precio', 'Valor']);
    assert.equal(hoja.getCell('A1').font.bold, true);
    assert.equal(hoja.getCell('D2').value, 'Agotado');
    assert.equal(hoja.getCell('E3').value, 4);
    assert.equal(hoja.getCell('G3').value, 2.5);
    assert.equal(hoja.getCell('H3').numFmt, '"$"#,##0.00');
    assert.equal(hoja.views[0].state, 'frozen');
    assert.ok(hoja.autoFilter);
    // Fila de totales
    assert.equal(hoja.getCell('A5').value, 'Total');
    assert.equal(hoja.getCell('E5').value, 14);
    assert.equal(hoja.getCell('H5').value, 22);
  });

  test('exporta fechas como fechas de Excel y tablas vacías con aviso', async () => {
    const doc = documentoVentas(ventas, rotacion, periodo);
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(await generarExcel(doc, meta));
    const hoja = libro.getWorksheet('Productos de poca rotación');
    const ultimaVenta = hoja.getCell('G3').value;
    assert.ok(ultimaVenta instanceof Date);
    assert.equal(ultimaVenta.toISOString().slice(0, 10), '2026-11-05');
    assert.equal(hoja.getCell('G2').value, null);

    const vacio = documentoExistencias({ totales: { productos: 0, unidades: 0, valor: '0.00', agotados: 0, stock_bajo: 0 }, productos: [] });
    const libroVacio = new ExcelJS.Workbook();
    await libroVacio.xlsx.load(await generarExcel(vacio, meta));
    assert.match(libroVacio.getWorksheet('Existencias por producto').getCell('A2').value, /Sin datos/);
  });

  test('normaliza nombres de hoja', () => {
    const usados = new Set();
    assert.equal(nombreHoja('Ventas: enero/febrero [2026]', usados), 'Ventas  enero febrero  2026');
    assert.equal(nombreHoja('Una hoja con un nombre demasiado largo para Excel', usados).length, 31);
    assert.equal(nombreHoja('Resumen', usados), 'Resumen');
    assert.equal(nombreHoja('Resumen', usados), 'Resumen 2');
  });
});

describe('exportación a PDF', () => {
  const textoPdf = (buffer) => Buffer.from(buffer).toString('latin1');
  const paginas = (texto) => (texto.match(/\/Type \/Page\b(?!s)/g) ?? []).length;

  test('genera un PDF válido con título, periodo, indicadores, tablas y numeración', async () => {
    const doc = documentoVentas(ventas, rotacion, periodo);
    const texto = textoPdf(await generarPdf(doc, meta));
    assert.ok(texto.startsWith('%PDF-'));
    assert.equal(paginas(texto), 1);
    for (const fragmento of ['Reporte de ventas y rotaci', 'Periodo: 1 nov 2026', 'Productos m', 'Regla 30 cm', 'Administrador Principal', 'gina 1 de 1']) {
      assert.ok(texto.includes(fragmento), `Falta en el PDF: ${fragmento}`);
    }
    assert.ok(!texto.includes('{total_paginas}'), 'El total de páginas no se reemplazó');
  });

  test('pagina tablas largas y repite la numeración en cada página', async () => {
    const muchos = {
      totales: { productos: 150, unidades: 1500, valor: '15000.00', agotados: 0, stock_bajo: 0 },
      productos: Array.from({ length: 150 }, (_, i) => ({
        id: i + 1, codigo: `P-${String(i + 1).padStart(3, '0')}`, nombre: `Producto ${i + 1}`, categoria: `Categoría ${i % 12}`,
        precio: '10.00', stock: 10, stock_minimo: 2, valor: '100.00', estado: 'disponible',
      })),
    };
    const texto = textoPdf(await generarPdf(documentoExistencias(muchos), meta));
    const total = paginas(texto);
    assert.ok(total >= 4, `Se esperaban varias páginas y hubo ${total}`);
    assert.ok(texto.includes(`gina ${total} de ${total}`));
    assert.ok(texto.includes('P-150'));
  });

  test('nombra los archivos con el periodo o la fecha', () => {
    assert.equal(nombreArchivo(documentoVentas(ventas, rotacion, periodo), 'pdf'), 'reporte-ventas-rotacion_2026-11-01_a_2026-11-30.pdf');
    assert.equal(nombreArchivo(documentoExistencias(existencias), 'xlsx', new Date(2026, 10, 22)), 'reporte-existencias_2026-11-22.xlsx');
  });
});
