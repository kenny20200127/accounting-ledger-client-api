import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Account } from '../accounts/account.entity';
import { AccountingPeriod } from '../accounting-periods/accounting-period.entity';
import { Company } from '../companies/company.entity';
import { JournalEntry } from '../journals/journal-entry.entity';
import { AssetDepreciation } from './asset-depreciation.entity';
import { CreateAssetDepreciationDto } from './dto/create-asset-depreciation.dto';
import { CreateFixedAssetDto } from './dto/create-fixed-asset.dto';
import { FixedAsset } from './fixed-asset.entity';

@Injectable()
export class FixedAssetsService {
  constructor(
    @InjectRepository(FixedAsset)
    private readonly fixedAssets: Repository<FixedAsset>,
    @InjectRepository(AssetDepreciation)
    private readonly depreciations: Repository<AssetDepreciation>,
    @InjectRepository(Company)
    private readonly companies: Repository<Company>,
    @InjectRepository(Account)
    private readonly accounts: Repository<Account>,
    @InjectRepository(AccountingPeriod)
    private readonly periods: Repository<AccountingPeriod>,
    @InjectRepository(JournalEntry)
    private readonly journals: Repository<JournalEntry>,
  ) {}

  async create(dto: CreateFixedAssetDto): Promise<FixedAsset> {
    if (!(await this.companies.exists({ where: { companyId: dto.companyId } }))) {
      throw new BadRequestException('Company does not exist.');
    }

    const accountIds = [
      dto.assetAccountId,
      dto.depreciationAccountId,
      dto.accumulatedDepreciationAccountId,
    ];
    const accounts = await this.accounts.findBy(
      accountIds.map(accountId => ({ accountId })),
    );
    if (
      new Set(accounts.map(account => account.accountId)).size !==
      new Set(accountIds).size
    ) {
      throw new BadRequestException('One or more asset accounts do not exist.');
    }
    if (accounts.some(account => account.companyId !== dto.companyId)) {
      throw new BadRequestException(
        'All asset accounts must belong to the selected company.',
      );
    }

    const asset = this.fixedAssets.create({
      ...dto,
      salvageValue: dto.salvageValue ?? '0.00',
      accumulatedDepreciation: '0.00',
      status: 'ACTIVE',
    });

    try {
      return await this.fixedAssets.save(asset);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error as any).driverError?.code === '23505'
      ) {
        throw new ConflictException(
          'An asset with this code already exists for the company.',
        );
      }
      throw error;
    }
  }

  findAll(companyId: string): Promise<FixedAsset[]> {
    return this.fixedAssets.find({
      where: { companyId },
      order: { assetCode: 'ASC' },
    });
  }

  async findOne(id: string): Promise<FixedAsset> {
    const asset = await this.fixedAssets.findOne({ where: { assetId: id } });
    if (!asset) throw new NotFoundException('Fixed asset not found.');
    return asset;
  }

  async createDepreciation(
    assetId: string,
    dto: CreateAssetDepreciationDto,
  ): Promise<AssetDepreciation> {
    const asset = await this.findOne(assetId);
    const period = await this.periods.findOne({
      where: { periodId: dto.periodId },
    });
    if (!period || !period.isOpen || period.isClosed) {
      throw new BadRequestException(
        'Accounting period does not exist or is closed.',
      );
    }
    if (
      dto.depreciationDate < period.startDate ||
      dto.depreciationDate > period.endDate
    ) {
      throw new BadRequestException(
        'Depreciation date must fall within the accounting period.',
      );
    }
    if (dto.depreciationDate < asset.purchaseDate) {
      throw new BadRequestException(
        'Depreciation date cannot be before the asset purchase date.',
      );
    }
    if (dto.journalEntryId) {
      const journal = await this.journals.findOne({
        where: { journalEntryId: dto.journalEntryId },
      });
      if (!journal || journal.companyId !== asset.companyId) {
        throw new BadRequestException(
          'Journal entry must exist and belong to the asset company.',
        );
      }
    }

    try {
      return await this.depreciations.save(
        this.depreciations.create({
          ...dto,
          assetId,
          journalEntryId: dto.journalEntryId ?? null,
        }),
      );
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error as any).driverError?.code === '23505'
      ) {
        throw new ConflictException(
          'Depreciation is already recorded for this asset and period.',
        );
      }
      throw error;
    }
  }

  async findDepreciations(assetId: string): Promise<AssetDepreciation[]> {
    await this.findOne(assetId);
    return this.depreciations.find({
      where: { assetId },
      order: { depreciationDate: 'DESC' },
    });
  }
}