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
  unidaA: string | null;
  unidas: string[];
}

export interface Delivery {
  cliente: string;
  celular: string;
  direccion: string;
  referencia: string | null;
  pagaCon: number | null;
  estado: 'PENDIENTE' | 'EN_RUTA' | 'ENTREGADO' | 'FALLIDO';
  repartidorId: string | null;
  repartidor: string | null;
  liquidado: boolean;
  destinoFallido: string | null;
}

export interface ItemComanda {
  id: string;
  cantidad: number;
  producto: string;
  destino: string;
  precio: number;
  nota: string | null;
  opciones: { grupo: string; nombre: string }[];
}

export interface Comanda {
  id: string;
  cuentaId: string;
  numero: number;
  canal: 'SALON' | 'LLEVAR' | 'DELIVERY' | 'APP_EXTERNA';
  estado: string;
  origen: string;
  mozo: string;
  nombreCliente: string | null;
  codigoPlataforma: string | null;
  horaProgramada: string | null;
  reposicion: boolean;
  creadoEn: string;
  impresoEn: string | null;
  servidoEn: string | null;
  delivery: Delivery | null;
  items: ItemComanda[];
}

/** Detalle consolidado de una cuenta (mesa, llevar, delivery o app). */
export interface CuentaDetalle {
  cuentaId: string;
  mesaId: string | null;
  mesa: string;
  canal: Comanda['canal'];
  estado: 'ABIERTA' | 'PAGADA' | 'ANULADA';
  total: number;
  saldo: number;
  descuento: number;
  motivoDescuento: string | null;
  pagoEnLinea: boolean;
  pedidos: Comanda[];
  pagos: { medio: string; monto: number; numeroOperacion: string | null; fecha: string }[];
  comprobantes: { id: string; tipo: string; numero: string; total: number; estadoSunat: string; anulado: boolean }[];
}

export const precioItem = (i: ItemCarrito) => (i.producto.precio + i.opciones.reduce((s, o) => s + o.recargo, 0)) * i.cantidad;

export const ESTADO_MESA: Record<Mesa['estado'], { texto: string; icono: string; caja: string; punto: string }> = {
  LIBRE: { texto: 'Libre', icono: '✓', caja: 'border-green-600 bg-green-50 text-green-800', punto: 'bg-green-600' },
  POR_CONFIRMAR: { texto: 'Por confirmar', icono: '⏳', caja: 'border-amber-500 bg-amber-50 text-amber-800', punto: 'bg-amber-500' },
  OCUPADA: { texto: 'Ocupada', icono: '●', caja: 'border-red-600 bg-red-50 text-red-800', punto: 'bg-red-600' },
  CUENTA_SOLICITADA: { texto: 'Pidió la cuenta', icono: '🧾', caja: 'border-blue-600 bg-blue-50 text-blue-800', punto: 'bg-blue-600' },
  POR_LIMPIAR: { texto: 'Por limpiar', icono: '🧹', caja: 'border-slate-500 bg-slate-100 text-slate-700', punto: 'bg-slate-500' },
};

export const CANAL: Record<Comanda['canal'], { texto: string; icono: string; color: string }> = {
  SALON: { texto: 'Salón', icono: '🍽', color: 'bg-red-100 text-red-800' },
  LLEVAR: { texto: 'Para llevar', icono: '🛍', color: 'bg-amber-100 text-amber-800' },
  DELIVERY: { texto: 'Delivery', icono: '🛵', color: 'bg-blue-100 text-blue-800' },
  APP_EXTERNA: { texto: 'App externa', icono: '📲', color: 'bg-purple-100 text-purple-800' },
};

export const MEDIO: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  YAPE: 'Yape',
  PLIN: 'Plin',
  TARJETA: 'Tarjeta',
  PLATAFORMA_EXTERNA: 'Plataforma',
};
