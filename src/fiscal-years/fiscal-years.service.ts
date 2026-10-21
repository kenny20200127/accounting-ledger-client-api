import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Company } from '../companies/company.entity';
import { CreateFiscalYearDto } from './dto/create-fiscal-year.dto';
import { FiscalYear } from './fiscal-year.entity';

@Injectable()
export class FiscalYearsService {
  constructor(
    @InjectRepository(FiscalYear)
    private readonly fiscalYears: Repository<FiscalYear>,
    @InjectRepository(Company)
    private readonly companies: Repository<Company>,
  ) {}

  async create(dto: CreateFiscalYearDto): Promise<FiscalYear> {
    if (dto.startDate >= dto.endDate) {
      throw new BadRequestException('Fiscal year start date must be before its end date.');
    }
    if (!(await this.companies.exists({ where: { companyId: dto.companyId } }))) {
      throw new BadRequestException('Company does not exist.');
    }
    try {
      return await this.fiscalYears.save(
        this.fiscalYears.create({ ...dto, isClosed: false }),
      );
    } catch (error) {
      if (error instanceof QueryFailedError && (error as any).driverError?.code === '23505') {
        throw new ConflictException('This fiscal year name already exists for the company.');
      }
      throw error;
    }
  }

  findAll(companyId: string): Promise<FiscalYear[]> {
    return this.fiscalYears.find({
      where: { companyId },
      order: { startDate: 'DESC' },
    });
  }

  async findOne(id: string): Promise<FiscalYear> {
    const fiscalYear = await this.fiscalYears.findOne({ where: { fiscalYearId: id } });
    if (!fiscalYear) throw new NotFoundException('Fiscal year not found.');
    return fiscalYear;
  }
}