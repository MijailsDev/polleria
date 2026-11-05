// Proveedores de facturación electrónica (OSE/PSE) y de consulta de DNI/RUC.
// En desarrollo se usan las versiones simuladas; con las variables de entorno de cada
// servicio se activa el proveedor real sin cambiar el resto del sistema.
import { randomInt } from 'crypto';
import { CODIGO_TIPO, DocumentoCpe, NOMBRE_TIPO, hashXml, rucValido, xmlUbl } from './cpe';

export interface RespuestaCpe {
  aceptado: boolean;
  codigo: string;
  mensaje: string;
  hash: string | null;
}

export interface ResumenDiarioCpe {
  identificador: string;
  fecha: string;
  boletas: { serie: string; correlativo: number; total: number; estado: 'ADICIONAR' | 'ANULAR' }[];
}

export interface ProveedorCpe {
  readonly nombre: string;
  readonly simulado: boolean;
  enviar(doc: DocumentoCpe): Promise<RespuestaCpe>;
  enviarResumen(r: ResumenDiarioCpe): Promise<{ ticket: string }>;
  consultarTicket(ticket: string): Promise<RespuestaCpe>;
}

const espera = (min: number, max: number) => new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));

/**
 * OSE simulado: genera el XML UBL, calcula el resumen (hash) y aplica las validaciones
 * principales de SUNAT, con la demora de una conexión real.
 */
export class OseSimulado implements ProveedorCpe {
  readonly nombre = 'OSE simulado';
  readonly simulado = true;

  async enviar(d: DocumentoCpe): Promise<RespuestaCpe> {
    await espera(250, 900);
    const id = `${d.serie}-${d.correlativo}`;
    const rechazo = (codigo: string, mensaje: string) => ({ aceptado: false, codigo, mensaje: `${mensaje} (${NOMBRE_TIPO[d.tipo]} ${id})`, hash: null });
    if (d.tipo === 'FACTURA' && !rucValido(d.cliente.numero)) return rechazo('2017', 'El número de RUC del receptor no es válido');
    if (d.total <= 0) return rechazo('2638', 'El total del comprobante debe ser mayor a cero');
    if (Math.abs(d.base + d.impuesto + d.icbper - d.total) > 0.001) return rechazo('3279', 'El total no coincide con la suma de la base y los impuestos');
    if (d.tipo === 'NOTA_CREDITO' && !d.referencia) return rechazo('2524', 'La nota de crédito debe indicar el comprobante que modifica');
    return { aceptado: true, codigo: '0', mensaje: `La ${NOMBRE_TIPO[d.tipo]} numero ${id}, ha sido aceptada`, hash: hashXml(xmlUbl(d)) };
  }

  async enviarResumen(r: ResumenDiarioCpe) {
    await espera(300, 800);
    return { ticket: `${Date.now()}${randomInt(100, 999)}` };
  }

  async consultarTicket(ticket: string): Promise<RespuestaCpe> {
    await espera(200, 600);
    return { aceptado: true, codigo: '0', mensaje: `El Resumen diario con ticket ${ticket}, ha sido aceptado`, hash: null };
  }
}

/**
 * Nubefact (PSE/OSE). Se activa con NUBEFACT_RUTA y NUBEFACT_TOKEN (datos de la cuenta).
 * Formato JSON de su API «generar_comprobante». Listo para conectar; requiere una cuenta
 * de Nubefact y el RUC dado de alta como emisor electrónico para probarlo de verdad.
 */
export class Nubefact implements ProveedorCpe {
  readonly nombre = 'Nubefact';
  readonly simulado = false;
  constructor(private ruta: string, private token: string) {}

  private async llamar(cuerpo: unknown) {
    const r = await fetch(this.ruta, {
      method: 'POST',
      headers: { Authorization: `Token token="${this.token}"`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(15_000),
    });
    const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!r.ok && !j.errors) throw new Error(`Nubefact respondió HTTP ${r.status}`);
    return j;
  }

