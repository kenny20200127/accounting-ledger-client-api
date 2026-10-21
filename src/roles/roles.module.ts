import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Menu } from './menu.entity';
import { RoleMenu } from './role-menu.entity';
import { Role } from './role.entity';

@Module({
	imports: [TypeOrmModule.forFeature([Role, Menu, RoleMenu])],
	exports: [TypeOrmModule],
})
export class RolesModule {}
