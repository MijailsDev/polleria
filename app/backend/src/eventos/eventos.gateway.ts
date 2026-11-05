import { Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

/**
 * Eventos en tiempo real (Socket.IO) hacia tablets, caja, cocina y celulares.
 *   mesas:cambio      el plano de mesas cambió
 *   alerta            pedido QR por confirmar, llamado al mozo o pedido de cuenta
 *   cocina:comanda    nueva comanda, corrección o anulación para la estación del pollero
 *   cocina:actualizar una comanda cambió de estado
 *   carta:actualizada se marcó o desmarcó un producto como agotado
 *   cuenta:actualizada la cuenta de una mesa cambió (la escucha el celular del comensal)
 *   gaveta:abrir      simulación del pulso que abre la gaveta de dinero
 *   seguridad:alerta  intentos sospechosos para el panel del administrador
 *
 * Solo los eventos que necesita el celular del comensal se envían a todos (y no llevan
 * datos del personal). El resto va a la sala «personal»: sesiones del personal y equipos
 * vinculados. Si no se exigen equipos (desarrollo), todos entran a la sala como antes.
 */
const PUBLICOS = new Set(['carta:actualizada', 'cuenta:actualizada', 'pedido:listo', 'estado:cambio', 'mesas:cambio', 'cocina:actualizar']);

@WebSocketGateway({ cors: { origin: !process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === '*' ? true : process.env.CORS_ORIGIN.split(',').map((x) => x.trim()) } })
export class EventosGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;
  private readonly log = new Logger('Eventos');

  // Se obtienen al conectar (y no en el constructor) para no crear una dependencia circular con AuthModule
  constructor(private moduleRef: ModuleRef) {}

  async handleConnection(cliente: Socket) {
    try {
      const { EquiposService } = await import('../auth/equipos.service');
      const equipos = this.moduleRef.get(EquiposService, { strict: false });
      if (!equipos.obligatorio()) return void cliente.join('personal');
      const { token, equipo } = (cliente.handshake.auth ?? {}) as { token?: string; equipo?: string };
      const e = await equipos.porLlave(equipo, cliente.handshake.address);
      if (e) return void cliente.join('personal');
      if (token) {
        const u = this.moduleRef.get(JwtService, { strict: false }).verify<{ rol: string; eq?: string }>(token);
        if (!u.eq && u.rol === 'ADMINISTRADOR') cliente.join('personal');
      }
    } catch (err) {
      this.log.debug(`Conexión sin acceso al personal: ${(err as Error).message}`);
    }
  }

  emitir(evento: string, datos: unknown = {}) {
    if (!this.server) return;
    if (PUBLICOS.has(evento)) this.server.emit(evento, datos);
    else this.server.to('personal').emit(evento, datos);
  }
}
