// Exportación de reportes a PDF (jsPDF + jspdf-autotable) y Excel (ExcelJS).
// Las librerías se cargan solo al exportar, para no aumentar la carga inicial.
// Las funciones generar* devuelven un ArrayBuffer (probables en Node);
// descargarArchivo() lo entrega al usuario en el navegador.

import { ESTADOS_EXISTENCIA } from './definiciones.js';
import { describirPeriodo, fechaIso } from '../services/periodo.js';

const EMPRESA = 'Librería Independencia';

// Colores del sistema (index.css) y serie principal de los gráficos.
const COLOR = {
  marino: [25, 36, 70],
  tinta: [23, 33, 59],
  atenuado: [82, 96, 121],
  linea: [220, 226, 236],
  suave: [246, 248, 251],
  serie: [42, 120, 214],
};
const ARGB = { marino: 'FF192446', suave: 'FFF6F8FB', linea: 'FFDCE2EC', blanco: 'FFFFFFFF' };

const fmtEntero = new Intl.NumberFormat('es-SV', { maximumFractionDigits: 0 });
const fmtDinero = new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' });
const fmtFecha = new Intl.DateTimeFormat('es-SV', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtFechaHora = new Intl.DateTimeFormat('es-SV', { dateStyle: 'medium', timeStyle: 'short' });

/** Convierte 'YYYY-MM-DD' o una fecha ISO con hora en un Date (hora local). */
function aFecha(valor) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [a, m, d] = valor.split('-').map(Number);
    return new Date(a, m - 1, d);
  }
  return new Date(valor);
}

/** Texto de presentación de un valor según su tipo (PDF y pantalla). */
export function formatearValor(valor, tipo) {
  if (valor === null || valor === undefined || valor === '') return '-';
  switch (tipo) {
    case 'entero': return typeof valor === 'number' ? fmtEntero.format(valor) : String(valor);
    case 'dinero': return typeof valor === 'number' ? fmtDinero.format(valor) : String(valor);
    case 'fecha': return fmtFecha.format(aFecha(valor));
    case 'estado': return ESTADOS_EXISTENCIA[valor] ?? String(valor);
    default: return String(valor);
  }
}

/** Nombre de archivo: reporte-x_2026-11-01_a_2026-11-30.pdf */
export function nombreArchivo(documento, extension, hoy = new Date()) {
  const periodo = documento.periodo ? `_${documento.periodo.desde}_a_${documento.periodo.hasta}` : `_${fechaIso(hoy)}`;
  return `${documento.archivo}${periodo}.${extension}`;
}

function lineaContexto(documento) {
  return [
    documento.periodo && `Periodo: ${describirPeriodo(documento.periodo)}`,
    documento.filtro && `Filtro: ${documento.filtro}`,
  ].filter(Boolean).join('   ·   ');
}

