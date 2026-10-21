import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Company } from '../companies/company.entity';

@Entity({ schema: 'accounting', name: 'fiscal_years' })
@Unique('uq_company_fiscal_year', ['companyId', 'yearName'])
@Check('chk_fiscal_year_dates', 'start_date < end_date')
export class FiscalYear {
  @PrimaryGeneratedColumn('uuid', { name: 'fiscal_year_id' })
  fiscalYearId: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'company_id', referencedColumnName: 'companyId' })
  company: Company;

  @Column({ name: 'year_name', type: 'varchar', length: 20 })
  yearName: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  @Column({ name: 'is_closed', type: 'boolean', default: false })
  isClosed: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}