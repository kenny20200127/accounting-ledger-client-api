import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Branch } from '../branches/branch.entity';
import { Company } from '../companies/company.entity';
import { AccountingPeriod } from '../accounting-periods/accounting-period.entity';
import { JournalLine } from './journal-line.entity';

@Entity({ schema: 'accounting', name: 'journal_entries' })
@Index('idx_journal_company', ['companyId'])
@Index('idx_journal_date', ['transactionDate'])
@Index('idx_journal_period', ['periodId'])
@Index('idx_journal_status', ['status'])
@Check('chk_journal_status', "status IN ('DRAFT', 'PENDING', 'APPROVED', 'POSTED', 'REVERSED', 'CANCELLED')")
@Check('chk_journal_amounts', 'total_debit >= 0 AND total_credit >= 0')
export class JournalEntry {
  @PrimaryGeneratedColumn('uuid', { name: 'journal_entry_id' })
  journalEntryId: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'company_id', referencedColumnName: 'companyId' })
  company: Company;

  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId?: string | null;

  @ManyToOne(() => Branch, { nullable: true, onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'branch_id', referencedColumnName: 'branchId' })
  branch?: Branch | null;

  @Column({ name: 'period_id', type: 'uuid' })
  periodId: string;

  @ManyToOne(() => AccountingPeriod, { onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'period_id', referencedColumnName: 'periodId' })
  period: AccountingPeriod;

  @Column({ name: 'journal_number', type: 'bigint', generated: 'increment' })
  journalNumber: string;

  @Column({ name: 'transaction_date', type: 'date' })
  transactionDate: string;

  @Column({ name: 'reference_number', type: 'varchar', length: 100, nullable: true })
  referenceNumber?: string | null;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'source_type', type: 'varchar', length: 50, nullable: true })
  sourceType?: string | null;

  @Column({ name: 'source_id', type: 'uuid', nullable: true })
  sourceId?: string | null;

  @Column({ type: 'varchar', length: 20, default: 'DRAFT' })
  status: string;

  @Column({ name: 'total_debit', type: 'numeric', precision: 20, scale: 2, default: 0 })
  totalDebit: string;

  @Column({ name: 'total_credit', type: 'numeric', precision: 20, scale: 2, default: 0 })
  totalCredit: string;

  @Column({ name: 'posted_at', type: 'timestamptz', nullable: true })
  postedAt?: Date | null;

  @Column({ name: 'posted_by', type: 'uuid', nullable: true })
  postedBy?: string | null;

  @Column({ name: 'reversed_journal_id', type: 'uuid', nullable: true })
  reversedJournalId?: string | null;

  @ManyToOne(() => JournalEntry, { nullable: true, onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'reversed_journal_id', referencedColumnName: 'journalEntryId' })
  reversedJournal?: JournalEntry | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @OneToMany(() => JournalLine, line => line.journalEntry, { cascade: false })
  lines: JournalLine[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