// ─────────────────────────────────────────────────────────────
// PDF
// ─────────────────────────────────────────────────────────────
export async function generarPdf(documento, { generadoPor = '', generadoEn = new Date() } = {}) {
  const { jsPDF } = await import('jspdf');
  const { autoTable } = await import('jspdf-autotable');

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
  pdf.setProperties({ title: documento.titulo, author: generadoPor, creator: EMPRESA });
  const ancho = pdf.internal.pageSize.getWidth();
  const alto = pdf.internal.pageSize.getHeight();
  const margen = 14;
  const util = ancho - margen * 2;
  const ALTO_FILA = 6.6;

  function encabezado() {
    pdf.setFillColor(...COLOR.marino);
    pdf.rect(0, 0, ancho, 20, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold').setFontSize(13).text(EMPRESA, margen, 9.5);
    pdf.setFont('helvetica', 'normal').setFontSize(8.5).text('Sistema de gestión de inventario', margen, 14.5);
    pdf.setFontSize(8.5);
    pdf.text(`Generado: ${fmtFechaHora.format(generadoEn)}`, ancho - margen, 9.5, { align: 'right' });
    if (generadoPor) pdf.text(`Por: ${generadoPor}`, ancho - margen, 14.5, { align: 'right' });
  }

  function pie(pagina, total) {
    pdf.setDrawColor(...COLOR.linea).setLineWidth(0.2).line(margen, alto - 11, ancho - margen, alto - 11);
    pdf.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...COLOR.atenuado);
    pdf.text(`${documento.titulo} · ${EMPRESA}`, margen, alto - 6.5);
    pdf.text(`Página ${pagina} de ${total}`, ancho - margen, alto - 6.5, { align: 'right' });
  }

  function asegurarEspacio(y, necesario) {
    if (y + necesario <= alto - 16) return y;
    pdf.addPage();
    encabezado();
    return 28;
  }

  encabezado();
  let y = 31;
  pdf.setTextColor(...COLOR.tinta).setFont('helvetica', 'bold').setFontSize(17).text(documento.titulo, margen, y);
  const contexto = lineaContexto(documento);
  if (contexto) {
    y += 6;
    pdf.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(...COLOR.atenuado).text(contexto, margen, y);
  }

  // Indicadores: recuadros de hasta 4 por fila.
  y += 6;
  const porFila = Math.min(4, documento.resumen.length);
  const separacion = 4;
  const anchoCaja = (util - separacion * (porFila - 1)) / porFila;
  documento.resumen.forEach((indicador, i) => {
    const columna = i % porFila;
    if (i > 0 && columna === 0) y += 20;
    const x = margen + columna * (anchoCaja + separacion);
    pdf.setDrawColor(...COLOR.linea).setFillColor(255, 255, 255).setLineWidth(0.3);
    pdf.roundedRect(x, y, anchoCaja, 16, 1.5, 1.5, 'FD');
    pdf.setFont('helvetica', 'normal').setFontSize(7.8).setTextColor(...COLOR.atenuado);
    pdf.text(pdf.splitTextToSize(indicador.etiqueta, anchoCaja - 8)[0], x + 4, y + 5.5);
    pdf.setFont('helvetica', 'bold').setFontSize(13).setTextColor(...COLOR.tinta);
    pdf.text(formatearValor(indicador.valor, indicador.tipo), x + 4, y + 12.5);
  });
  y += 24;

  // Gráficos de barras horizontales (máximo 10 barras, valor al final de cada barra).
  for (const grafico of documento.graficos) {
    const datos = grafico.datos.slice(0, 10);
    if (!datos.length) continue;
    const altoBarra = 4.2;
    const paso = 7;
    y = asegurarEspacio(y, 12 + datos.length * paso);
    pdf.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...COLOR.tinta).text(grafico.titulo, margen, y);
    if (grafico.datos.length > datos.length) {
      pdf.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...COLOR.atenuado)
        .text(`Se muestran los 10 primeros de ${grafico.datos.length}.`, ancho - margen, y, { align: 'right' });
    }
    y += 4;
    const anchoEtiqueta = 62;
    const anchoValor = 28;
    const inicioBarra = margen + anchoEtiqueta;
    const anchoMaximo = util - anchoEtiqueta - anchoValor;
    const maximo = Math.max(...datos.map((d) => d.valor), 0) || 1;

    pdf.setDrawColor(...COLOR.linea).setLineWidth(0.2).line(inicioBarra, y, inicioBarra, y + datos.length * paso);
    datos.forEach((dato, i) => {
      const fila = y + i * paso;
      const largo = Math.max((dato.valor / maximo) * anchoMaximo, dato.valor > 0 ? 0.8 : 0);
      pdf.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...COLOR.tinta);
      pdf.text(pdf.splitTextToSize(dato.etiqueta, anchoEtiqueta - 4)[0], margen, fila + altoBarra);
      if (largo > 0) {
        pdf.setFillColor(...COLOR.serie);
        pdf.roundedRect(inicioBarra, fila + 1, largo, altoBarra, 0.8, 0.8, 'F');
        pdf.rect(inicioBarra, fila + 1, Math.min(1, largo), altoBarra, 'F'); // extremo recto en la base
      }
      pdf.setTextColor(...COLOR.atenuado).text(formatearValor(dato.valor, grafico.formato), inicioBarra + largo + 2, fila + altoBarra);
    });
    y += datos.length * paso + 8;
  }

  // Tablas
  for (const tabla of documento.tablas) {
    // Una tabla corta (hasta 15 filas) no se parte entre páginas; una larga
    // empieza donde quepan al menos el título, el encabezado y 5 filas.
    const filas = Math.max(tabla.filas.length, 1) + (tabla.totales ? 1 : 0);
    y = asegurarEspacio(y, 12 + ALTO_FILA * (filas <= 15 ? filas : 5));
    pdf.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...COLOR.tinta).text(tabla.titulo, margen, y);
    const numericas = Object.fromEntries(tabla.columnas
      .map((c, i) => [i, c.tipo === 'entero' || c.tipo === 'dinero'])
      .filter(([, esNumero]) => esNumero)
      .map(([i]) => [i, { halign: 'right' }]));

    autoTable(pdf, {
      startY: y + 3,
      margin: { left: margen, right: margen, top: 28, bottom: 16 },
      head: [tabla.columnas.map((c) => c.titulo)],
      body: tabla.filas.length
        ? tabla.filas.map((fila) => tabla.columnas.map((c) => formatearValor(fila[c.clave], c.tipo)))
        : [[{ content: 'Sin datos para los criterios seleccionados.', colSpan: tabla.columnas.length, styles: { halign: 'center', textColor: COLOR.atenuado } }]],
      foot: tabla.totales && tabla.filas.length
        ? [tabla.columnas.map((c) => (c.clave in tabla.totales ? formatearValor(tabla.totales[c.clave], c.tipo === 'texto' || c.tipo === 'fecha' ? 'texto' : c.tipo) : ''))]
        : undefined,
      showFoot: 'lastPage',
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8.3, cellPadding: 1.8, textColor: COLOR.tinta, lineColor: COLOR.linea, lineWidth: 0.2 },
      headStyles: { fillColor: COLOR.marino, textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: COLOR.suave, textColor: COLOR.tinta, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: COLOR.suave },
      columnStyles: numericas,
      didParseCell: ({ section, column, cell }) => {
        if (section !== 'body' && numericas[column.index]) cell.styles.halign = 'right';
      },
      willDrawPage: ({ pageNumber }) => { if (pageNumber > 1) encabezado(); },
    });
    y = pdf.lastAutoTable.finalY + 10;
  }

  // El encabezado ya se dibujó al crear cada página; el pie se dibuja al final,
  // cuando ya se conoce el total de páginas.
  const paginas = pdf.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    pdf.setPage(p);
    pie(p, paginas);
  }

  return pdf.output('arraybuffer');
}

