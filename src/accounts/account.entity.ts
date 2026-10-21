import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Company } from '../companies/company.entity';
import { AccountCategory } from './account-category.entity';
import { AccountType } from './account-type.entity';

@Entity({ schema: 'accounting', name: 'accounts' })
@Index('uq_company_account_code', ['companyId', 'accountCode'], { unique: true })
@Index('idx_accounts_company', ['companyId'])
@Index('idx_accounts_parent', ['parentAccountId'])
export class Account {
  @PrimaryGeneratedColumn('uuid', { name: 'account_id' })
  accountId: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'company_id', referencedColumnName: 'companyId' })
  company: Company;

  @Column({ name: 'parent_account_id', type: 'uuid', nullable: true })
  parentAccountId?: string | null;

  @ManyToOne(() => Account, { nullable: true, onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'parent_account_id', referencedColumnName: 'accountId' })
  parentAccount?: Account | null;

  @Column({ name: 'account_type_id', type: 'uuid' })
  accountTypeId: string;

  @ManyToOne(() => AccountType, { onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'account_type_id', referencedColumnName: 'accountTypeId' })
  accountType: AccountType;

  @Column({ name: 'account_category_id', type: 'uuid', nullable: true })
  accountCategoryId?: string | null;

  @ManyToOne(() => AccountCategory, { nullable: true, onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'account_category_id', referencedColumnName: 'accountCategoryId' })
  accountCategory?: AccountCategory | null;

  @Column({ name: 'account_code', type: 'varchar', length: 50 })
  accountCode: string;

  @Column({ name: 'account_name', type: 'varchar', length: 150 })
  accountName: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'is_header', type: 'boolean', default: false })
  isHeader: boolean;

  @Column({ name: 'is_control_account', type: 'boolean', default: false })
  isControlAccount: boolean;

  @Column({ name: 'allow_posting', type: 'boolean', default: true })
  allowPosting: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