  async enviar(d: DocumentoCpe): Promise<RespuestaCpe> {
    const fecha = d.emitidoEn.toLocaleDateString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
    const j = await this.llamar({
      operacion: 'generar_comprobante',
      tipo_de_comprobante: d.tipo === 'FACTURA' ? 1 : d.tipo === 'BOLETA' ? 2 : 3,
      serie: d.serie,
      numero: d.correlativo,
      sunat_transaction: 1,
      cliente_tipo_de_documento: d.cliente.tipoDocumento === '0' ? '-' : d.cliente.tipoDocumento,
      cliente_numero_de_documento: d.cliente.numero,
      cliente_denominacion: d.cliente.nombre,
      cliente_direccion: '',
      fecha_de_emision: fecha,
      moneda: 1,
      porcentaje_de_igv: d.tasa * 100,
      descuento_global: d.descuentoBase || '',
      total_gravada: d.base,
      total_igv: d.impuesto,
      total_impuestos_bolsas: d.icbper || '',
      total: d.total,
      enviar_automaticamente_a_la_sunat: true,
      enviar_automaticamente_al_cliente: false,
      documento_que_se_modifica_tipo: d.referencia ? (d.referencia.tipo === 'FACTURA' ? 1 : 2) : '',
      documento_que_se_modifica_serie: d.referencia?.serie ?? '',
      documento_que_se_modifica_numero: d.referencia?.correlativo ?? '',
      tipo_de_nota_de_credito: d.referencia ? 1 : '',
      items: d.lineas.map((l) => ({
        unidad_de_medida: 'NIU',
        descripcion: l.descripcion,
        cantidad: l.cantidad,
        valor_unitario: +(l.base / l.cantidad).toFixed(10),
        precio_unitario: +(l.importe / l.cantidad).toFixed(10),
        subtotal: l.base,
        tipo_de_igv: 1,
        igv: l.impuesto,
        total: l.importe,
        anticipo_regularizacion: false,
      })),
    });
    if (j.errors) return { aceptado: false, codigo: String(j.codigo ?? 'NF'), mensaje: String(j.errors), hash: null };
    return {
      aceptado: j.aceptada_por_sunat === true,
      codigo: String(j.sunat_responsecode ?? (j.aceptada_por_sunat ? '0' : 'PEND')),
      mensaje: String(j.sunat_description ?? 'Recibido por Nubefact'),
      hash: (j.codigo_hash as string) ?? null,
    };
  }

  async enviarResumen(): Promise<{ ticket: string }> {
    // Nubefact arma y envía el resumen diario de boletas por su cuenta
    return { ticket: 'NUBEFACT-AUTOMATICO' };
  }

  async consultarTicket(ticket: string): Promise<RespuestaCpe> {
    return { aceptado: true, codigo: '0', mensaje: `Resumen gestionado por Nubefact (${ticket})`, hash: null };
  }
}

export function crearProveedorCpe(): ProveedorCpe {
  const { NUBEFACT_RUTA, NUBEFACT_TOKEN } = process.env;
  return NUBEFACT_RUTA && NUBEFACT_TOKEN ? new Nubefact(NUBEFACT_RUTA, NUBEFACT_TOKEN) : new OseSimulado();
}

// ---------------------------------------------------------------- Consulta de DNI y RUC

export interface DatosDocumento {
  tipo: 'DNI' | 'RUC';
  numero: string;
  nombre: string;
  direccion?: string;
  estado?: string;
  condicion?: string;
}

export interface ProveedorDocumentos {
  readonly nombre: string;
  consultar(numero: string): Promise<DatosDocumento | null>;
}

