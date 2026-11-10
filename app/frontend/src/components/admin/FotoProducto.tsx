'use client';
import { Ico } from '@/components/Ico';
import { useState } from 'react';
import { api, urlServidor } from '@/lib/api';

/** Reduce la foto en el navegador (máx. 800 px, JPEG) para que pese ~100 KB antes de subirla. */
async function reducir(archivo: File) {
  const img = await createImageBitmap(archivo);
  const escala = Math.min(1, 800 / Math.max(img.width, img.height));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(img.width * escala);
  lienzo.height = Math.round(img.height * escala);
  lienzo.getContext('2d')!.drawImage(img, 0, 0, lienzo.width, lienzo.height);
  for (const calidad of [0.82, 0.7, 0.55]) {
    const url = lienzo.toDataURL('image/jpeg', calidad);
    if (url.length * 0.75 < 380_000) return url;
  }
  throw new Error('La foto es demasiado grande incluso reducida.');
}

/** Foto y descripción del plato que ve el comensal en la carta QR. */
export function FotoYDescripcion({
  p,
  guardar,
}: {
  p: { id: string; nombre: string; descripcion: string | null; fotoUrl: string | null };
  guardar: (fn: () => Promise<unknown>, ok: string) => Promise<void>;
}) {
  const [subiendo, setSubiendo] = useState(false);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="font-bold">Foto y descripción en la carta</div>
      <div className="mt-2 flex gap-3">
        {p.fotoUrl ? (
          <img src={`${urlServidor()}${p.fotoUrl}`} alt={p.nombre} className="h-24 w-24 shrink-0 rounded-xl object-cover" />
        ) : (
          <div className="grid h-24 w-24 shrink-0 place-items-center rounded-xl bg-slate-100 text-center text-xs text-slate-500">Sin foto</div>
        )}
        <div className="flex flex-1 flex-col gap-2">
          <label className={`btn-secundario min-h-9 cursor-pointer px-3 text-sm ${subiendo ? 'pointer-events-none opacity-50' : ''}`}>
            <Ico n="camara" /> {subiendo ? 'Subiendo…' : p.fotoUrl ? 'Cambiar foto' : 'Subir foto'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                setSubiendo(true);
                await guardar(async () => api('PATCH', `/admin/productos/${p.id}/foto`, { imagen: await reducir(f) }), `Foto de ${p.nombre} actualizada`);
                setSubiendo(false);
              }}
            />
          </label>
          {p.fotoUrl && (
            <button className="text-left text-xs font-semibold text-red-600" onClick={() => guardar(() => api('PATCH', `/admin/productos/${p.id}/foto`, { imagen: null }), 'Foto quitada')}>
              Quitar foto
            </button>
          )}
        </div>
      </div>
      <textarea
        className="campo mt-2 min-h-16 text-sm"
        maxLength={200}
        placeholder="Ej.: Con papas fritas, ensalada fresca y cremas a elección."
        defaultValue={p.descripcion ?? ''}
        onBlur={(e) => e.target.value.trim() !== (p.descripcion ?? '') && guardar(() => api('PATCH', `/admin/productos/${p.id}`, { descripcion: e.target.value }), 'Descripción guardada')}
      />
    </div>
  );
}
