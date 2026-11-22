import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, createHmac, randomInt, timingSafeEqual } from 'crypto';
import { PrismaService } from '../comun/prisma.service';
import { ConfigService } from '../comun/config.service';
import { BitacoraService } from '../comun/bitacora.service';
import { aCentimos, aSoles } from '../comun/dinero';
import { WhatsappService } from '../perifericos/whatsapp.service';
import { CorreoService, RE_CORREO } from '../perifericos/correo.service';

type Tx = Prisma.TransactionClient;
const RE_CELULAR = /^9[0-9]{8}$/;
const VIGENCIA_CODIGO_MIN = 10;
const MAX_INTENTOS = 5;
const VIGENCIA_SESION_DIAS = 90;

export interface Contacto {
  canal: 'WHATSAPP' | 'CORREO';
  valor: string;
}

/** Celular (9 dígitos, empieza con 9) o correo; acepta espacios y mayúsculas. */
export function normalizarContacto(texto: string | undefined | null): Contacto {
  const t = String(texto ?? '').trim();
  const digitos = t.replace(/[\s-]/g, '').replace(/^\+?51/, '');
  if (/^[0-9]+$/.test(digitos)) {
    if (!RE_CELULAR.test(digitos)) throw new BadRequestException('El celular debe tener 9 dígitos y empezar con 9.');
    return { canal: 'WHATSAPP', valor: digitos };
  }
  const correo = t.toLowerCase();
  if (!RE_CORREO.test(correo) || correo.length > 120) throw new BadRequestException('Escribe tu celular (9 dígitos) o un correo válido.');
  return { canal: 'CORREO', valor: correo };
}

/** Muestra el contacto a medias: 987 *** 321 o ca***@gmail.com. */
export function enmascarar(valor: string) {
  if (RE_CELULAR.test(valor)) return `${valor.slice(0, 3)} *** ${valor.slice(6)}`;
  const [u, d] = valor.split('@');
  return `${u.slice(0, 2)}${'*'.repeat(Math.max(1, Math.min(5, u.length - 2)))}@${d}`;
}

/**
 * Programa de clientes frecuentes. El comensal se identifica (opcional) con su celular o su
 * correo y lo confirma con un código de un solo uso. Cada compra pagada suma; con N compras en
 * los últimos D días es «cliente frecuente» y ve combos exclusivos en la carta QR.
 * Sin contraseñas: la sesión del cliente es un token firmado que guarda su celular.
 */
