import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity({ schema: 'ledger', name: 'monthly_balances' })
@Unique('uq_monthly_balances_account_period', ['companyId', 'accountId', 'budgetYear', 'monthNumber'])
export class MonthlyBalance {
  @PrimaryGeneratedColumn('uuid', { name: 'monthly_balance_id' })
  monthlyBalanceId: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId: string;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string;

  @Column({ name: 'budget_year', type: 'smallint' })
  budgetYear: number;

  // 1-12 = calendar month movement; 0 = annual figure (legacy prior-year columns).
  @Column({ name: 'month_number', type: 'smallint' })
  monthNumber: number;

  @Column({ name: 'net_amount', type: 'numeric', precision: 18, scale: 2, default: 0 })
  netAmount: string;

  @Column({ name: 'legacy_ref', type: 'varchar', length: 120, nullable: true })
  legacyRef?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
