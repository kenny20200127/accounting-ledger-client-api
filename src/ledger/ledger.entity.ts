import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Account } from '../accounts/account.entity';
import { Branch } from '../branches/branch.entity';
import { Company } from '../companies/company.entity';

@Entity({ schema: 'ledger', name: 'ledgers' })
@Unique('uq_ledgers_company_account', ['companyId', 'accountId'])
export class Ledger {
  @PrimaryGeneratedColumn('uuid', { name: 'ledger_id' })
  ledgerId: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'company_id', referencedColumnName: 'companyId' })
  company: Company;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string;

  @ManyToOne(() => Account, { onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'account_id', referencedColumnName: 'accountId' })
  account: Account;

  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId?: string | null;

  @ManyToOne(() => Branch, { nullable: true, onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'branch_id', referencedColumnName: 'branchId' })
  branch?: Branch | null;

  @Column({ name: 'opening_balance', type: 'numeric', precision: 18, scale: 2, default: 0 })
  openingBalance: string;

  @Column({ name: 'debit_balance', type: 'numeric', precision: 18, scale: 2, default: 0 })
  debitBalance: string;

  @Column({ name: 'credit_balance', type: 'numeric', precision: 18, scale: 2, default: 0 })
  creditBalance: string;

  @Column({ name: 'budget_amount', type: 'numeric', precision: 18, scale: 2, default: 0 })
  budgetAmount: string;

  @Column({ name: 'pl_balance', type: 'numeric', precision: 18, scale: 2, default: 0 })
  plBalance: string;

  @Column({ name: 'transaction_count', type: 'bigint', default: 0 })
  transactionCount: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz', nullable: true })
  updatedAt?: Date | null;
}