@Injectable()
export class ClientesService {
  private readonly secreto = (process.env.JWT_SECRET ?? 'secreto-de-desarrollo') + ':clientes';

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private bitacora: BitacoraService,
    private whatsapp: WhatsappService,
    private correo: CorreoService,
  ) {}

  // ---------------------------------------------------------------- Sesión del cliente (token firmado)

  private huella(destino: string, codigo: string) {
    return createHash('sha256').update(`${this.secreto}|${destino}|${codigo}`).digest('hex');
  }

  private firmar(clienteId: string) {
    const cuerpo = Buffer.from(JSON.stringify({ c: clienteId, e: Date.now() + VIGENCIA_SESION_DIAS * 86_400_000 })).toString('base64url');
    return `${cuerpo}.${createHmac('sha256', this.secreto).update(cuerpo).digest('base64url')}`;
  }

  /** Id del cliente si el token es válido y no venció; null en cualquier otro caso. */
  idDeToken(token?: string | string[] | null): string | null {
    const t = Array.isArray(token) ? token[0] : token;
    if (!t || t.length > 300) return null;
    const [cuerpo, firma] = t.split('.');
    if (!cuerpo || !firma) return null;
    const esperada = Buffer.from(createHmac('sha256', this.secreto).update(cuerpo).digest('base64url'));
    const recibida = Buffer.from(firma);
    if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null;
    try {
      const d = JSON.parse(Buffer.from(cuerpo, 'base64url').toString()) as { c: string; e: number };
      return d.e > Date.now() && typeof d.c === 'string' ? d.c : null;
    } catch {
      return null;
    }
  }

  /** Id del cliente si el token es válido y el cliente todavía existe. */
  async idValido(token?: string | string[] | null) {
    const id = this.idDeToken(token);
    if (!id) return null;
    return (await this.prisma.cliente_frecuente.count({ where: { id } })) ? id : null;
  }

  // ---------------------------------------------------------------- Código de verificación

  /** Envía un código de 6 dígitos por WhatsApp (celular) o por correo. */
  async pedirCodigo(texto: string) {
    const c = normalizarContacto(texto);
    const recientes = await this.prisma.codigo_verificacion.findMany({
      where: { destino: c.valor, creado_en: { gte: new Date(Date.now() - 3_600_000) } },
      orderBy: { creado_en: 'desc' },
      select: { creado_en: true },
    });
    if (recientes[0] && Date.now() - +recientes[0].creado_en < 60_000)
      throw new HttpException('Ya te enviamos un código. Espera un minuto para pedir otro.', HttpStatus.TOO_MANY_REQUESTS);
    if (recientes.length >= 5) throw new HttpException('Pediste demasiados códigos. Inténtalo en una hora.', HttpStatus.TOO_MANY_REQUESTS);

    const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.codigo_verificacion.create({
      data: { canal: c.canal, destino: c.valor, codigo_hash: this.huella(c.valor, codigo), vence_en: new Date(Date.now() + VIGENCIA_CODIGO_MIN * 60_000) },
    });
    const local = this.config.texto('razon_social');
    const texto2 = `${local}: tu código para el programa de clientes frecuentes es ${codigo}. Vence en ${VIGENCIA_CODIGO_MIN} minutos. No lo compartas con nadie.`;
    if (c.canal === 'WHATSAPP') await this.whatsapp.encolar(c.valor, 'CODIGO_CLIENTE', texto2);
    else await this.correo.encolar(c.valor, 'CODIGO_CLIENTE', `Tu código: ${codigo}`, `Hola:\n\n${texto2}\n\nSi no lo pediste, ignora este correo.`);
    return { canal: c.canal, destino: enmascarar(c.valor), venceEnMinutos: VIGENCIA_CODIGO_MIN };
  }

  /** Confirma el código, crea o recupera al cliente y devuelve su sesión. */
  async verificar(d: { contacto: string; codigo: string; nombre?: string; aceptaPromociones?: boolean }) {
    const c = normalizarContacto(d.contacto);
    const codigo = String(d.codigo ?? '').replace(/\D/g, '');
    if (codigo.length !== 6) throw new BadRequestException('Escribe el código de 6 dígitos que te enviamos.');
    const ultimo = await this.prisma.codigo_verificacion.findFirst({
      where: { destino: c.valor, usado_en: null, vence_en: { gt: new Date() } },
      orderBy: { creado_en: 'desc' },
    });
    if (!ultimo) throw new BadRequestException('El código venció. Pide uno nuevo.');
    if (ultimo.intentos >= MAX_INTENTOS) throw new BadRequestException('Demasiados intentos. Pide un código nuevo.');
    const ok = timingSafeEqual(Buffer.from(ultimo.codigo_hash), Buffer.from(this.huella(c.valor, codigo)));
    if (!ok) {
      await this.prisma.codigo_verificacion.update({ where: { id: ultimo.id }, data: { intentos: { increment: 1 } } });
      const quedan = MAX_INTENTOS - ultimo.intentos - 1;
      throw new BadRequestException(quedan > 0 ? `Código incorrecto. Te quedan ${quedan} intentos.` : 'Código incorrecto. Pide un código nuevo.');
    }
    await this.prisma.codigo_verificacion.update({ where: { id: ultimo.id }, data: { usado_en: new Date() } });

    const donde = c.canal === 'WHATSAPP' ? { celular: c.valor } : { correo: c.valor };
    const nombre = d.nombre?.trim().slice(0, 80) || undefined;
    const permiso = typeof d.aceptaPromociones === 'boolean' ? d.aceptaPromociones : undefined;
    const existente = await this.prisma.cliente_frecuente.findFirst({ where: donde });
    const cliente = existente
      ? await this.prisma.cliente_frecuente.update({
          where: { id: existente.id },
          data: {
            ultimo_ingreso: new Date(),
            ...(nombre ? { nombre } : {}),
            ...(permiso !== undefined && permiso !== existente.acepta_promociones ? { acepta_promociones: permiso, acepta_promociones_en: new Date() } : {}),
          },
        })
      : await this.prisma.cliente_frecuente.create({
          data: { ...donde, nombre: nombre ?? null, acepta_promociones: !!permiso, acepta_promociones_en: permiso ? new Date() : null, ultimo_ingreso: new Date() },
        });
    if (!existente) await this.bitacora.registrar('CLIENTE_FRECUENTE_ALTA', 'cliente_frecuente', cliente.id, null, { canal: c.canal, promociones: !!permiso });
    return { token: this.firmar(cliente.id), cliente: await this.estado(cliente.id) };
  }

  // ---------------------------------------------------------------- Estado y beneficios

  private regla() {
    return {
      meta: Math.max(1, Math.trunc(this.config.numero('frecuente_compras'))),
      dias: Math.max(1, Math.trunc(this.config.numero('frecuente_dias'))),
      minimo: aCentimos(this.config.numero('frecuente_monto_minimo')),
    };
  }

  /** Compras que cuentan: pagadas, en los últimos D días y de al menos el monto mínimo. */
  private async comprasValidas(clienteId: string, tx: Tx = this.prisma) {
    const r = this.regla();
    return tx.compra_cliente.count({
      where: { cliente_id: clienteId, creado_en: { gte: new Date(Date.now() - r.dias * 86_400_000) }, monto: { gte: aSoles(r.minimo) } },
    });
  }

  async estado(clienteId: string) {
    const c = await this.prisma.cliente_frecuente.findUnique({ where: { id: clienteId } });
    if (!c) throw new NotFoundException('Cliente no encontrado. Vuelve a identificarte.');
    const r = this.regla();
    const compras = await this.comprasValidas(c.id);
    return {
      nombre: c.nombre,
      contacto: enmascarar(c.celular ?? c.correo!),
      canal: c.celular ? 'WHATSAPP' : 'CORREO',
      compras,
      meta: r.meta,
      dias: r.dias,
      montoMinimo: aSoles(r.minimo),
      faltan: Math.max(0, r.meta - compras),
      frecuente: compras >= r.meta,
      aceptaPromociones: c.acepta_promociones,
    };
  }

  /** ¿El token corresponde a un cliente frecuente? (para ver y pedir los combos exclusivos). */
  async esFrecuentePorToken(token?: string | string[] | null) {
    const id = this.idDeToken(token);
    if (!id) return false;
    return (await this.comprasValidas(id)) >= this.regla().meta;
  }

  async promociones(clienteId: string, acepta: boolean) {
    const c = await this.prisma.cliente_frecuente.update({ where: { id: clienteId }, data: { acepta_promociones: !!acepta, acepta_promociones_en: new Date() } }).catch(() => null);
    if (!c) throw new NotFoundException('Cliente no encontrado.');
    await this.bitacora.registrar(acepta ? 'CLIENTE_ACEPTA_PROMOCIONES' : 'CLIENTE_BAJA_PROMOCIONES', 'cliente_frecuente', c.id, null);
    return this.estado(c.id);
  }

  // ---------------------------------------------------------------- Compras

  /** Suma la compra de una cuenta (una visita cuenta una vez; pagos divididos se acumulan). */
  async registrarCompra(tx: Tx, clienteId: string, cuentaId: string, montoCentimos: number) {
    if (montoCentimos <= 0) return;
    await tx.compra_cliente.upsert({
      where: { cliente_id_cuenta_id: { cliente_id: clienteId, cuenta_id: cuentaId } },
      create: { cliente_id: clienteId, cuenta_id: cuentaId, monto: aSoles(montoCentimos) },
      update: { monto: { increment: aSoles(montoCentimos) } },
    });
  }

  /** Busca al cliente por su celular o correo (lo dicta en caja) y le suma la compra. */
  async registrarCompraPorContacto(tx: Tx, texto: string | null | undefined, cuentaId: string, montoCentimos: number) {
    if (!texto?.trim()) return null;
    const c = normalizarContacto(texto);
    const cliente = await tx.cliente_frecuente.findFirst({ where: c.canal === 'WHATSAPP' ? { celular: c.valor } : { correo: c.valor } });
    if (!cliente) return null;
    await this.registrarCompra(tx, cliente.id, cuentaId, montoCentimos);
    return cliente.id;
  }

  /**
   * Tras una compra: si el cliente acaba de llegar a la meta, se le da la bienvenida como
   * cliente frecuente (solo si aceptó recibir mensajes).
   */
  async despuesDeCompra(clienteId: string | null | undefined) {
    if (!clienteId) return;
    const c = await this.prisma.cliente_frecuente.findUnique({ where: { id: clienteId } });
    if (!c) return;
    const r = this.regla();
    const frecuente = (await this.comprasValidas(c.id)) >= r.meta;
    const yaAvisado = c.frecuente_desde && Date.now() - +c.frecuente_desde < r.dias * 86_400_000;
    if (!frecuente || yaAvisado) return;
    await this.prisma.cliente_frecuente.update({ where: { id: c.id }, data: { frecuente_desde: new Date() } });
    if (!c.acepta_promociones) return;
    const local = this.config.texto('razon_social');
    const saludo = c.nombre ? `${c.nombre.split(' ')[0]}, ya` : 'Ya';
    const texto = `${local}: ¡${saludo} eres Cliente frecuente! En tu próxima visita, identifícate en la carta QR y verás combos exclusivos a precio especial. Para no recibir más promociones, desactívalas en la carta.`;
    if (c.celular) await this.whatsapp.encolar(c.celular, 'CLIENTE_FRECUENTE', texto).catch(() => undefined);
    else if (c.correo) await this.correo.encolar(c.correo, 'CLIENTE_FRECUENTE', '¡Ya eres Cliente frecuente!', texto).catch(() => undefined);
  }

  // ---------------------------------------------------------------- Reporte del administrador

  async resumen() {
    const r = this.regla();
    const desde = new Date(Date.now() - r.dias * 86_400_000);
    const [registrados, conPermiso, porCliente, exclusivos] = await Promise.all([
      this.prisma.cliente_frecuente.count(),
      this.prisma.cliente_frecuente.count({ where: { acepta_promociones: true } }),
      this.prisma.compra_cliente.groupBy({
        by: ['cliente_id'],
        where: { creado_en: { gte: desde }, monto: { gte: aSoles(r.minimo) } },
        _count: { _all: true },
        _sum: { monto: true },
        orderBy: { _count: { cliente_id: 'desc' } },
      }),
      this.prisma.$queryRaw<{ nombre: string; cantidad: bigint }[]>`
        SELECT pr.nombre, sum(i.cantidad) AS cantidad
        FROM item_pedido i JOIN pedido p ON p.id = i.pedido_id JOIN producto pr ON pr.id = i.producto_id
        WHERE pr.solo_frecuentes AND i.estado <> 'ANULADO' AND p.estado NOT IN ('ANULADO', 'POR_CONFIRMAR')
          AND p.creado_en >= ${desde}
        GROUP BY pr.nombre ORDER BY 2 DESC`,
    ]);
    const top = porCliente.slice(0, 10);
    const clientes = await this.prisma.cliente_frecuente.findMany({ where: { id: { in: top.map((t) => t.cliente_id) } } });
    return {
      regla: { compras: r.meta, dias: r.dias, montoMinimo: aSoles(r.minimo) },
      registrados,
      conPermiso,
      frecuentes: porCliente.filter((x) => x._count._all >= r.meta).length,
      mejores: top.map((t) => {
        const c = clientes.find((x) => x.id === t.cliente_id)!;
        return { nombre: c?.nombre ?? 'Sin nombre', contacto: enmascarar(c.celular ?? c.correo!), compras: t._count._all, total: Number(t._sum.monto ?? 0), frecuente: t._count._all >= r.meta };
      }),
      combosVendidos: exclusivos.map((e) => ({ nombre: e.nombre, cantidad: Number(e.cantidad) })),
    };
  }
}
