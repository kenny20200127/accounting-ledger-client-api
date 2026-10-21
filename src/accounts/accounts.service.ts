import { findCompanyList } from '../common/find-company-list';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Account } from './account.entity';
import { AccountType } from './account-type.entity';
import { AccountCategory } from './account-category.entity';
import { Company } from '../companies/company.entity';
import { CreateAccountDto } from './dto/create-account.dto';
import { AccountListQueryDto } from './dto/account-list-query.dto';

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
    @InjectRepository(AccountType)
    private readonly types: Repository<AccountType>,
    @InjectRepository(AccountCategory)
    private readonly categories: Repository<AccountCategory>,
    @InjectRepository(Company) private readonly companies: Repository<Company>,
  ) {}

  async create(dto: CreateAccountDto): Promise<Account> {
    if (
      !(await this.companies.exists({ where: { companyId: dto.companyId } }))
    ) {
      throw new BadRequestException('Company does not exist.');
    }
    if (
      !(await this.types.exists({
        where: { accountTypeId: dto.accountTypeId },
      }))
    ) {
      throw new BadRequestException(
        'Account type does not exist. Seed account types first.',
      );
    }
    if (dto.accountCategoryId) {
      const category = await this.categories.findOne({
        where: { accountCategoryId: dto.accountCategoryId },
      });
      if (!category || category.accountTypeId !== dto.accountTypeId) {
        throw new BadRequestException(
          'Account category must belong to the selected account type.',
        );
      }
    }
    if (dto.parentAccountId) {
      const parent = await this.accounts.findOne({
        where: { accountId: dto.parentAccountId },
      });
      if (!parent || parent.companyId !== dto.companyId) {
        throw new BadRequestException(
          'Parent account must belong to the same company.',
        );
      }
    }
    return this.accounts.save(this.accounts.create(dto));
  }

  findAll(query: AccountListQueryDto) {
    const extraWhere: FindOptionsWhere<Account> = {};
    if (query.type) {
      extraWhere.accountType = { code: query.type };
    }
    if (query.postable === 'true') {
      Object.assign(extraWhere, {
        allowPosting: true,
        isHeader: false,
        isActive: true,
      });
    }
    return findCompanyList(
      this.accounts,
      query,
      {
        relations: { accountType: true },
        order: { accountCode: 'ASC', accountId: 'ASC' },
      },
      ['accountCode', 'accountName'],
      extraWhere,
    );
  }

  async findOne(id: string): Promise<Account> {
    const account = await this.accounts.findOne({
      where: { accountId: id },
      relations: { accountType: true },
    });
    if (!account) throw new NotFoundException('Account not found.');
    return account;
  }
}
