import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Company } from '../companies/company.entity';
import { AccountType } from './account-type.entity';

@Entity({ schema: 'accounting', name: 'balance_sheet_classifications' })
@Index('uq_balance_sheets_company_code', ['companyId', 'code'], {
  unique: true,
})
@Index('ix_balance_sheets_company_type', ['companyId', 'accountTypeId'])
export class BalanceSheetClassification {
  @PrimaryGeneratedColumn('uuid', { name: 'balance_sheet_id' })
  balanceSheetId: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'company_id', referencedColumnName: 'companyId' })
  company: Company;

  @Column({ name: 'account_type_id', type: 'uuid' })
  accountTypeId: string;

  @ManyToOne(() => AccountType, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn({ name: 'account_type_id', referencedColumnName: 'accountTypeId' })
  accountType: AccountType;

  @Column({ type: 'varchar', length: 10 })
  code: string;

  @Column({ type: 'varchar', length: 150 })
  description: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
