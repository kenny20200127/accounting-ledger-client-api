import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { findCompanyList } from '../common/find-company-list';
import { Company } from '../companies/company.entity';
import {
  isForeignKeyViolation,
  isUniqueViolation,
  nextMainAccountCode,
} from './account-codes';
import { Account } from './account.entity';
import { AccountSubtype } from './account-subtype.entity';
import { AccountType } from './account-type.entity';
import { BalanceSheetClassification } from './balance-sheet-classification.entity';
import { CreateMainAccountDto } from './dto/create-main-account.dto';
import { MainAccountListQueryDto } from './dto/main-account-list-query.dto';
import { UpdateMainAccountDto } from './dto/update-main-account.dto';
import { MainAccount } from './main-account.entity';

@Injectable()
export class MainAccountsService {
  constructor(
    @InjectRepository(MainAccount)
    private readonly mainAccounts: Repository<MainAccount>,
    @InjectRepository(AccountType)
    private readonly types: Repository<AccountType>,
    @InjectRepository(AccountSubtype)
    private readonly subtypes: Repository<AccountSubtype>,
    @InjectRepository(BalanceSheetClassification)
    private readonly balanceSheets: Repository<BalanceSheetClassification>,
    @InjectRepository(Account)
    private readonly accounts: Repository<Account>,
    @InjectRepository(Company) private readonly companies: Repository<Company>,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    dto: CreateMainAccountDto,
    createdBy?: string,
  ): Promise<MainAccount> {
    const type = await this.types.findOne({
      where: { accountTypeId: dto.accountTypeId },
    });
    if (!type) throw new BadRequestException('Account type does not exist.');
    if (!(await this.companies.exists({ where: { companyId: dto.companyId } })))
      throw new BadRequestException('Company does not exist.');
    const balanceSheet = await this.balanceSheets.findOne({
      where: { balanceSheetId: dto.balanceSheetId },
    });
    if (
      !balanceSheet ||
      balanceSheet.companyId !== dto.companyId ||
      balanceSheet.accountTypeId !== dto.accountTypeId
    )
      throw new BadRequestException(
        'Balance sheet classification must belong to the selected company and account type.',
      );
    if (
      !(await this.subtypes.exists({
        where: { accountSubtypeId: dto.accountSubtypeId },
      }))
    )
      throw new BadRequestException('Account subtype does not exist.');

    if (dto.mainCode) {
      try {
        return await this.dataSource.transaction((manager) =>
          this.save(manager, {
            companyId: dto.companyId,
            accountTypeId: dto.accountTypeId,
            balanceSheetId: dto.balanceSheetId,
            accountSubtypeId: dto.accountSubtypeId,
            mainCode: dto.mainCode,
            description: dto.description.trim(),
            shortName: dto.shortName?.trim() || null,
            createdBy: createdBy ?? null,
          }),
        );
      } catch (error) {
        if (isUniqueViolation(error))
          throw new ConflictException(
            `Main account code ${dto.mainCode} is already in use.`,
          );
        throw error;
      }
    }

    for (let attempt = 0; ; attempt++) {
      try {
        return await this.dataSource.transaction(async (manager) => {
          const mainCode = await nextMainAccountCode(
            manager,
            dto.companyId,
            dto.accountTypeId,
            type.codePrefix,
          );
          return this.save(manager, {
            companyId: dto.companyId,
            accountTypeId: dto.accountTypeId,
            balanceSheetId: dto.balanceSheetId,
            accountSubtypeId: dto.accountSubtypeId,
            mainCode,
            description: dto.description.trim(),
            shortName: dto.shortName?.trim() || null,
            createdBy: createdBy ?? null,
          });
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          if (attempt >= 4)
            throw new ConflictException(
              'Unable to allocate a unique main account code. Please retry.',
            );
          continue;
        }
        throw error;
      }
    }
  }

  private save(manager: EntityManager, values: Partial<MainAccount>) {
    const repo = manager.getRepository(MainAccount);
    return repo.save(repo.create(values));
  }

  async nextCode(companyId: string, accountTypeId: string) {
    const type = await this.types.findOne({
      where: { accountTypeId },
    });
    if (!type) throw new BadRequestException('Account type does not exist.');
    if (!(await this.companies.exists({ where: { companyId } })))
      throw new BadRequestException('Company does not exist.');
    return {
      mainCode: await nextMainAccountCode(
        this.dataSource.manager,
        companyId,
        accountTypeId,
        type.codePrefix,
      ),
    };
  }

  findAll(query: MainAccountListQueryDto) {
    return findCompanyList(
      this.mainAccounts,
      query,
      {
        relations: {
          accountType: true,
          balanceSheet: true,
          accountSubtype: true,
        },
        order: { mainCode: 'ASC', mainAccountId: 'ASC' },
      },
      ['mainCode', 'description', 'shortName'],
      query.accountTypeId
        ? { accountTypeId: query.accountTypeId }
        : undefined,
    );
  }

  async findOne(id: string): Promise<MainAccount> {
    const row = await this.mainAccounts.findOne({
      where: { mainAccountId: id },
      relations: {
        accountType: true,
        balanceSheet: true,
        accountSubtype: true,
      },
    });
    if (!row) throw new NotFoundException('Main account not found.');
    return row;
  }

  async update(id: string, dto: UpdateMainAccountDto): Promise<MainAccount> {
    if (dto.mainCode !== undefined)
      throw new BadRequestException(
        'Main account codes cannot be changed after creation.',
      );
    const row = await this.findOne(id);
    if (dto.balanceSheetId) {
      const balanceSheet = await this.balanceSheets.findOne({
        where: { balanceSheetId: dto.balanceSheetId },
      });
      if (
        !balanceSheet ||
        balanceSheet.companyId !== row.companyId ||
        balanceSheet.accountTypeId !== row.accountTypeId
      )
        throw new BadRequestException(
          'Balance sheet classification must belong to the selected company and account type.',
        );
    }
    if (
      dto.accountSubtypeId &&
      !(await this.subtypes.exists({
        where: { accountSubtypeId: dto.accountSubtypeId },
      }))
    )
      throw new BadRequestException('Account subtype does not exist.');

    const values: Partial<MainAccount> = {};
    if (dto.description !== undefined)
      values.description = dto.description.trim();
    if (dto.shortName !== undefined)
      values.shortName = dto.shortName.trim() || null;
    if (dto.balanceSheetId !== undefined)
      values.balanceSheetId = dto.balanceSheetId;
    if (dto.accountSubtypeId !== undefined)
      values.accountSubtypeId = dto.accountSubtypeId;
    if (Object.keys(values).length)
      await this.mainAccounts.update({ mainAccountId: id }, values);
    return this.findOne(id);
  }

  async remove(id: string) {
    const row = await this.findOne(id);
    if (await this.accounts.exists({ where: { mainAccountId: id } }))
      throw new ConflictException(
        'This main account still has chart of accounts. Delete or move them first.',
      );
    try {
      await this.mainAccounts.delete({ mainAccountId: id });
    } catch (error) {
      if (isForeignKeyViolation(error))
        throw new ConflictException('This main account is still in use.');
      throw error;
    }
    return { deleted: true };
  }
}
