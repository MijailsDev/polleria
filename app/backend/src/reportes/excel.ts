// Exportación del reporte del dueño a Excel (.xlsx) con una hoja por sección (REQ-REP-06).
import ExcelJS from 'exceljs';
import { ReportesService } from './reportes.service';

type Reporte = Awaited<ReturnType<ReportesService['generar']>>;
type Columna = { titulo: string; clave: string; ancho?: number; formato?: 'soles' | 'numero' | 'fecha' | 'minutos' };

const NARANJA = 'FFE8590C';
const MEDIO: Record<string, string> = { EFECTIVO: 'Efectivo', YAPE: 'Yape', PLIN: 'Plin', TARJETA: 'Tarjeta', PLATAFORMA_EXTERNA: 'Apps (prepagado)' };
const CANAL: Record<string, string> = { SALON: 'Salón', LLEVAR: 'Para llevar', DELIVERY: 'Delivery', APP_EXTERNA: 'Apps' };

function hoja(libro: ExcelJS.Workbook, nombre: string, titulo: string, columnas: Columna[], filas: Record<string, unknown>[], totales?: string[]) {
  const h = libro.addWorksheet(nombre, { views: [{ state: 'frozen', ySplit: 3 }] });
  h.mergeCells(1, 1, 1, columnas.length);
  h.getCell(1, 1).value = titulo;
  h.getCell(1, 1).font = { bold: true, size: 14 };
  h.columns = columnas.map((c) => ({ key: c.clave, width: c.ancho ?? 16 }));
  const cab = h.getRow(3);
  columnas.forEach((c, i) => {
    const celda = cab.getCell(i + 1);
    celda.value = c.titulo;
    celda.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NARANJA } };
    celda.alignment = { vertical: 'middle', wrapText: true };
  });
  filas.forEach((f, i) => {
    const r = h.getRow(4 + i);
    columnas.forEach((c, j) => {
      const v = f[c.clave];
      const celda = r.getCell(j + 1);
      celda.value = c.formato === 'fecha' && v ? new Date(v as string) : (v as ExcelJS.CellValue) ?? null;
      if (c.formato === 'soles') celda.numFmt = '"S/" #,##0.00';
      if (c.formato === 'minutos') celda.numFmt = '0.0 "min"';
      if (c.formato === 'fecha') celda.numFmt = 'dd/mm/yyyy hh:mm';
    });
  });
  if (totales?.length && filas.length) {
    const r = h.getRow(4 + filas.length);
    r.getCell(1).value = 'TOTAL';
    r.font = { bold: true };
    columnas.forEach((c, j) => {
      if (!totales.includes(c.clave)) return;
      const letra = h.getColumn(j + 1).letter;
      r.getCell(j + 1).value = { formula: `SUM(${letra}4:${letra}${3 + filas.length})` };
      if (c.formato === 'soles') r.getCell(j + 1).numFmt = '"S/" #,##0.00';
    });
  }
  return h;
}

