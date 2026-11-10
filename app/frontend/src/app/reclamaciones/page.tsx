'use client';
import { Logo } from '@/components/Logo';
import { Ico } from '@/components/Ico';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fecha, Hoja, HojaReclamacion, Proveedor } from '@/components/HojaReclamacion';

const VACIO = {
  tipo: 'RECLAMO' as 'RECLAMO' | 'QUEJA',
  nombre: '',
  tipoDocumento: 'DNI' as 'DNI' | 'CE' | 'PAS',
  documento: '',
  domicilio: '',
  celular: '',
  email: '',
  menorDeEdad: false,
  apoderado: '',
  bien: 'PRODUCTO' as 'PRODUCTO' | 'SERVICIO',
  monto: '',
  descripcion: '',
  detalle: '',
  pedido: '',
  aceptaDatos: false,
};

/**
 * Libro de Reclamaciones virtual del local. El consumidor registra su reclamo o queja y recibe
 * el código; la respuesta llega en un plazo máximo de 15 días hábiles.
 */
export default function PaginaReclamaciones() {
  const [proveedor, setProveedor] = useState<Proveedor | null>(null);
  const [modo, setModo] = useState<'nueva' | 'consulta'>('nueva');
  const [d, setD] = useState(VACIO);
  const [hoja, setHoja] = useState<Hoja | null>(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [consulta, setConsulta] = useState({ codigo: '', documento: '' });

  useEffect(() => {
    api<Proveedor>('GET', '/reclamos/proveedor').then(setProveedor).catch(() => {});
  }, []);
  const set = <K extends keyof typeof VACIO>(k: K, v: (typeof VACIO)[K]) => setD((x) => ({ ...x, [k]: v }));

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError('');
    try {
      const h = await api<Hoja>('POST', '/reclamos', { ...d, monto: d.monto === '' ? undefined : Number(d.monto), celular: d.celular || undefined, email: d.email || undefined });
      setHoja(h);
      setD(VACIO);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function consultar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      setHoja(await api<Hoja>('GET', `/reclamos/consulta?codigo=${encodeURIComponent(consulta.codigo)}&documento=${encodeURIComponent(consulta.documento)}`));
    } catch (err: any) {
      setError(err.message);
    }
  }

  const etiqueta = 'mb-1 block text-sm font-semibold';
  return (
    <main className="mx-auto min-h-screen max-w-3xl p-4">
      <Link href="/" className="inline-block">
        <Logo compacto />
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brasa-100 text-3xl text-brasa-800">
          <Ico n="libro" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold">Libro de Reclamaciones</h1>
          <p className="text-sm text-slate-600">
            {proveedor ? `${proveedor.razonSocial} · RUC ${proveedor.ruc}` : ''}
            <br />
            Conforme al Código de Protección y Defensa del Consumidor, este establecimiento cuenta con un Libro de Reclamaciones a tu disposición.
          </p>
        </div>
      </div>

      <div className="no-imprimir my-4 flex gap-2">
        <button className={modo === 'nueva' ? 'chip-on' : 'chip-off'} onClick={() => (setModo('nueva'), setHoja(null), setError(''))}>
          Registrar reclamo o queja
        </button>
        <button className={modo === 'consulta' ? 'chip-on' : 'chip-off'} onClick={() => (setModo('consulta'), setHoja(null), setError(''))}>
          Consultar mi hoja
        </button>
      </div>

      {hoja ? (
        <div className="space-y-3">
          {modo === 'nueva' && (
            <div className="rounded-xl bg-green-100 p-4 text-green-900">
              <b>Tu {hoja.tipo === 'QUEJA' ? 'queja' : 'reclamo'} quedó registrado con el código {hoja.codigo}.</b> Guárdalo para consultar la respuesta. Te responderemos hasta el {fecha(hoja.plazo)}
              {hoja.consumidor.celular ? ' y te avisaremos por WhatsApp.' : '.'}
            </div>
          )}
          <HojaReclamacion h={hoja} />
          <div className="no-imprimir flex gap-2">
            <button className="btn-secundario" onClick={() => window.print()}>
              <Ico n="descarga" /> Guardar copia (PDF)
            </button>
            <button className="btn-primario" onClick={() => setHoja(null)}>
              Listo
            </button>
          </div>
        </div>
      ) : modo === 'consulta' ? (
        <form className="tarjeta space-y-3 p-5" onSubmit={consultar}>
          <div>
            <label className={etiqueta}>Código de la hoja</label>
            <input className="campo uppercase" placeholder="LR-2026-000001" value={consulta.codigo} onChange={(e) => setConsulta((c) => ({ ...c, codigo: e.target.value }))} required />
          </div>
          <div>
            <label className={etiqueta}>Tu número de documento</label>
            <input className="campo" value={consulta.documento} onChange={(e) => setConsulta((c) => ({ ...c, documento: e.target.value }))} required />
          </div>
          {error && <p className="font-semibold text-red-600">{error}</p>}
          <button className="btn-primario">Consultar</button>
        </form>
      ) : (
        <form className="tarjeta space-y-5 p-5" onSubmit={enviar}>
          <fieldset className="space-y-3">
            <legend className="mb-2 font-bold">1. Tus datos</legend>
            <div>
              <label className={etiqueta}>Nombre completo *</label>
              <input className="campo" value={d.nombre} onChange={(e) => set('nombre', e.target.value)} required maxLength={120} autoComplete="name" />
            </div>
            <div className="grid grid-cols-[120px_1fr] gap-2">
              <div>
                <label className={etiqueta}>Documento *</label>
                <select className="campo" value={d.tipoDocumento} onChange={(e) => set('tipoDocumento', e.target.value as typeof d.tipoDocumento)}>
                  <option value="DNI">DNI</option>
                  <option value="CE">Carné de extranjería</option>
                  <option value="PAS">Pasaporte</option>
                </select>
              </div>
              <div>
                <label className={etiqueta}>Número *</label>
                <input className="campo" value={d.documento} onChange={(e) => set('documento', e.target.value.trim())} required maxLength={12} inputMode={d.tipoDocumento === 'DNI' ? 'numeric' : 'text'} />
              </div>
            </div>
            <div>
              <label className={etiqueta}>Domicilio *</label>
              <input className="campo" value={d.domicilio} onChange={(e) => set('domicilio', e.target.value)} required maxLength={200} autoComplete="street-address" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className={etiqueta}>Celular</label>
                <input className="campo" inputMode="numeric" maxLength={9} placeholder="987654321" value={d.celular} onChange={(e) => set('celular', e.target.value.replace(/\D/g, ''))} autoComplete="tel-national" />
              </div>
              <div>
                <label className={etiqueta}>Correo</label>
                <input className="campo" type="email" value={d.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" />
              </div>
            </div>
            <p className="text-xs text-slate-500">Deja al menos un celular o un correo para enviarte la respuesta.</p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-5 w-5" checked={d.menorDeEdad} onChange={(e) => set('menorDeEdad', e.target.checked)} />
              Soy menor de edad
            </label>
            {d.menorDeEdad && (
              <div>
                <label className={etiqueta}>Nombre del padre, madre o apoderado *</label>
                <input className="campo" value={d.apoderado} onChange={(e) => set('apoderado', e.target.value)} required maxLength={120} />
              </div>
            )}
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="mb-2 font-bold">2. ¿Sobre qué es?</legend>
            <div className="flex gap-2">
              {(['PRODUCTO', 'SERVICIO'] as const).map((b) => (
                <button type="button" key={b} className={d.bien === b ? 'chip-on' : 'chip-off'} onClick={() => set('bien', b)}>
                  {b === 'PRODUCTO' ? 'Un producto (comida, bebida)' : 'El servicio (atención, delivery)'}
                </button>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
              <div>
                <label className={etiqueta}>Descripción *</label>
                <input className="campo" placeholder="Ej.: 1/4 de pollo para llevar, boleta B001-000021" value={d.descripcion} onChange={(e) => set('descripcion', e.target.value)} required maxLength={250} />
              </div>
              <div>
                <label className={etiqueta}>Monto (S/)</label>
                <input className="campo" inputMode="decimal" value={d.monto} onChange={(e) => set('monto', e.target.value)} />
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="mb-2 font-bold">3. Detalle</legend>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={d.tipo === 'RECLAMO' ? 'chip-on' : 'chip-off'} onClick={() => set('tipo', 'RECLAMO')}>
                Reclamo
              </button>
              <button type="button" className={d.tipo === 'QUEJA' ? 'chip-on' : 'chip-off'} onClick={() => set('tipo', 'QUEJA')}>
                Queja
              </button>
            </div>
            <p className="text-xs text-slate-500">
              <b>Reclamo:</b> no estás conforme con el producto o servicio. <b>Queja:</b> malestar con la atención, sin relación directa con lo que compraste.
            </p>
            <div>
              <label className={etiqueta}>¿Qué pasó? *</label>
              <textarea className="campo min-h-24" value={d.detalle} onChange={(e) => set('detalle', e.target.value)} required maxLength={3000} />
            </div>
            <div>
              <label className={etiqueta}>¿Qué solicitas? *</label>
              <textarea className="campo min-h-20" value={d.pedido} onChange={(e) => set('pedido', e.target.value)} required maxLength={2000} />
            </div>
          </fieldset>

          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={d.aceptaDatos} onChange={(e) => set('aceptaDatos', e.target.checked)} />
            <span>
              Autorizo el uso de mis datos personales solo para atender esta reclamación, según la{' '}
              <Link className="text-blue-700 underline" href="/privacidad" target="_blank">
                política de privacidad
              </Link>{' '}
              (Ley 29733).
            </span>
          </label>
          {error && <p className="font-semibold text-red-600">{error}</p>}
          <button className="btn-primario w-full" disabled={enviando || !d.aceptaDatos}>
            {enviando ? 'Registrando…' : 'Registrar hoja de reclamación'}
          </button>
          <p className="text-xs text-slate-500">
            La formulación del reclamo no impide acudir a otras vías de solución de controversias ni es requisito previo para interponer una denuncia ante el INDECOPI. El proveedor responderá en un plazo no mayor a quince (15) días hábiles.
          </p>
        </form>
      )}
    </main>
  );
}
