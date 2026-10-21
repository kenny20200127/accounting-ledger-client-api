import {
    Column,
    Check,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    Unique,
} from 'typeorm';
import { FiscalYear } from '../fiscal-years/fiscal-year.entity';

@Entity({ schema: 'accounting', name: 'accounting_periods' })
@Unique('uq_fiscal_period_number', ['fiscalYearId', 'periodNumber'])
@Check('chk_period_dates', 'start_date <= end_date')
export class AccountingPeriod {
    @PrimaryGeneratedColumn('uuid', { name: 'period_id' })
    periodId: string;

    @Column({ name: 'fiscal_year_id', type: 'uuid' })
    fiscalYearId: string;

    @ManyToOne(() => FiscalYear, { onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
    @JoinColumn({ name: 'fiscal_year_id', referencedColumnName: 'fiscalYearId' })
    fiscalYear: FiscalYear;

    @Column({ name: 'period_number', type: 'integer' })
    periodNumber: number;

    @Column({ name: 'period_name', type: 'varchar', length: 50 })
    periodName: string;

    @Column({ name: 'start_date', type: 'date' })
    startDate: string;

    @Column({ name: 'end_date', type: 'date' })
    endDate: string;

    @Column({ name: 'is_open', type: 'boolean', default: true })
    isOpen: boolean;

    @Column({ name: 'is_closed', type: 'boolean', default: false })
    isClosed: boolean;

    @Column({
        name: 'closed_at',
        type: 'timestamptz',
        nullable: true,
    })
    closedAt: Date | null;

    @Column({ name: 'closed_by', type: 'uuid', nullable: true })
    closedBy: string | null;
}
