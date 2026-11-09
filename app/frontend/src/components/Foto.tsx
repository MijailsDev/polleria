'use client';
import { useState } from 'react';

/**
 * Imagen con respaldo: si la foto no carga (sin internet en el local o enlace caído),
 * muestra un fondo cálido con la inicial del plato en vez de un recuadro roto.
 */
export function Foto({ src, alt = '', className = '', inicial, prioridad = false }: { src: string; alt?: string; className?: string; inicial?: string; prioridad?: boolean }) {
  const [fallo, setFallo] = useState(false);
  if (fallo)
    return (
      <div aria-hidden={!alt} role={alt ? 'img' : undefined} aria-label={alt || undefined} className={`grid place-items-center bg-gradient-to-br from-brasa-500 to-brasa-800 font-titulo text-4xl text-white/90 ${className}`}>
        {(inicial ?? alt).slice(0, 1).toUpperCase()}
      </div>
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={prioridad ? 'eager' : 'lazy'}
      fetchPriority={prioridad ? 'high' : undefined}
      decoding="async"
      onError={() => setFallo(true)}
      className={`object-cover ${className}`}
    />
  );
}
