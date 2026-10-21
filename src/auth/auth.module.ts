import {
  TenantGuard,
  TenantAccessService,
} from '../administration/tenant-access.service';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoleMenu } from '../roles/role-menu.entity';
import { Menu } from '../roles/menu.entity';
import { UserRole } from '../users/user-role.entity';
import { User } from '../users/user.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { MenuAccessGuard } from './menu-access.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserRole, Menu, RoleMenu]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret || secret.length < 32) {
          throw new Error(
            'JWT_SECRET must be configured with at least 32 characters.',
          );
        }
        return {
          secret,
          signOptions: {
            expiresIn: config.get<string>('JWT_EXPIRES_IN', '1h') as never,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TenantAccessService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: MenuAccessGuard },
  ],
})
export class AuthModule {}
