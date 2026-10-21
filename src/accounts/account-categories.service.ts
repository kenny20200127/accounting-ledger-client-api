import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { AccountCategory } from './account-category.entity';
import { AccountType } from './account-type.entity';
import { CreateAccountCategoryDto } from './dto/create-account-category.dto';

@Injectable()
export class AccountCategoriesService {
  constructor(
    @InjectRepository(AccountCategory)
    private readonly categories: Repository<AccountCategory>,
    @InjectRepository(AccountType)
    private readonly types: Repository<AccountType>,
  ) {}

  async create(dto: CreateAccountCategoryDto): Promise<AccountCategory> {
    if (!(await this.types.exists({ where: { accountTypeId: dto.accountTypeId } }))) {
      throw new BadRequestException('Account type does not exist.');
    }
    try {
      return await this.categories.save(this.categories.create(dto));
    } catch (error) {
      if (error instanceof QueryFailedError && (error as any).driverError?.code === '23505') {
        throw new ConflictException('This category code already exists for the account type.');
      }
      throw error;
    }
  }

  findAll(accountTypeId: string): Promise<AccountCategory[]> {
    return this.categories.find({
      where: { accountTypeId },
      order: { code: 'ASC' },
    });
  }

  async findOne(id: string): Promise<AccountCategory> {
    const category = await this.categories.findOne({ where: { accountCategoryId: id } });
    if (!category) throw new NotFoundException('Account category not found.');
    return category;
  }
}