import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

/**
 * Eventos en tiempo real (Socket.IO) hacia tablets, caja, cocina y celulares.
 *   mesas:cambio      el plano de mesas cambió
 *   alerta            pedido QR por confirmar, llamado al mozo o pedido de cuenta
 *   cocina:comanda    nueva comanda, corrección o anulación para la estación del pollero
 *   cocina:actualizar una comanda cambió de estado
 *   carta:actualizada se marcó o desmarcó un producto como agotado
 *   cuenta:actualizada la cuenta de una mesa cambió (la escucha el celular del comensal)
 *   gaveta:abrir      simulación del pulso que abre la gaveta de dinero
 */
@WebSocketGateway({ cors: { origin: '*' } })
export class EventosGateway {
  @WebSocketServer() server: Server;

  emitir(evento: string, datos: unknown = {}) {
    this.server?.emit(evento, datos);
  }
}
