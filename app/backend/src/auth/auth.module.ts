import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard, EquipoGuard } from './auth.guard';
import { EquiposService } from './equipos.service';
import { AlertasSeguridadService } from './alertas-seguridad.service';

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret',
      signOptions: { expiresIn: '12h' }, // RNF-SEG-02: la sesión del personal vence a las 12 h
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, EquipoGuard, EquiposService, AlertasSeguridadService],
  exports: [AuthService, AuthGuard, EquipoGuard, EquiposService, AlertasSeguridadService, JwtModule],
})
export class AuthModule {}