const NOMBRES = ['JUAN CARLOS', 'MARÍA ELENA', 'LUIS ALBERTO', 'ROSA ISABEL', 'JORGE LUIS', 'CARMEN ROSA', 'PEDRO PABLO', 'ANA LUCÍA', 'MIGUEL ÁNGEL', 'LUZ MARINA', 'JOSÉ ANTONIO', 'GLADYS', 'CÉSAR AUGUSTO', 'YOLANDA', 'WILBER', 'MILAGROS'];
const APELLIDOS = ['QUISPE', 'MAMANI', 'HUAMÁN', 'FLORES', 'RODRÍGUEZ', 'SÁNCHEZ', 'GARCÍA', 'ROJAS', 'TORRES', 'CHÁVEZ', 'RAMÍREZ', 'VARGAS', 'CASTILLO', 'MENDOZA', 'CONDORI', 'CCAHUANA', 'APAZA', 'PAREDES'];
const RUBROS = ['INVERSIONES', 'CORPORACIÓN', 'NEGOCIACIONES', 'DISTRIBUIDORA', 'SERVICIOS GENERALES', 'COMERCIAL', 'CONSTRUCTORA', 'TRANSPORTES'];
const MARCAS = ['AMAZÓNICA', 'MADRE DE DIOS', 'TAMBOPATA', 'LOS ANDES', 'DEL SUR', 'SAN MARTÍN', 'EL DORADO', 'INAMBARI'];
const CALLES = ['Jr. Loreto', 'Av. Ernesto Rivero', 'Jr. Cusco', 'Av. Dos de Mayo', 'Jr. Ica', 'Av. Fitzcarrald', 'Jr. Tacna', 'Av. Andrés Avelino Cáceres'];

/** Elige siempre lo mismo para el mismo número (el «padrón» simulado no cambia entre consultas). */
const elegir = <T>(lista: T[], numero: string, salto: number) => lista[(Number(numero.slice(-6)) * (salto + 7) + salto) % lista.length];

/** Padrón simulado de RENIEC y SUNAT: nombres peruanos fijos por número y RUC con dígito verificador. */
export class PadronSimulado implements ProveedorDocumentos {
  readonly nombre = 'Padrón simulado';
  async consultar(numero: string): Promise<DatosDocumento | null> {
    await espera(150, 500);
    if (/^[0-9]{8}$/.test(numero)) {
      if (numero.startsWith('000')) return null; // no existe en RENIEC
      return { tipo: 'DNI', numero, nombre: `${elegir(APELLIDOS, numero, 1)} ${elegir(APELLIDOS, numero, 2)}, ${elegir(NOMBRES, numero, 3)}` };
    }
    if (!rucValido(numero)) return null;
    const direccion = `${elegir(CALLES, numero, 4)} ${100 + (Number(numero.slice(-3)) % 900)}, Tambopata, Madre de Dios`;
    const persona = numero.startsWith('10');
    const nombre = persona
      ? `${elegir(APELLIDOS, numero, 1)} ${elegir(APELLIDOS, numero, 2)} ${elegir(NOMBRES, numero, 3)}`
      : `${elegir(RUBROS, numero, 5)} ${elegir(MARCAS, numero, 6)} ${numero.endsWith('5') ? 'E.I.R.L.' : 'S.A.C.'}`;
    return { tipo: 'RUC', numero, nombre, direccion, estado: 'ACTIVO', condicion: 'HABIDO' };
  }
}

/** ApisPeru (dniruc.apisperu.com). Se activa con APISPERU_TOKEN. */
export class ApisPeru implements ProveedorDocumentos {
  readonly nombre = 'ApisPeru';
  constructor(private token: string) {}
  async consultar(numero: string): Promise<DatosDocumento | null> {
    const dni = numero.length === 8;
    const r = await fetch(`https://dniruc.apisperu.com/api/v1/${dni ? 'dni' : 'ruc'}/${numero}?token=${encodeURIComponent(this.token)}`, { signal: AbortSignal.timeout(8000) });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`ApisPeru respondió HTTP ${r.status}`);
    const j = (await r.json()) as Record<string, string>;
    if (dni) return j.nombres ? { tipo: 'DNI', numero, nombre: `${j.apellidoPaterno} ${j.apellidoMaterno}, ${j.nombres}` } : null;
    return j.razonSocial ? { tipo: 'RUC', numero, nombre: j.razonSocial, direccion: j.direccion, estado: j.estado, condicion: j.condicion } : null;
  }
}

export function crearProveedorDocumentos(): ProveedorDocumentos {
  return process.env.APISPERU_TOKEN ? new ApisPeru(process.env.APISPERU_TOKEN) : new PadronSimulado();
}

export { CODIGO_TIPO };
