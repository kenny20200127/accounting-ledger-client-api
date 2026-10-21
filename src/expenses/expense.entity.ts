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
import { Account } from '../accounts/account.entity';
import { Branch } from '../branches/branch.entity';
import { Company } from '../companies/company.entity';
import { JournalEntry } from '../journals/journal-entry.entity';

@Entity({ schema: 'purchasing', name: 'expenses' })
@Unique('expenses_company_id_expense_number_key', ['companyId', 'expenseNumber'])
@Check('chk_expense_amount', 'amount > 0')
export class Expense {
  @PrimaryGeneratedColumn('uuid', { name: 'expense_id' })
  expenseId: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'company_id', referencedColumnName: 'companyId' })
  company: Company;

  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId: string | null;

  @ManyToOne(() => Branch, { nullable: true, onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'branch_id', referencedColumnName: 'branchId' })
  branch: Branch | null;

  @Column({ name: 'expense_number', type: 'varchar', length: 100 })
  expenseNumber: string;

  @Column({ name: 'expense_date', type: 'date' })
  expenseDate: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'expense_account_id', type: 'uuid' })
  expenseAccountId: string;

  @ManyToOne(() => Account, { onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'expense_account_id', referencedColumnName: 'accountId' })
  expenseAccount: Account;

  @Column({ name: 'payment_account_id', type: 'uuid', nullable: true })
  paymentAccountId: string | null;

  @ManyToOne(() => Account, { nullable: true, onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'payment_account_id', referencedColumnName: 'accountId' })
  paymentAccount: Account | null;

  @Column({ type: 'numeric', precision: 20, scale: 2 })
  amount: string;

  @Column({ name: 'tax_amount', type: 'numeric', precision: 20, scale: 2, default: 0 })
  taxAmount: string;

  @Column({ name: 'total_amount', type: 'numeric', precision: 20, scale: 2 })
  totalAmount: string;

  @Column({ name: 'journal_entry_id', type: 'uuid', nullable: true })
  journalEntryId: string | null;

  @ManyToOne(() => JournalEntry, { nullable: true, onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'journal_entry_id', referencedColumnName: 'journalEntryId' })
  journalEntry: JournalEntry | null;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'DRAFT' })
  status: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}