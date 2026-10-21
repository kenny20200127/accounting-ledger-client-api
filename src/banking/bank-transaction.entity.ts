import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { JournalEntry } from '../journals/journal-entry.entity';
import { BankAccount } from './bank-account.entity';

@Entity({ schema: 'banking', name: 'bank_transactions' })
@Index('idx_bank_transactions_account', ['bankAccountId'])
@Index('idx_bank_transactions_date', ['transactionDate'])
@Check('chk_bank_transaction_type', "transaction_type IN ('DEBIT', 'CREDIT')")
@Check('chk_bank_transaction_amount', 'amount > 0')
export class BankTransaction {
  @PrimaryGeneratedColumn('uuid', { name: 'bank_transaction_id' })
  bankTransactionId: string;

  @Column({ name: 'bank_account_id', type: 'uuid' })
  bankAccountId: string;

  @ManyToOne(() => BankAccount, { onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'bank_account_id', referencedColumnName: 'bankAccountId' })
  bankAccount: BankAccount;

  @Column({ name: 'transaction_date', type: 'date' })
  transactionDate: string;

  @Column({ name: 'value_date', type: 'date', nullable: true })
  valueDate: string | null;

  @Column({ name: 'reference_number', type: 'varchar', length: 150, nullable: true })
  referenceNumber: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'transaction_type', type: 'varchar', length: 20 })
  transactionType: 'DEBIT' | 'CREDIT';

  @Column({ type: 'numeric', precision: 20, scale: 2 })
  amount: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, nullable: true })
  balance: string | null;

  @Column({ name: 'is_reconciled', type: 'boolean', default: false })
  isReconciled: boolean;

  @Column({ name: 'reconciled_at', type: 'timestamptz', nullable: true })
  reconciledAt: Date | null;

  @Column({ name: 'journal_entry_id', type: 'uuid', nullable: true })
  journalEntryId: string | null;

  @ManyToOne(() => JournalEntry, { nullable: true, onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'journal_entry_id', referencedColumnName: 'journalEntryId' })
  journalEntry: JournalEntry | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}