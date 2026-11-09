/**
 * Logo de «La Brasa Dorada»: emblema con la llama de la brasa y el nombre.
 * Es un dibujo vectorial (SVG): se ve nítido en cualquier tamaño y no depende de internet.
 */
export function Emblema({ className = 'h-10 w-10' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="La Brasa Dorada">
      <circle cx="32" cy="32" r="31" fill="#7c2d12" />
      <circle cx="32" cy="32" r="27" fill="none" stroke="#fbbf24" strokeWidth="2" />
      {/* Llama */}
      <path d="M32 12c2 8 11 11 11 22a11 11 0 0 1-22 0c0-6 3-9 5-12 1 4 3 6 5 6-1-6 0-11 1-16z" fill="#f97316" />
      <path d="M32 26c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-7 1 2 2 3 3 3 0-3 0-5 0-7z" fill="#fbbf24" />
      {/* Brasas */}
      <path d="M17 48h30" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" />
      <path d="M22 53h20" stroke="#f97316" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ claro = false, compacto = false, className = '' }: { claro?: boolean; compacto?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Emblema className={compacto ? 'h-8 w-8 shrink-0' : 'h-11 w-11 shrink-0'} />
      <span className="leading-none">
        <span className={`block font-titulo uppercase tracking-wide ${compacto ? 'text-lg' : 'text-2xl'} ${claro ? 'text-white' : 'text-brasa-800'}`}>La Brasa Dorada</span>
        {!compacto && <span className={`mt-1 block text-xs font-semibold uppercase tracking-[0.2em] max-[359px]:hidden ${claro ? 'text-amber-200' : 'text-brasa-700'}`}>Pollería a la brasa</span>}
      </span>
    </span>
  );
}