// ─────────────────────────────────────────────────────────────
// Excel
// ─────────────────────────────────────────────────────────────
const FORMATO_EXCEL = { entero: '#,##0', dinero: '"$"#,##0.00', fecha: 'dd/mm/yyyy' };

/** Valor nativo para una celda de Excel (números como número, fechas como fecha). */
function valorExcel(valor, tipo) {
  if (valor === null || valor === undefined || valor === '') return null;
  if (tipo === 'entero' || tipo === 'dinero') return typeof valor === 'number' ? valor : String(valor);
  if (tipo === 'fecha') {
    const f = aFecha(valor);
    return new Date(Date.UTC(f.getFullYear(), f.getMonth(), f.getDate()));
  }
  if (tipo === 'estado') return ESTADOS_EXISTENCIA[valor] ?? String(valor);
  return String(valor);
}

/** Nombre de hoja válido para Excel: máximo 31 caracteres y sin : \ / ? * [ ] */
export function nombreHoja(texto, usados = new Set()) {
  const base = texto.replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || 'Hoja';
  let nombre = base;
  for (let n = 2; usados.has(nombre.toLowerCase()); n++) nombre = `${base.slice(0, 31 - String(n).length - 1)} ${n}`;
  usados.add(nombre.toLowerCase());
  return nombre;
}

function estiloEncabezado(fila) {
  fila.font = { bold: true, color: { argb: ARGB.blanco } };
  fila.alignment = { vertical: 'middle' };
  fila.eachCell((celda) => {
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB.marino } };
  });
  fila.height = 20;
}

