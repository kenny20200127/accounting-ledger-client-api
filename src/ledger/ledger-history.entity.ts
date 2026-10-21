import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Account } from '../accounts/account.entity';
import { Branch } from '../branches/branch.entity';
import { Company } from '../companies/company.entity';

@Entity({ schema: 'ledger', name: 'histories' })
export class LedgerHistory {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'history_id' })
  historyId: string;

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

  @Column({ name: 'doc_no', type: 'varchar', length: 30 })
  docNo: string;

  @Column({ name: 'doc_type', type: 'varchar', length: 10 })
  docType: string;

  @Column({ name: 'ref_no', type: 'varchar', length: 20, nullable: true })
  refNo?: string | null;

  @Column({ name: 'doc_date', type: 'date' })
  docDate: string;

  @Column({ type: 'varchar', length: 6 })
  period: string;

  @Column({ name: 'debit_amount', type: 'numeric', precision: 18, scale: 2, default: 0 })
  debitAmount: string;

  @Column({ name: 'credit_amount', type: 'numeric', precision: 18, scale: 2, default: 0 })
  creditAmount: string;

  @Column({ name: 'net_amount', type: 'numeric', precision: 18, scale: 2, default: 0 })
  netAmount: string;

  @Column({ type: 'text', nullable: true })
  remarks?: string | null;

  @Column({ name: 'unit_code', type: 'varchar', length: 10, nullable: true })
  unitCode?: string | null;

  @Column({ name: 'legacy_ref', type: 'varchar', length: 120, nullable: true })
  legacyRef?: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
