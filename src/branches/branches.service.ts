import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../companies/company.entity';
import { Branch } from './branch.entity';
import { CreateBranchDto } from './dto/create-branch.dto';

@Injectable()
export class BranchesService {
    constructor(
        @InjectRepository(Branch)
        private readonly branches: Repository<Branch>,
        @InjectRepository(Company)
        private readonly companies: Repository<Company>,
    ) { }

    async create(dto: CreateBranchDto): Promise<Branch> {
        if (!(await this.companies.exists({ where: { companyId: dto.companyId } }))) {
            throw new BadRequestException('Company does not exist.');
        }

        return this.branches.save(this.branches.create(dto));
    }

    findAll(companyId: string): Promise<Branch[]> {
        return this.branches.find({
            where: { companyId },
            order: { branchCode: 'ASC' },
        });
    }

    async findOne(id: string): Promise<Branch> {
        const branch = await this.branches.findOne({ where: { branchId: id } });
        if (!branch) throw new NotFoundException('Branch not found.');
        return branch;
    }
}