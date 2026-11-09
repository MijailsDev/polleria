// Fotos de la marca. Son fotos libres de Unsplash (licencia Unsplash: uso comercial
// permitido, sin pago ni atribución obligatoria) cargadas desde su CDN, que entrega el
// tamaño justo para cada pantalla. Cuando el administrador sube la foto real de un plato
// (Administración → Carta), esa foto tiene prioridad sobre estas.

const CDN = 'https://images.unsplash.com/';

/** Dirección de una foto recortada al ancho pedido (WebP o AVIF si el navegador lo admite). */
export const foto = (id: string, ancho = 800, alto?: number) =>
  `${CDN}${id}?auto=format&fit=crop&w=${ancho}${alto ? `&h=${alto}` : ''}&q=70`;

export const FOTOS = {
  // Comida
  polloAsador: 'photo-1712579733874-c3a79f0f9d12', // pollo girando en el asador
  polloEntero: 'photo-1606728035253-49e8a23146de',
  polloParrilla: 'photo-1630564510761-a560db92a09b',
  fuente: 'photo-1650855543755-f300cd0dff3c', // pollo con guarniciones para compartir
  cuarto: 'photo-1652545296821-09a023a9fd08', // presa dorada en plato blanco
  trozado: 'photo-1574672280600-4accfa5b6f98', // pollo asado trozado
  mostrito: 'photo-1772693471187-6e7d364f99ee', // pollo con arroz
  papas: 'photo-1630384060421-cb20d0e0649d',
  ensalada: 'photo-1568158879083-c42860933ed7',
  aji: 'photo-1612192666309-f2da37265a8a',
  chicha: 'photo-1722239315387-5f12ffdf22c0', // jarra y vaso morados
  gaseosa: 'photo-1700328971815-854758899c06',
  gaseosaGrande: 'photo-1544241907-f3f1f5ded15a',
  mesaFamiliar: 'photo-1746635732995-ab5c6118d5a7',
  // Personal
  mozo: 'photo-1777680174389-e98bc55d8265',
  caja: 'photo-1647427017067-8f33ccbae493',
  cocina: 'photo-1627947063935-55577ec3c2e1',
  reparto: 'photo-1617347454431-f49d7ff5c3b1',
  administracion: 'photo-1765648580890-732fa6d769c5',
  reportes: 'photo-1551288049-bebda4e38f71',
  salon: 'photo-1785204859171-3f4ffa788971',
  pagoPos: 'photo-1556742212-5b321f3c261b',
  atencion: 'photo-1777679883845-6e1b732e2063',
} as const;

const sinTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Foto por defecto de un producto según su nombre (si no tiene foto propia). */
export function fotoDeProducto(nombre: string, categoria = ''): string {
  const n = sinTildes(`${nombre} ${categoria}`);
  if (n.includes('combo') || n.includes('familiar')) return FOTOS.fuente;
  if (n.includes('mostrito') || n.includes('arroz') || n.includes('chaufa')) return FOTOS.mostrito;
  if (n.includes('chicha')) return FOTOS.chicha;
  if (n.includes('1.5') || n.includes('litro')) return FOTOS.gaseosaGrande;
  if (n.includes('gaseosa') || n.includes('bebida') || n.includes('refresco')) return FOTOS.gaseosa;
  if (n.includes('aji') || n.includes('crema') || n.includes('salsa')) return FOTOS.aji;
  if (n.includes('ensalada')) return FOTOS.ensalada;
  if (n.includes('papa')) return FOTOS.papas;
  if (n.includes('entero')) return FOTOS.polloEntero;
  if (n.includes('1/2') || n.includes('medio')) return FOTOS.polloParrilla;
  if (n.includes('1/8')) return FOTOS.trozado;
  if (n.includes('pollo') || n.includes('1/4')) return FOTOS.cuarto;
  return FOTOS.fuente;
}

/** Foto que representa una categoría de la carta. */
export function fotoDeCategoria(nombre: string): string {
  const n = sinTildes(nombre);
  if (n.includes('combo')) return FOTOS.fuente;
  if (n.includes('mostrito')) return FOTOS.mostrito;
  if (n.includes('bebida')) return FOTOS.chicha;
  if (n.includes('extra') || n.includes('guarnic')) return FOTOS.papas;
  if (n.includes('pollo')) return FOTOS.cuarto;
  return FOTOS.fuente;
}
