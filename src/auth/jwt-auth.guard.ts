import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { TenantAccessService } from '../administration/tenant-access.service';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly access: TenantAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const authorization = request.headers.authorization as string | undefined;
    const [scheme, token] = authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Bearer token is required.');
    }

    try {
      request.user = await this.jwt.verifyAsync(token);
      request.actor = await this.access.actor(request.user.sub);
      if ((request.user.authVersion ?? 0) !== request.actor.authVersion)
        throw new UnauthorizedException();
      request.user.companyId = request.actor.companyId;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token.');
    }
    const scope =
      request.user.scope ??
      (request.actor.isPlatformAdmin ? 'platform' : 'company');
    if (
      !['platform', 'company'].includes(scope) ||
      (scope === 'platform') !== request.actor.isPlatformAdmin
    )
      throw new ForbiddenException(
        'This session is not valid for this application.',
      );
    const path = String(request.path).replace(/^\/api\/v\d+\/?/, '');
    const platformRoute = path === 'platform' || path.startsWith('platform/');
    const sessionRoute = path === 'auth/me' || path === 'auth/menus';
    if (scope === 'platform' && !platformRoute && !sessionRoute)
      throw new ForbiddenException(
        'Use a company account in the company application for accounting operations.',
      );
    if (scope === 'company' && platformRoute)
      throw new ForbiddenException('Platform application access denied.');
    return true;
  }
}
