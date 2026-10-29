import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  /** Lista de nombres para elegir en la pantalla de ingreso. */
  @Get('usuarios')
  usuarios() {
    return this.auth.usuariosActivos();
  }

  @Post('login')
  login(@Body() body: { usuarioId: string; pin: string; password?: string }) {
    return this.auth.login(body.usuarioId, body.pin, body.password);
  }
}
