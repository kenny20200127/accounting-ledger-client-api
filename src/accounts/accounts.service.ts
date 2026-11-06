import { findCompanyList } from '../common/find-company-list';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';
import { Account } from './account.entity';
import {
  isForeignKeyViolation,
  isUniqueViolation,
  nextChartAccountCode,
} from './account-codes';
import { AccountListQueryDto } from './dto/account-list-query.dto';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { MainAccount } from './main-account.entity';

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
    @InjectRepository(MainAccount)
    private readonly mainAccounts: Repository<MainAccount>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateAccountDto, createdBy?: string): Promise<Account> {
    if (dto.accountCode?.trim())
      throw new BadRequestException(
        'Account codes are generated automatically and cannot be set manually.',
      );
    const main = await this.mainAccounts.findOne({
      where: { mainAccountId: dto.mainAccountId },
    });
    if (!main) throw new BadRequestException('Main account does not exist.');
    if (main.companyId !== dto.companyId)
      throw new BadRequestException(
        'Main account must belong to the same company.',
      );
    if (dto.parentAccountId) {
      const parent = await this.accounts.findOne({
        where: { accountId: dto.parentAccountId, companyId: dto.companyId },
      });
      if (!parent)
        throw new BadRequestException(
          'Parent account must belong to the same company.',
        );
    }

    for (let attempt = 0; ; attempt++) {
      try {
        return await this.dataSource.transaction(async (manager) => {
          const accountCode = await nextChartAccountCode(
            manager,
            main.mainAccountId,
            main.mainCode,
          );
          const repo = manager.getRepository(Account);
          return repo.save(
            repo.create({
              companyId: dto.companyId,
              mainAccountId: main.mainAccountId,
              accountTypeId: main.accountTypeId,
              parentAccountId: dto.parentAccountId ?? null,
              accountCode,
              accountName: dto.accountName.trim(),
              description: dto.description?.trim() || null,
              email: dto.email?.trim().toLowerCase() || null,
              isControlAccount: dto.isControlAccount ?? false,
              createdBy: createdBy ?? null,
            }),
          );
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          if (attempt >= 4)
            throw new ConflictException(
              'Unable to allocate a unique account code. Please retry.',
            );
          continue;
        }
        throw error;
      }
    }
  }

  findAll(query: AccountListQueryDto) {
    const extraWhere: FindOptionsWhere<Account> = {};
    if (query.type) {
      extraWhere.accountType = { code: query.type };
    }
    if (query.mainAccountId) {
      extraWhere.mainAccountId = query.mainAccountId;
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
        relations: {
          accountType: true,
          mainAccount: {
            accountType: true,
            balanceSheet: true,
            accountSubtype: true,
          },
        },
        order: { accountCode: 'ASC', accountId: 'ASC' },
      },
      ['accountCode', 'accountName'],
      extraWhere,
    );
  }

  async findOne(id: string): Promise<Account> {
    const account = await this.accounts.findOne({
      where: { accountId: id },
      relations: {
        accountType: true,
        mainAccount: {
          accountType: true,
          balanceSheet: true,
          accountSubtype: true,
        },
      },
    });
    if (!account) throw new NotFoundException('Account not found.');
    return account;
  }

  async update(id: string, dto: UpdateAccountDto): Promise<Account> {
    if (dto.accountCode !== undefined)
      throw new BadRequestException(
        'Account codes are generated automatically and cannot be changed.',
      );
    if (dto.mainAccountId !== undefined)
      throw new BadRequestException(
        'An account cannot be moved to another main account.',
      );
    await this.findOne(id);

    const values: Partial<Account> = {};
    if (dto.accountName !== undefined)
      values.accountName = dto.accountName.trim();
    if (dto.description !== undefined)
      values.description = dto.description.trim() || null;
    if (dto.email !== undefined)
      values.email = dto.email.trim().toLowerCase() || null;
    if (Object.keys(values).length)
      await this.accounts.update({ accountId: id }, values);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    if (await this.accounts.exists({ where: { parentAccountId: id } }))
      throw new ConflictException(
        'This account still has child accounts. Delete or move them first.',
      );
    try {
      await this.accounts.delete({ accountId: id });
    } catch (error) {
      if (isForeignKeyViolation(error))
        throw new ConflictException(
          'This account is used by existing records and cannot be deleted.',
        );
      throw error;
    }
    return { deleted: true };
  }
}
