'use client';
import { soles } from '@/lib/util';

export interface Proveedor { razonSocial: string; ruc: string; direccion: string }
export interface Hoja {
  id: string;
  codigo: string;
  fecha: string;
  proveedor: Proveedor;
  tipo: 'RECLAMO' | 'QUEJA';
  consumidor: { nombre: string; tipoDocumento: string; documento: string; domicilio: string; celular: string | null; email: string | null; menorDeEdad: boolean; apoderado: string | null };
  bien: 'PRODUCTO' | 'SERVICIO';
  monto: number | null;
  descripcion: string;
  detalle: string;
  pedido: string;
  estado: 'PENDIENTE' | 'RESPONDIDO';
  respuesta: string | null;
  respondidoEn: string | null;
  plazo: string;
}

export const fecha = (d: string) => new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });

/** Hoja de reclamación con el formato del Libro de Reclamaciones (Anexo I del reglamento). */
export function HojaReclamacion({ h }: { h: Hoja }) {
  const fila = (k: string, v: React.ReactNode) => (
    <div className="grid grid-cols-[150px_1fr] gap-2 border-b border-slate-100 py-1 text-sm">
      <span className="font-semibold text-slate-600">{k}</span>
      <span className="break-words">{v || '—'}</span>
    </div>
  );
  return (
    <div className="tarjeta p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2 border-b-2 border-slate-900 pb-2">
        <div>
          <div className="text-lg font-black">LIBRO DE RECLAMACIONES</div>
          <div className="text-sm">Hoja de reclamación N.° {h.codigo}</div>
        </div>
        <div className="text-right text-sm">
          <div>Fecha: {fecha(h.fecha)}</div>
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${h.estado === 'RESPONDIDO' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900'}`}>{h.estado === 'RESPONDIDO' ? 'Respondido' : `Respuesta hasta el ${fecha(h.plazo)}`}</span>
        </div>
      </div>
      <h3 className="mb-1 text-xs font-bold uppercase text-slate-500">Proveedor</h3>
      {fila('Razón social', h.proveedor.razonSocial)}
      {fila('RUC', h.proveedor.ruc)}
      {fila('Dirección', h.proveedor.direccion)}
      <h3 className="mb-1 mt-3 text-xs font-bold uppercase text-slate-500">1. Identificación del consumidor</h3>
      {fila('Nombre', h.consumidor.nombre)}
      {fila(h.consumidor.tipoDocumento, h.consumidor.documento)}
      {fila('Domicilio', h.consumidor.domicilio)}
      {fila('Celular / correo', [h.consumidor.celular, h.consumidor.email].filter(Boolean).join(' · '))}
      {h.consumidor.menorDeEdad && fila('Padre, madre o apoderado', h.consumidor.apoderado)}
      <h3 className="mb-1 mt-3 text-xs font-bold uppercase text-slate-500">2. Identificación del bien contratado</h3>
      {fila('Tipo', h.bien === 'PRODUCTO' ? 'Producto' : 'Servicio')}
      {fila('Monto reclamado', h.monto !== null ? soles(h.monto) : null)}
      {fila('Descripción', h.descripcion)}
      <h3 className="mb-1 mt-3 text-xs font-bold uppercase text-slate-500">3. Detalle de la reclamación</h3>
      {fila('Tipo', h.tipo === 'RECLAMO' ? 'Reclamo: disconformidad con el producto o servicio' : 'Queja: malestar por la atención')}
      {fila('Detalle', h.detalle)}
      {fila('Pedido del consumidor', h.pedido)}
      <h3 className="mb-1 mt-3 text-xs font-bold uppercase text-slate-500">4. Observaciones y acciones del proveedor</h3>
      {fila('Respuesta', h.respuesta)}
      {h.respondidoEn && fila('Fecha de respuesta', fecha(h.respondidoEn))}
    </div>
  );
}

