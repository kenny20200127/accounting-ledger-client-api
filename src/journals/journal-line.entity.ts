import { Check, Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Account } from '../accounts/account.entity';
import { JournalEntry } from './journal-entry.entity';

@Entity({ schema: 'accounting', name: 'journal_entry_lines' })
@Unique('uq_journal_line_number', ['journalEntryId', 'lineNumber'])
@Check('chk_debit_credit', 'debit_amount >= 0 AND credit_amount >= 0 AND NOT (debit_amount > 0 AND credit_amount > 0)')
@Check('chk_line_amount', 'debit_amount > 0 OR credit_amount > 0')
export class JournalLine {
  @PrimaryGeneratedColumn('uuid', { name: 'journal_line_id' })
  journalLineId: string;

  @Column({ name: 'journal_entry_id', type: 'uuid' })
  journalEntryId: string;

  @ManyToOne(() => JournalEntry, entry => entry.lines, { onDelete: 'CASCADE', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'journal_entry_id', referencedColumnName: 'journalEntryId' })
  journalEntry: JournalEntry;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string;

  @ManyToOne(() => Account, { onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'account_id', referencedColumnName: 'accountId' })
  account: Account;

  @Column({ name: 'line_number', type: 'int' })
  lineNumber: number;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'debit_amount', type: 'numeric', precision: 20, scale: 2, default: 0 })
  debitAmount: string;

  @Column({ name: 'credit_amount', type: 'numeric', precision: 20, scale: 2, default: 0 })
  creditAmount: string;

  @Column({ name: 'reference_number', type: 'varchar', length: 100, nullable: true })
  referenceNumber?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
