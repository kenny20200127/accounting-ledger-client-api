import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { AccountingPeriod } from './accounting-period.entity';
import { CreateAccountingPeriodDto } from './dto/create-accounting-period.dto';
import { FiscalYear } from '../fiscal-years/fiscal-year.entity';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type PeriodStatusRow = {
    periodId: string;
    periodNumber: number;
    periodName: string;
    startDate: string;
    endDate: string;
    isOpen: boolean;
    isClosed: boolean;
    closedAt: Date | null;
    closedBy: string | null;
    unpostedJournals: number;
    postedJournals: number;
    ledgerDocuments: number;
};

@Injectable()
export class AccountingPeriodsService {
    constructor(
        @InjectRepository(AccountingPeriod)
        private readonly periodRepository: Repository<AccountingPeriod>,

        @InjectRepository(FiscalYear)
        private readonly fiscalYearRepository: Repository<FiscalYear>,

        @InjectDataSource()
        private readonly dataSource: DataSource,

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

    async closingStatus(fiscalYearId: string) {
        const fiscalYear = await this.fiscalYearRepository.findOne({
            where: { fiscalYearId },
        });
        if (!fiscalYear) {
            throw new NotFoundException('Fiscal year not found.');
        }

        const periods: PeriodStatusRow[] = await this.dataSource.query(
            `SELECT p.period_id AS "periodId", p.period_number AS "periodNumber",
                    p.period_name AS "periodName", p.start_date::text AS "startDate",
                    p.end_date::text AS "endDate", p.is_open AS "isOpen",
                    p.is_closed AS "isClosed", p.closed_at AS "closedAt", p.closed_by AS "closedBy",
                    (SELECT COUNT(*) FROM accounting.journal_entries j
                      WHERE j.company_id = $2 AND j.transaction_date BETWEEN p.start_date AND p.end_date
                        AND j.status IN ('DRAFT', 'PENDING', 'APPROVED'))::int AS "unpostedJournals",
                    (SELECT COUNT(*) FROM accounting.journal_entries j
                      WHERE j.company_id = $2 AND j.transaction_date BETWEEN p.start_date AND p.end_date
                        AND j.status IN ('POSTED', 'REVERSED'))::int AS "postedJournals",
                    (SELECT COUNT(DISTINCT h.doc_no) FROM ledger.histories h
                      WHERE h.company_id = $2 AND h.doc_date BETWEEN p.start_date AND p.end_date)::int AS "ledgerDocuments"
             FROM accounting.accounting_periods p
             WHERE p.fiscal_year_id = $1
             ORDER BY p.start_date, p.period_number`,
            [fiscalYearId, fiscalYear.companyId],
        );

        const [closingJournal] = await this.dataSource.query(
            `SELECT j.journal_entry_id AS "journalEntryId", j.journal_number::text AS "journalNumber",
                    j.transaction_date::text AS "transactionDate", j.reference_number AS "referenceNumber",
                    j.total_debit AS "totalDebit", j.total_credit AS "totalCredit",
                    (SELECT COUNT(*) FROM accounting.journal_entry_lines l
                      WHERE l.journal_entry_id = j.journal_entry_id)::int AS "lines"
             FROM accounting.journal_entries j
             WHERE j.company_id = $1 AND j.source_type = 'YEAR_END_CLOSE' AND j.source_id = $2
             ORDER BY j.transaction_date DESC, j.journal_number DESC
             LIMIT 1`,
            [fiscalYear.companyId, fiscalYearId],
        );

        const totals = {
            periods: periods.length,
            openPeriods: periods.filter((period) => period.isOpen && !period.isClosed).length,
            lockedPeriods: periods.filter((period) => !period.isOpen && !period.isClosed).length,
            closedPeriods: periods.filter((period) => period.isClosed).length,
            unpostedJournals: periods.reduce((sum, period) => sum + period.unpostedJournals, 0),
            postedJournals: periods.reduce((sum, period) => sum + period.postedJournals, 0),
            ledgerDocuments: periods.reduce((sum, period) => sum + period.ledgerDocuments, 0),
        };

        return {
            fiscalYear,
            periods,
            totals,
            closingJournal: closingJournal ?? null,
            canCloseYear:
                !fiscalYear.isClosed &&
                periods.length > 0 &&
                totals.unpostedJournals === 0,
        };
    }

    async generateMissing(fiscalYearId: string, userId?: string) {
        const fiscalYear = await this.fiscalYearRepository.findOne({
            where: { fiscalYearId },
        });
        if (!fiscalYear) {
            throw new NotFoundException('Fiscal year not found.');
        }
        if (fiscalYear.isClosed) {
            throw new BadRequestException('Cannot add periods to a closed fiscal year.');
        }

        const existing = await this.periodRepository.find({
            where: { fiscalYearId },
        });
        const usedNumbers = new Set(existing.map((period) => period.periodNumber));
        const nextNumber = () => {
            let number = 1;
            while (usedNumbers.has(number)) number++;
            return number;
        };
        const overlaps = (start: string, end: string) =>
            existing.some((period) => period.startDate <= end && period.endDate >= start);

        const yearStart = new Date(`${fiscalYear.startDate}T00:00:00Z`);
        const yearEnd = new Date(`${fiscalYear.endDate}T00:00:00Z`);
        const cursor = new Date(Date.UTC(yearStart.getUTCFullYear(), yearStart.getUTCMonth(), 1));
        const created: AccountingPeriod[] = [];

        while (cursor <= yearEnd) {
            const monthStart = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1));
            const monthEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0));
            const start = monthStart < yearStart ? fiscalYear.startDate : isoDate(monthStart);
            const end = monthEnd > yearEnd ? fiscalYear.endDate : isoDate(monthEnd);
            if (!overlaps(start, end)) {
                const periodNumber = nextNumber();
                usedNumbers.add(periodNumber);
                created.push(
                    this.periodRepository.create({
                        fiscalYearId,
                        periodNumber,
                        periodName: `${MONTHS[monthStart.getUTCMonth()]} ${monthStart.getUTCFullYear()}`,
                        startDate: start,
                        endDate: end,
                        isOpen: true,
                        isClosed: false,
                        closedAt: null,
                        closedBy: null,
                    }),
                );
            }
            cursor.setUTCMonth(cursor.getUTCMonth() + 1);
        }

        if (!created.length) return { created: 0, periods: [] };
        const periods = await this.periodRepository.save(created);
        await this.audit(
            fiscalYear.companyId,
            userId,
            'ACCOUNTING_PERIODS_GENERATED',
            fiscalYearId,
            { created: periods.length },
        );
        return { created: periods.length, periods };
    }

    async close(
        id: string,
        closedBy?: string,
    ): Promise<AccountingPeriod> {
        const period = await this.findOne(id);

        if (period.isClosed) {
            throw new BadRequestException('This accounting period is already closed.');
        }

        const fiscalYear = await this.fiscalYearFor(period);
        if (fiscalYear.isClosed) {
            throw new BadRequestException(
                'This fiscal year is closed. Reopen the year before closing its months.',
            );
        }

        const [{ count }] = await this.dataSource.query(
            `SELECT COUNT(*)::int AS count FROM accounting.journal_entries
             WHERE company_id = $1 AND transaction_date BETWEEN $2 AND $3
               AND status IN ('DRAFT', 'PENDING', 'APPROVED')`,
            [fiscalYear.companyId, period.startDate, period.endDate],
        );
        if (count > 0) {
            throw new BadRequestException(
                `${count} unposted journal${count === 1 ? '' : 's'} in ${period.periodName}. Post or cancel ${count === 1 ? 'it' : 'them'} before closing the month.`,
            );
        }

        period.isOpen = false;
        period.isClosed = true;
        period.closedAt = new Date();
        period.closedBy = closedBy ?? null;

        const saved = await this.periodRepository.save(period);
        await this.audit(
            fiscalYear.companyId,
            closedBy,
            'ACCOUNTING_PERIOD_CLOSED',
            period.periodId,
            { periodName: period.periodName, startDate: period.startDate, endDate: period.endDate },
        );
        return saved;

    }

    async reopen(id: string, userId?: string): Promise<AccountingPeriod> {
        const period = await this.findOne(id);
        const fiscalYear = await this.fiscalYearFor(period);

        if (fiscalYear.isClosed) {
            throw new BadRequestException(
                'This fiscal year is closed. Reopen the year before reopening its months.',
            );
        }

        period.isOpen = true;
        period.isClosed = false;
        period.closedAt = null;
        period.closedBy = null;

        const saved = await this.periodRepository.save(period);
        await this.audit(
            fiscalYear.companyId,
            userId,
            'ACCOUNTING_PERIOD_REOPENED',
            period.periodId,
            { periodName: period.periodName },
        );
        return saved;

    }

    private async fiscalYearFor(period: AccountingPeriod): Promise<FiscalYear> {
        const fiscalYear = await this.fiscalYearRepository.findOne({
            where: { fiscalYearId: period.fiscalYearId },
        });
        if (!fiscalYear) throw new NotFoundException('Fiscal year not found.');
        return fiscalYear;
    }

    private async audit(
        companyId: string,
        userId: string | undefined,
        action: string,
        recordId: string,
        values: object = {},
    ) {
        await this.dataSource.query(
            'INSERT INTO audit.audit_logs(company_id,user_id,action,record_id,new_values) VALUES($1,$2,$3,$4,$5)',
            [companyId, userId ?? null, action, recordId, JSON.stringify(values)],
        );
    }
}

function isoDate(date: Date): string {
    return date.toISOString().slice(0, 10);
}
