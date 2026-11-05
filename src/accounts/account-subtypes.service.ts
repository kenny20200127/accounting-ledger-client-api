import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isUniqueViolation } from './account-codes';
import { AccountSubtype } from './account-subtype.entity';
import { CreateAccountSubtypeDto } from './dto/create-account-subtype.dto';

@Injectable()
export class AccountSubtypesService {
  constructor(
    @InjectRepository(AccountSubtype)
    private readonly subtypes: Repository<AccountSubtype>,
  ) {}

  async create(
    dto: CreateAccountSubtypeDto,
    createdBy?: string,
  ): Promise<AccountSubtype> {
    const name = dto.name.trim();
    const code = (dto.code?.trim() || name)
      .replace(/[^A-Za-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase();
    if (!code || code.length > 30)
      throw new BadRequestException(
        'Provide a subtype code of up to 30 characters.',
      );
    try {
      return await this.subtypes.save(
        this.subtypes.create({
          code,
          name,
          description: dto.description?.trim() || null,
          createdBy: createdBy ?? null,
        }),
      );
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException(
          'An account subtype with this code already exists.',
        );
      throw error;
    }
  }

  findAll(): Promise<AccountSubtype[]> {
    return this.subtypes.find({ order: { name: 'ASC', code: 'ASC' } });
  }

  async findOne(id: string): Promise<AccountSubtype> {
    const subtype = await this.subtypes.findOne({
      where: { accountSubtypeId: id },
    });
    if (!subtype) throw new NotFoundException('Account subtype not found.');
    return subtype;
  }
}
