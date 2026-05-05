import { Injectable, NestInterceptor, ExecutionContext, CallHandler, UnauthorizedException } from '@nestjs/common';
import { Observable } from 'rxjs';

export interface TenantContext {
  organizationId: string;
  siteId?: string;
}

@Injectable()
export class TenancyInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.organization_id) {
      throw new UnauthorizedException('Tenant context missing from token');
    }

    request.tenant = {
      organizationId: String(user.organization_id),
      siteId: user.site_id ? String(user.site_id) : undefined,
    };

    return next.handle();
  }
}
