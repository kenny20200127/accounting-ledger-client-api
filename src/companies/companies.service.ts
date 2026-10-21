import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Company } from './company.entity';
import { CreateCompanyDto } from './dto/create-company.dto';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
  ) {}

  async create(dto: CreateCompanyDto): Promise<Company> {
    const company = this.companyRepository.create({
      ...dto,
      baseCurrency: dto.baseCurrency?.toUpperCase() ?? 'NGN',
    });

    try {
      return await this.companyRepository.save(company);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error as any).driverError?.code === '23505'
      ) {
        throw new ConflictException(
          'A company with this company code already exists.',
        );
      }

      throw error;
    }
  }

  async findAll(): Promise<Company[]> {
    return this.companyRepository.find({
      order: { companyName: 'ASC' },
    });
  }

  async findOne(companyId: string): Promise<Company> {
    const company = await this.companyRepository.findOne({
      where: { companyId },
    });

    if (!company) {
      throw new NotFoundException('Company not found.');
    }

    return company;
  }
}