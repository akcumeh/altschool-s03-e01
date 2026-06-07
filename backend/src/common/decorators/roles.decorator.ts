import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: ('creator' | 'eventee')[]) =>
    SetMetadata(ROLES_KEY, roles);
