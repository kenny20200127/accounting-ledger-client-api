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
  nextBalanceSheetCode,
} from './account-codes';
import { AccountType } from './account-type.entity';
import { BalanceSheetClassification } from './balance-sheet-classification.entity';
import { BalanceSheetListQueryDto } from './dto/balance-sheet-list-query.dto';
import { CreateBalanceSheetDto } from './dto/create-balance-sheet.dto';
import { UpdateBalanceSheetDto } from './dto/update-balance-sheet.dto';
import { MainAccount } from './main-account.entity';

@Injectable()
export class BalanceSheetsService {
  constructor(
    @InjectRepository(BalanceSheetClassification)
    private readonly balanceSheets: Repository<BalanceSheetClassification>,
    @InjectRepository(AccountType)
    private readonly types: Repository<AccountType>,
    @InjectRepository(MainAccount)
    private readonly mainAccounts: Repository<MainAccount>,
    @InjectRepository(Company) private readonly companies: Repository<Company>,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    dto: CreateBalanceSheetDto,
    createdBy?: string,
  ): Promise<BalanceSheetClassification> {
    if (dto.code?.trim())
      throw new BadRequestException(
        'Balance sheet codes are generated automatically and cannot be set manually.',
      );
    const type = await this.types.findOne({
      where: { accountTypeId: dto.accountTypeId },
    });
    if (!type) throw new BadRequestException('Account type does not exist.');
    if (!(await this.companies.exists({ where: { companyId: dto.companyId } })))
      throw new BadRequestException('Company does not exist.');

    for (let attempt = 0; ; attempt++) {
      try {
        return await this.dataSource.transaction(async (manager) => {
          const code = await nextBalanceSheetCode(
            manager,
            dto.companyId,
            dto.accountTypeId,
            type.codePrefix,
          );
          return this.save(manager, {
            companyId: dto.companyId,
            accountTypeId: dto.accountTypeId,
            code,
            description: dto.description.trim(),
            createdBy: createdBy ?? null,
          });
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          if (attempt >= 4)
            throw new ConflictException(
              'Unable to allocate a unique balance sheet code. Please retry.',
            );
          continue;
        }
        throw error;
      }
    }
  }

  private save(
    manager: EntityManager,
    values: Partial<BalanceSheetClassification>,
  ) {
    const repo = manager.getRepository(BalanceSheetClassification);
    return repo.save(repo.create(values));
  }

  findAll(query: BalanceSheetListQueryDto) {
    return findCompanyList(
      this.balanceSheets,
      query,
      {
        relations: { accountType: true },
        order: { code: 'ASC', balanceSheetId: 'ASC' },
      },
      ['code', 'description'],
      query.accountTypeId
        ? { accountTypeId: query.accountTypeId }
        : undefined,
    );
  }

  async findOne(id: string): Promise<BalanceSheetClassification> {
    const row = await this.balanceSheets.findOne({
      where: { balanceSheetId: id },
      relations: { accountType: true },
    });
    if (!row) throw new NotFoundException('Balance sheet classification not found.');
    return row;
  }

  async update(
    id: string,
    dto: UpdateBalanceSheetDto,
  ): Promise<BalanceSheetClassification> {
    if (dto.code !== undefined)
      throw new BadRequestException(
        'Balance sheet codes are generated automatically and cannot be changed.',
      );
    const row = await this.findOne(id);
    await this.balanceSheets.update(
      { balanceSheetId: id },
      { description: dto.description.trim() },
    );
    return this.findOne(row.balanceSheetId);
  }

  async remove(id: string) {
    await this.findOne(id);
    if (await this.mainAccounts.exists({ where: { balanceSheetId: id } }))
      throw new ConflictException(
        'This balance sheet classification still has main accounts. Delete or move them first.',
      );
    try {
      await this.balanceSheets.delete({ balanceSheetId: id });
    } catch (error) {
      if (isForeignKeyViolation(error))
        throw new ConflictException(
          'This balance sheet classification is still in use.',
        );
      throw error;
    }
    return { deleted: true };
  }
}
