import { SetMetadata } from '@nestjs/common';

export type Rol = 'MOZO' | 'CAJERO' | 'REPARTIDOR' | 'ADMINISTRADOR';
export const ROLES_KEY = 'roles';
/** Roles que pueden usar el endpoint. El administrador siempre puede (RN: puede todo lo del cajero). */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);
