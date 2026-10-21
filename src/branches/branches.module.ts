import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from '../companies/company.entity';
import { Branch } from './branch.entity';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';

@Module({
    imports: [TypeOrmModule.forFeature([Branch, Company])],
    controllers: [BranchesController],
    providers: [BranchesService],
    exports: [BranchesService],
})
export class BranchesModule { }
