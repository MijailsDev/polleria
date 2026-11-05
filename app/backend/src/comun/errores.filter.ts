import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

/**
 * Respuestas de error claras para la pantalla y registro de los errores inesperados.
 * Los errores de Prisma se traducen a mensajes del negocio en lugar de «Internal server error»;
 * los 500 se guardan en error_registro para el panel de monitoreo del administrador.
 */
@Catch()
export class ErroresFilter implements ExceptionFilter {
  private readonly log = new Logger('Errores');

  constructor(private prisma: PrismaService) {}

  catch(e: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest();
    if (e instanceof HttpException) {
      res.status(e.getStatus()).json(e.getResponse());
      return;
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError || e instanceof Prisma.PrismaClientValidationError) {
      let status = HttpStatus.BAD_REQUEST;
      let message = 'Datos inválidos. Revisa la información enviada.';
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === 'P2025') (status = HttpStatus.NOT_FOUND), (message = 'No se encontró el registro.');
        else if (e.code === 'P2002') (status = HttpStatus.CONFLICT), (message = 'Ese dato ya está registrado.');
        else if (e.code === 'P2023') message = 'Identificador inválido.';
        else if (e.code === 'P2003') message = 'El registro relacionado no existe.';
        else if (e.code === 'P2010' || e.code === 'P2004') message = 'La operación no cumple las reglas del negocio.';
      }
      res.status(status).json({ statusCode: status, message });
      return;
    }
    // Error inesperado: se registra con su pila y se responde sin detalles internos
    const err = e instanceof Error ? e : new Error(String(e));
    this.log.error(`${req?.method} ${req?.url}: ${err.message}`, err.stack);
    this.prisma.error_registro
      .create({
        data: {
          metodo: String(req?.method ?? '').slice(0, 10),
          ruta: String(req?.originalUrl ?? req?.url ?? '').split('?')[0].slice(0, 200),
          estado: 500,
          mensaje: err.message.slice(0, 500),
          pila: err.stack?.slice(0, 4000),
          usuario_id: req?.usuario?.sub ?? null,
        },
      })
      .catch(() => undefined);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ statusCode: 500, message: 'Ocurrió un error en el servidor. Ya quedó registrado; intenta de nuevo.' });
  }
}
