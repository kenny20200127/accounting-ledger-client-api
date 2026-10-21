import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Account } from '../accounts/account.entity';
import { Company } from '../companies/company.entity';

@Entity({ schema: 'purchasing', name: 'suppliers' })
@Unique('suppliers_company_id_supplier_code_key', ['companyId', 'supplierCode'])
@Index('idx_supplier_company', ['companyId'])
export class Supplier {
  @PrimaryGeneratedColumn('uuid', { name: 'supplier_id' })
  supplierId: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'company_id', referencedColumnName: 'companyId' })
  company: Company;

  @Column({ name: 'supplier_code', type: 'varchar', length: 50 })
  supplierCode: string;

  @Column({ name: 'supplier_name', type: 'varchar', length: 200 })
  supplierName: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string | null;

  @Column({ name: 'tax_number', type: 'varchar', length: 100, nullable: true })
  taxNumber: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ name: 'payable_account_id', type: 'uuid', nullable: true })
  payableAccountId: string | null;

  @ManyToOne(() => Account, { nullable: true, onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'payable_account_id', referencedColumnName: 'accountId' })
  payableAccount: Account | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}