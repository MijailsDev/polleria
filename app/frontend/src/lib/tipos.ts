export interface Opcion { id: string; nombre: string; recargo: number; agotado: boolean }
export interface Grupo { id: string; nombre: string; obligatorio: boolean; minimo: number; maximo: number; opciones: Opcion[] }
export interface Producto {
  id: string;
  nombre: string;
  precio: number;
  fraccionPollo: number;
  destino: string;
  fotoUrl: string | null;
  agotado: boolean;
  grupos: Grupo[];
}
export interface Categoria { id: string; nombre: string; productos: Producto[] }

export interface ItemCarrito {
  clave: string;
  producto: Producto;
  cantidad: number;
  opciones: Opcion[];
  nota: string;
}

export interface Mesa {
  id: string;
  numero: string;
  capacidad: number;
  estado: 'LIBRE' | 'POR_CONFIRMAR' | 'OCUPADA' | 'CUENTA_SOLICITADA' | 'POR_LIMPIAR';
  apertura: string | null;
  cuentaId: string | null;
  total: number;
  saldo: number;
  porConfirmar: number;
}

export interface Comanda {
  id: string;
  numero: number;
  canal: string;
  estado: string;
  origen: string;
  mozo: string;
  creadoEn: string;
  impresoEn: string | null;
  servidoEn: string | null;
  items: { cantidad: number; producto: string; destino: string; precio: number; nota: string | null; opciones: { grupo: string; nombre: string }[] }[];
}

export const precioItem = (i: ItemCarrito) => (i.producto.precio + i.opciones.reduce((s, o) => s + o.recargo, 0)) * i.cantidad;

export const ESTADO_MESA: Record<Mesa['estado'], { texto: string; icono: string; caja: string; punto: string }> = {
  LIBRE: { texto: 'Libre', icono: '✓', caja: 'border-green-600 bg-green-50 text-green-800', punto: 'bg-green-600' },
  POR_CONFIRMAR: { texto: 'Por confirmar', icono: '⏳', caja: 'border-amber-500 bg-amber-50 text-amber-800', punto: 'bg-amber-500' },
  OCUPADA: { texto: 'Ocupada', icono: '●', caja: 'border-red-600 bg-red-50 text-red-800', punto: 'bg-red-600' },
  CUENTA_SOLICITADA: { texto: 'Pidió la cuenta', icono: '🧾', caja: 'border-blue-600 bg-blue-50 text-blue-800', punto: 'bg-blue-600' },
  POR_LIMPIAR: { texto: 'Por limpiar', icono: '🧹', caja: 'border-slate-500 bg-slate-100 text-slate-700', punto: 'bg-slate-500' },
};
