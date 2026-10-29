import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { CajaModule } from '../caja/caja.module';

@Module({ imports: [CajaModule], controllers: [AdminController], providers: [AdminService] })
export class AdminModule {}
