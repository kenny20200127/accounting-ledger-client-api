import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Account } from '../accounts/account.entity';
import { Invoice } from './invoice.entity';

@Entity({ schema: 'sales', name: 'invoice_lines' })
@Check('chk_invoice_quantity', 'quantity > 0')
export class InvoiceLine {
  @PrimaryGeneratedColumn('uuid', { name: 'invoice_line_id' })
  invoiceLineId: string;

  @Column({ name: 'invoice_id', type: 'uuid' })
  invoiceId: string;

  @ManyToOne(() => Invoice, invoice => invoice.lines, {
    onDelete: 'CASCADE',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn({ name: 'invoice_id', referencedColumnName: 'invoiceId' })
  invoice: Invoice;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'numeric', precision: 20, scale: 4, default: 1 })
  quantity: string;

  @Column({ name: 'unit_price', type: 'numeric', precision: 20, scale: 2, default: 0 })
  unitPrice: string;

  @Column({ name: 'discount_amount', type: 'numeric', precision: 20, scale: 2, default: 0 })
  discountAmount: string;

  @Column({ name: 'tax_amount', type: 'numeric', precision: 20, scale: 2, default: 0 })
  taxAmount: string;

  @Column({ name: 'revenue_account_id', type: 'uuid' })
  revenueAccountId: string;

  @ManyToOne(() => Account, { onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'revenue_account_id', referencedColumnName: 'accountId' })
  revenueAccount: Account;

  @Column({ name: 'line_total', type: 'numeric', precision: 20, scale: 2, default: 0 })
  lineTotal: string;
}