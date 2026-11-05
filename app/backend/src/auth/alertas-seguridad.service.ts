import { Injectable, Logger } from '@nestjs/common';
import { BitacoraService } from '../comun/bitacora.service';
import { EventosGateway } from '../eventos/eventos.gateway';
import { WhatsappService } from '../perifericos/whatsapp.service';

/** Intentos sospechosos que se cuentan en una ventana de 10 minutos. */
export type Sospecha = 'PIN_FALLIDO' | 'EQUIPO_NO_VINCULADO' | 'CODIGO_EQUIPO' | 'ADMIN_FALLIDO';

const VENTANA_MS = 10 * 60 * 1000;
const REGLAS: Record<Sospecha, { umbral: number; texto: (n: number, ips: string) => string }> = {
  PIN_FALLIDO: { umbral: 8, texto: (n, ips) => `${n} PIN incorrectos en los últimos 10 minutos (${ips}).` },
  EQUIPO_NO_VINCULADO: { umbral: 5, texto: (n, ips) => `${n} intentos de entrar al sistema del personal desde equipos no vinculados (${ips}).` },
  CODIGO_EQUIPO: { umbral: 3, texto: (n, ips) => `${n} códigos de vinculación incorrectos (${ips}). Alguien podría estar intentando vincular un equipo.` },
  ADMIN_FALLIDO: { umbral: 3, texto: (n, ips) => `${n} intentos fallidos de ingresar como administrador (${ips}).` },
};

/**
 * Alertas de seguridad para el dueño: se guardan en la bitácora, aparecen en el panel
 * de Administración y llegan por WhatsApp al celular del dueño (configuración celular_dueno).
 * Para no llenar el celular de mensajes, cada tipo avisa como máximo una vez cada 10 minutos.
 */
@Injectable()
export class AlertasSeguridadService {
  private readonly log = new Logger('Seguridad');
  private intentos = new Map<Sospecha, { hora: number; ip: string }[]>();
  private ultimoAviso = new Map<string, number>();

  constructor(private bitacora: BitacoraService, private eventos: EventosGateway, private whatsapp: WhatsappService) {}

  /** Cuenta un intento sospechoso y avisa al dueño si se pasa el umbral. */
  registrar(tipo: Sospecha, ip?: string) {
    const ahora = Date.now();
    const lista = (this.intentos.get(tipo) ?? []).filter((x) => ahora - x.hora < VENTANA_MS);
    lista.push({ hora: ahora, ip: ip || 'IP desconocida' });
    this.intentos.set(tipo, lista);
    const regla = REGLAS[tipo];
    if (lista.length >= regla.umbral) {
      const ips = [...new Set(lista.map((x) => x.ip))].slice(0, 3).join(', ');
      this.avisar(tipo, regla.texto(lista.length, ips));
    }
  }

  /** Aviso inmediato (bloqueo de un usuario, ingreso del dueño desde un equipo nuevo, equipo vinculado). */
  avisar(tipo: string, texto: string, agrupar = true) {
    const ahora = Date.now();
    if (agrupar && ahora - (this.ultimoAviso.get(tipo) ?? 0) < VENTANA_MS) return;
    this.ultimoAviso.set(tipo, ahora);
    this.log.warn(texto);
    this.bitacora.registrar('ALERTA_SEGURIDAD', 'seguridad', null, null, { tipo, texto }).catch(() => undefined);
    this.eventos.emitir('seguridad:alerta', { tipo, texto, hora: new Date() });
    this.whatsapp.alertaDueno(`Seguridad: ${texto}`).catch(() => undefined);
  }

  /** Últimos intentos por tipo (pestaña Equipos del administrador). */
  resumen() {
    const ahora = Date.now();
    return (Object.keys(REGLAS) as Sospecha[]).map((tipo) => ({
      tipo,
      ultimos10min: (this.intentos.get(tipo) ?? []).filter((x) => ahora - x.hora < VENTANA_MS).length,
      umbral: REGLAS[tipo].umbral,
    }));
  }
}
