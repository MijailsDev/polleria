// Íconos de línea (SVG) para botones y avisos, en lugar de emojis: se ven iguales en
// cualquier celular, toman el color del texto y escalan con el tamaño de letra.
type P = { className?: string };
const base = (className = 'h-5 w-5') => ({ className, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true });

export const Campana = ({ className }: P) => (
  <svg {...base(className)}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></svg>
);
export const Recibo = ({ className }: P) => (
  <svg {...base(className)}><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" /><path d="M16 8H8M16 12H8M13 16H8" /></svg>
);
export const Lupa = ({ className }: P) => (
  <svg {...base(className)}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
);
export const Estrella = ({ className, llena = false }: P & { llena?: boolean }) => (
  <svg {...base(className)} fill={llena ? 'currentColor' : 'none'}><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1Z" /></svg>
);
export const Repetir = ({ className }: P) => (
  <svg {...base(className)}><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" /><path d="M3 21v-5h5" /></svg>
);
export const Lapiz = ({ className }: P) => (
  <svg {...base(className)}><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
);
export const Libro = ({ className }: P) => (
  <svg {...base(className)}><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /></svg>
);
export const Mas = ({ className }: P) => (
  <svg {...base(className)} strokeWidth={2.5}><path d="M12 5v14M5 12h14" /></svg>
);
export const Reloj = ({ className }: P) => (
  <svg {...base(className)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
export const Ubicacion = ({ className }: P) => (
  <svg {...base(className)}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
);
export const Celular = ({ className }: P) => (
  <svg {...base(className)}><rect x="6" y="2" width="12" height="20" rx="2" /><path d="M11 18h2" /></svg>
);
export const Check = ({ className }: P) => (
  <svg {...base(className)} strokeWidth={2.5}><path d="M20 6 9 17l-5-5" /></svg>
);
export const Flecha = ({ className }: P) => (
  <svg {...base(className)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
