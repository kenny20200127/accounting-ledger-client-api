import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Branch } from '../branches/branch.entity';
import { Company } from '../companies/company.entity';
import { Role } from '../roles/role.entity';
import { UserRole } from './user-role.entity';
import { User } from './user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
	imports: [TypeOrmModule.forFeature([User, UserRole, Role, Company, Branch])],
	controllers: [UsersController],
	providers: [UsersService],
	exports: [UsersService],
})
export class UsersModule {}