export async function reporteExcel(r: Reporte, razonSocial: string) {
  const libro = new ExcelJS.Workbook();
  libro.creator = 'Sistema para Pollerías';
  libro.created = new Date();
  const periodo = r.desde === r.hasta ? r.desde : `${r.desde} al ${r.hasta}`;

  const res = libro.addWorksheet('Resumen');
  res.columns = [{ width: 28 }, { width: 18 }];
  res.addRow([`${razonSocial} · Reporte del ${periodo}`]).font = { bold: true, size: 14 };
  res.addRow([]);
  const filasResumen: [string, number, boolean][] = [
    ['Ventas', r.resumen.ventas, true],
    ['Notas de crédito', r.resumen.notasCredito, true],
    ['Ventas netas', r.resumen.ventasNetas, true],
    ['Cuentas cobradas', r.resumen.cuentas, false],
    ['Ticket promedio', r.resumen.ticketPromedio, true],
    ['Pedidos', r.resumen.pedidos, false],
    ['Propinas (pago en línea)', r.resumen.propinas, true],
    ['Calificación promedio (1 a 5)', r.calificaciones.promedio ?? 0, false],
  ];
  for (const [k, v, soles] of filasResumen) {
    const fila = res.addRow([k, v]);
    fila.getCell(1).font = { bold: true };
    if (soles) fila.getCell(2).numFmt = '"S/" #,##0.00';
  }

  hoja(libro, 'Ventas por día', `Ventas por día · ${periodo}`, [
    { titulo: 'Día', clave: 'dia', ancho: 14 },
    { titulo: 'Cuentas', clave: 'cuentas', ancho: 12 },
    { titulo: 'Total', clave: 'total', formato: 'soles' },
  ], r.porDia, ['cuentas', 'total']);
  hoja(libro, 'Medios de pago', `Ventas por medio de pago · ${periodo}`, [
    { titulo: 'Medio', clave: 'medio', ancho: 20 },
    { titulo: 'Pagos', clave: 'pagos', ancho: 10 },
    { titulo: 'Total', clave: 'total', formato: 'soles' },
  ], r.porMedio.map((x) => ({ ...x, medio: MEDIO[x.medio as string] ?? x.medio })), ['pagos', 'total']);
  hoja(libro, 'Canales', `Ventas por canal · ${periodo}`, [
    { titulo: 'Canal', clave: 'canal', ancho: 18 },
    { titulo: 'Total', clave: 'total', formato: 'soles' },
  ], r.porCanal.map((x) => ({ ...x, canal: CANAL[x.canal as string] ?? x.canal })), ['total']);
  hoja(libro, 'Cajeros', `Cobros por cajero · ${periodo}`, [
    { titulo: 'Cajero', clave: 'cajero', ancho: 24 },
    { titulo: 'Pagos', clave: 'pagos', ancho: 10 },
    { titulo: 'Total', clave: 'total', formato: 'soles' },
  ], r.porCajero, ['pagos', 'total']);
  hoja(libro, 'Mozos', `Ventas de salón por mozo · ${periodo}`, [
    { titulo: 'Mozo', clave: 'mozo', ancho: 24 },
    { titulo: 'Pedidos', clave: 'pedidos', ancho: 10 },
    { titulo: 'Total', clave: 'total', formato: 'soles' },
  ], r.porMozo, ['pedidos', 'total']);
  hoja(libro, 'Productos', `Productos más vendidos · ${periodo}`, [
    { titulo: 'Producto', clave: 'producto', ancho: 40 },
    { titulo: 'Cantidad', clave: 'cantidad', ancho: 10 },
    { titulo: 'Total', clave: 'total', formato: 'soles' },
  ], r.productos, ['cantidad', 'total']);
  hoja(libro, 'Presas', `Pecho vs. pierna · ${periodo}`, [
    { titulo: 'Presa', clave: 'presa', ancho: 26 },
    { titulo: 'Cantidad', clave: 'cantidad', ancho: 10 },
  ], r.presas, ['cantidad']);
  hoja(libro, 'Horas punta', `Pedidos por hora · ${periodo}`, [
    { titulo: 'Hora', clave: 'hora', ancho: 8 },
    { titulo: 'Pedidos', clave: 'pedidos', ancho: 10 },
    { titulo: 'Total', clave: 'total', formato: 'soles' },
  ], r.franjas, ['pedidos', 'total']);
  hoja(libro, 'Tiempos', `Tiempos de atención (minutos) · ${periodo}`, [
    { titulo: 'Hora', clave: 'hora', ancho: 8 },
    { titulo: 'Pedidos', clave: 'pedidos', ancho: 10 },
    { titulo: 'Espera a cocina', clave: 'esperaProm', formato: 'minutos' },
    { titulo: 'Preparación prom.', clave: 'prepProm', formato: 'minutos' },
    { titulo: 'Preparación máx.', clave: 'prepMax', formato: 'minutos' },
    { titulo: 'Total prom.', clave: 'totalProm', formato: 'minutos' },
    { titulo: 'Total máx.', clave: 'totalMax', formato: 'minutos' },
  ], r.tiempos);
  hoja(libro, 'Notas de crédito', `Notas de crédito · ${periodo}`, [
    { titulo: 'Número', clave: 'numero', ancho: 14 },
    { titulo: 'Anula', clave: 'anula', ancho: 14 },
    { titulo: 'Total', clave: 'total', formato: 'soles' },
    { titulo: 'Motivo', clave: 'motivo', ancho: 36 },
    { titulo: 'Fecha', clave: 'fecha', formato: 'fecha', ancho: 18 },
  ], r.notasCredito, ['total']);
  hoja(libro, 'Mermas', `Mermas y reposiciones · ${periodo}`, [
    { titulo: 'Fecha', clave: 'fecha', formato: 'fecha', ancho: 18 },
    { titulo: 'Tipo', clave: 'tipo', ancho: 12 },
    { titulo: 'Pollos', clave: 'pollos', ancho: 10 },
    { titulo: 'Cuartos pecho', clave: 'pecho', ancho: 12 },
    { titulo: 'Cuartos pierna', clave: 'pierna', ancho: 12 },
    { titulo: 'Motivo', clave: 'motivo', ancho: 36 },
    { titulo: 'Autorizó', clave: 'autorizo', ancho: 22 },
  ], r.mermas, ['pollos', 'pecho', 'pierna']);
  hoja(libro, 'Eventos sensibles', `Anulaciones, descuentos y otros eventos · ${periodo}`, [
    { titulo: 'Fecha', clave: 'fecha', formato: 'fecha', ancho: 18 },
    { titulo: 'Acción', clave: 'accion', ancho: 22 },
    { titulo: 'Solicitó', clave: 'solicito', ancho: 22 },
    { titulo: 'Autorizó', clave: 'autorizo', ancho: 22 },
    { titulo: 'Detalle', clave: 'texto', ancho: 60 },
  ], r.eventos.map((e) => ({ ...e, texto: Object.entries(e.detalle).filter(([k]) => k !== 'autorizadoPor').map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ') })));
  hoja(libro, 'Arqueos', `Cierres de caja · ${periodo}`, [
    { titulo: 'Cajero', clave: 'cajero', ancho: 22 },
    { titulo: 'Apertura', clave: 'apertura', formato: 'fecha', ancho: 18 },
    { titulo: 'Cierre', clave: 'cierre', formato: 'fecha', ancho: 18 },
    { titulo: 'Declarado', clave: 'declarado', formato: 'soles' },
    { titulo: 'Diferencia', clave: 'diferencia', formato: 'soles' },
    { titulo: 'Comentario', clave: 'comentario', ancho: 36 },
  ], r.arqueos, ['diferencia']);

  hoja(libro, 'Calificaciones', `Comentarios de los comensales · ${periodo}`, [
    { titulo: 'Fecha', clave: 'fecha', formato: 'fecha', ancho: 18 },
    { titulo: 'Mesa', clave: 'mesa', ancho: 10 },
    { titulo: 'Estrellas', clave: 'estrellas', ancho: 10 },
    { titulo: 'Comentario', clave: 'comentario', ancho: 60 },
  ], r.calificaciones.comentarios);

  return Buffer.from(await libro.xlsx.writeBuffer());
}
