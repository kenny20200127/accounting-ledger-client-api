import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Branch } from '../branches/branch.entity';
import { Company } from '../companies/company.entity';
import { Customer } from '../customers/customer.entity';
import { JournalEntry } from '../journals/journal-entry.entity';
import { InvoiceLine } from './invoice-line.entity';

@Entity({ schema: 'sales', name: 'invoices' })
@Unique('invoices_company_id_invoice_number_key', ['companyId', 'invoiceNumber'])
export class Invoice {
  @PrimaryGeneratedColumn('uuid', { name: 'invoice_id' })
  invoiceId: string;

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

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @ManyToOne(() => Customer, { onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'customer_id', referencedColumnName: 'customerId' })
  customer: Customer;

  @Column({ name: 'invoice_number', type: 'varchar', length: 100 })
  invoiceNumber: string;

  @Column({ name: 'invoice_date', type: 'date' })
  invoiceDate: string;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: string | null;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  subtotal: string;

  @Column({ name: 'tax_amount', type: 'numeric', precision: 20, scale: 2, default: 0 })
  taxAmount: string;

  @Column({ name: 'discount_amount', type: 'numeric', precision: 20, scale: 2, default: 0 })
  discountAmount: string;

  @Column({ name: 'total_amount', type: 'numeric', precision: 20, scale: 2, default: 0 })
  totalAmount: string;

  @Column({ name: 'amount_paid', type: 'numeric', precision: 20, scale: 2, default: 0 })
  amountPaid: string;

  @Column({
    name: 'balance_due',
    type: 'numeric',
    precision: 20,
    scale: 2,
    asExpression: 'total_amount - amount_paid',
    generatedType: 'STORED',
  })
  balanceDue: string;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'DRAFT' })
  status: string;

  @Column({ name: 'journal_entry_id', type: 'uuid', nullable: true })
  journalEntryId: string | null;

  @ManyToOne(() => JournalEntry, { nullable: true, onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'journal_entry_id', referencedColumnName: 'journalEntryId' })
  journalEntry: JournalEntry | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @OneToMany(() => InvoiceLine, line => line.invoice)
  lines: InvoiceLine[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}