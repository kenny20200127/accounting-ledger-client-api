import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { AccountType } from './account-type.entity';
import { CreateAccountTypeDto } from './dto/create-account-type.dto';

@Injectable()
export class AccountTypesService {
  constructor(
    @InjectRepository(AccountType)
    private readonly accountTypes: Repository<AccountType>,
  ) {}

  async create(dto: CreateAccountTypeDto): Promise<AccountType> {
    try {
      return await this.accountTypes.save(this.accountTypes.create(dto));
    } catch (error) {
      if (error instanceof QueryFailedError && (error as any).driverError?.code === '23505') {
        throw new ConflictException('An account type with this code already exists.');
      }
      throw error;
    }
  }

  findAll(): Promise<AccountType[]> {
    return this.accountTypes.find({ order: { code: 'ASC' } });
  }

  async findOne(id: string): Promise<AccountType> {
    const accountType = await this.accountTypes.findOne({ where: { accountTypeId: id } });
    if (!accountType) throw new NotFoundException('Account type not found.');
    return accountType;
  }
}