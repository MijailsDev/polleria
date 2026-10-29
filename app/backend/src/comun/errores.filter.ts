import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** Traduce los errores de Prisma a respuestas claras en lugar de un «Internal server error». */
@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientValidationError)
export class ErroresPrismaFilter implements ExceptionFilter {
  catch(e: Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientValidationError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
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
  }
}