export async function generarExcel(documento, { generadoPor = '', generadoEn = new Date() } = {}) {
  const { default: ExcelJS } = await import('exceljs');
  const libro = new ExcelJS.Workbook();
  libro.creator = generadoPor || EMPRESA;
  libro.company = EMPRESA;
  libro.title = documento.titulo;
  libro.created = generadoEn;
  const usados = new Set();

  // Hoja de resumen
  const resumen = libro.addWorksheet(nombreHoja('Resumen', usados), { views: [{ showGridLines: false }] });
  resumen.columns = [{ width: 42 }, { width: 22 }];
  resumen.addRow([EMPRESA]).font = { bold: true, size: 11, color: { argb: 'FF526079' } };
  resumen.addRow([documento.titulo]).font = { bold: true, size: 16 };
  const contexto = lineaContexto(documento);
  if (contexto) resumen.addRow([contexto]).font = { color: { argb: 'FF526079' } };
  resumen.addRow([`Generado el ${fmtFechaHora.format(generadoEn)}${generadoPor ? ` por ${generadoPor}` : ''}`]).font = { italic: true, color: { argb: 'FF526079' } };
  resumen.addRow([]);
  estiloEncabezado(resumen.addRow(['Indicador', 'Valor']));
  for (const indicador of documento.resumen) {
    const fila = resumen.addRow([indicador.etiqueta, valorExcel(indicador.valor, indicador.tipo)]);
    fila.getCell(2).numFmt = FORMATO_EXCEL[indicador.tipo];
    fila.getCell(2).font = { bold: true };
  }

  for (const grafico of documento.graficos) {
    resumen.addRow([]);
    resumen.addRow([grafico.titulo]).font = { bold: true, size: 12 };
    estiloEncabezado(resumen.addRow(['Elemento', 'Valor']));
    for (const dato of grafico.datos) {
      resumen.addRow([dato.etiqueta, dato.valor]).getCell(2).numFmt = FORMATO_EXCEL[grafico.formato];
    }
  }

  // Una hoja por tabla
  for (const tabla of documento.tablas) {
    const hoja = libro.addWorksheet(nombreHoja(tabla.titulo, usados), {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    hoja.columns = tabla.columnas.map((c) => ({ header: c.titulo, key: c.clave, width: Math.max(c.ancho ?? 12, c.titulo.length + 2) }));
    estiloEncabezado(hoja.getRow(1));

    for (const fila of tabla.filas) {
      const nueva = hoja.addRow(Object.fromEntries(tabla.columnas.map((c) => [c.clave, valorExcel(fila[c.clave], c.tipo)])));
      tabla.columnas.forEach((c, i) => { if (FORMATO_EXCEL[c.tipo]) nueva.getCell(i + 1).numFmt = FORMATO_EXCEL[c.tipo]; });
    }

    if (tabla.filas.length) {
      hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: tabla.columnas.length } };
    } else {
      hoja.addRow(['Sin datos para los criterios seleccionados.']).font = { italic: true, color: { argb: 'FF526079' } };
    }

    if (tabla.totales && tabla.filas.length) {
      const total = hoja.addRow(Object.fromEntries(tabla.columnas.map((c) => [
        c.clave,
        c.clave in tabla.totales ? (c.tipo === 'fecha' ? String(tabla.totales[c.clave]) : valorExcel(tabla.totales[c.clave], c.tipo)) : null,
      ])));
      total.font = { bold: true };
      total.eachCell({ includeEmpty: true }, (celda, i) => {
        celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB.suave } };
        celda.border = { top: { style: 'thin', color: { argb: ARGB.linea } } };
        const columna = tabla.columnas[i - 1];
        if (columna && FORMATO_EXCEL[columna.tipo] && columna.tipo !== 'fecha') celda.numFmt = FORMATO_EXCEL[columna.tipo];
      });
    }
  }

  return libro.xlsx.writeBuffer();
}

// ─────────────────────────────────────────────────────────────
// Descarga en el navegador
// ─────────────────────────────────────────────────────────────
export const TIPOS_MIME = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export function descargarArchivo(contenido, nombre, extension) {
  const url = URL.createObjectURL(new Blob([contenido], { type: TIPOS_MIME[extension] }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Genera y descarga el reporte; devuelve el nombre del archivo. */
export async function exportarReporte(documento, extension, meta) {
  const contenido = extension === 'pdf' ? await generarPdf(documento, meta) : await generarExcel(documento, meta);
  const nombre = nombreArchivo(documento, extension, meta?.generadoEn);
  descargarArchivo(contenido, nombre, extension);
  return nombre;
}
