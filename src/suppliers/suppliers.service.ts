import { CompanyListQueryDto } from '../common/company-list-query.dto';
import { findCompanyList } from '../common/find-company-list';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Account } from '../accounts/account.entity';
import { Company } from '../companies/company.entity';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { Supplier } from './supplier.entity';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private readonly suppliers: Repository<Supplier>,
    @InjectRepository(Company)
    private readonly companies: Repository<Company>,
    @InjectRepository(Account)
    private readonly accounts: Repository<Account>,
  ) {}

  async create(dto: CreateSupplierDto): Promise<Supplier> {
    if (!(await this.companies.exists({ where: { companyId: dto.companyId } }))) {
      throw new BadRequestException('Company does not exist.');
    }

    if (dto.payableAccountId) {
      const account = await this.accounts.findOne({
        where: { accountId: dto.payableAccountId },
      });
      if (!account || account.companyId !== dto.companyId) {
        throw new BadRequestException(
          'Payable account must exist and belong to the selected company.',
        );
      }
    }

    try {
      return await this.suppliers.save(this.suppliers.create(dto));
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error as any).driverError?.code === '23505'
      ) {
        throw new ConflictException(
          'A supplier with this code already exists for the company.',
        );
      }
      throw error;
    }
  }
  findAll(query: CompanyListQueryDto) {
    return findCompanyList(this.suppliers, query, { order: { supplierName: 'ASC', supplierId: 'ASC' } }, ['supplierCode', 'supplierName', 'email']);
  }


  async findOne(id: string): Promise<Supplier> {
    const supplier = await this.suppliers.findOne({
      where: { supplierId: id },
    });
    if (!supplier) throw new NotFoundException('Supplier not found.');
    return supplier;
  }
}