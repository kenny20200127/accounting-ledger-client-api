import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { AccountingPeriod } from './accounting-period.entity';
import { CreateAccountingPeriodDto } from './dto/create-accounting-period.dto';
import { FiscalYear } from '../fiscal-years/fiscal-year.entity';

@Injectable()
export class AccountingPeriodsService {
    constructor(
        @InjectRepository(AccountingPeriod)
        private readonly periodRepository: Repository<AccountingPeriod>,

        @InjectRepository(FiscalYear)
        private readonly fiscalYearRepository: Repository<FiscalYear>,

    ) { }

    async create(
        dto: CreateAccountingPeriodDto,
    ): Promise<AccountingPeriod> {
        if (dto.startDate > dto.endDate) {
            throw new BadRequestException(
                'Start date cannot be later than end date.',
            );
        }

        const fiscalYear = await this.fiscalYearRepository.findOne({
            where: { fiscalYearId: dto.fiscalYearId },
        });

        if (!fiscalYear) {
            throw new NotFoundException('Fiscal year not found.');
        }

        if (fiscalYear.isClosed) {
            throw new BadRequestException('Cannot add periods to a closed fiscal year.');
        }

        if (
            dto.startDate < fiscalYear.startDate ||
            dto.endDate > fiscalYear.endDate
        ) {
            throw new BadRequestException(
                'Accounting period dates must fall within the fiscal year.',
            );
        }

        const existingPeriod = await this.periodRepository.findOne({
            where: {
                fiscalYearId: dto.fiscalYearId,
                periodNumber: dto.periodNumber,
            },
        });

        if (existingPeriod) {
            throw new ConflictException(
                'This period number already exists for the fiscal year.',
            );
        }

        const period = this.periodRepository.create({
            fiscalYearId: dto.fiscalYearId,
            periodNumber: dto.periodNumber,
            periodName: dto.periodName,
            startDate: dto.startDate,
            endDate: dto.endDate,
            isOpen: true,
            isClosed: false,
            closedAt: null,
            closedBy: null,
        });

        try {
            return await this.periodRepository.save(period);
        } catch (error) {
            if (
                error instanceof QueryFailedError &&
                (error as any).driverError?.code === '23505'
            ) {
                throw new ConflictException(
                    'This period number already exists for the fiscal year.',
                );
            }

            throw error;
        }

    }

    async findAll(fiscalYearId?: string, companyId?: string): Promise<AccountingPeriod[]> {
        if (fiscalYearId) {
            const fiscalYear = await this.fiscalYearRepository.findOne({
                where: { fiscalYearId },
            });

            if (!fiscalYear) {
                throw new NotFoundException('Fiscal year not found.');
            }

            return this.periodRepository.find({
                where: { fiscalYearId },
                order: { periodNumber: 'ASC' },
            });
        }

        if (companyId) return this.periodRepository.createQueryBuilder('p').innerJoin(FiscalYear, 'f', 'f.fiscalYearId = p.fiscalYearId').where('f.companyId = :companyId', {companyId}).orderBy('p.startDate', 'DESC').addOrderBy('p.periodNumber', 'ASC').getMany();
        return this.periodRepository.find({
            order: { startDate: 'DESC', periodNumber: 'ASC' },
        });

    }

    async findOne(id: string): Promise<AccountingPeriod> {
        const period = await this.periodRepository.findOne({
            where: { periodId: id },
        });

        if (!period) {
            throw new NotFoundException('Accounting period not found.');
        }

        return period;

    }

    async close(
        id: string,
        closedBy?: string,
    ): Promise<AccountingPeriod> {
        const period = await this.findOne(id);

        if (period.isClosed) {
            throw new BadRequestException('This accounting period is already closed.');
        }

        period.isOpen = false;
        period.isClosed = true;
        period.closedAt = new Date();
        period.closedBy = closedBy ?? null;

        return this.periodRepository.save(period);

    }

    async reopen(id: string): Promise<AccountingPeriod> {
        const period = await this.findOne(id);

        period.isOpen = true;
        period.isClosed = false;
        period.closedAt = null;
        period.closedBy = null;

        return this.periodRepository.save(period);

    }
}
