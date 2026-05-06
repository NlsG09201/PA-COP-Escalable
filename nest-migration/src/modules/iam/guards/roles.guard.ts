import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { SUPER_ADMIN_ROLE } from '../roles.constants';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest();
    const userRoles: string[] = Array.isArray(user?.roles) ? user.roles : [];
    if (userRoles.includes(SUPER_ADMIN_ROLE)) {
      return true;
    }
    return requiredRoles.some((role) => userRoles.includes(role));
  }
}
