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
import { AccountSubtype } from './account-subtype.entity';
import { AccountType } from './account-type.entity';
import { BalanceSheetClassification } from './balance-sheet-classification.entity';

@Entity({ schema: 'accounting', name: 'main_accounts' })
@Index('uq_main_accounts_company_code', ['companyId', 'mainCode'], {
  unique: true,
})
@Index('ix_main_accounts_company_type', ['companyId', 'accountTypeId'])
export class MainAccount {
  @PrimaryGeneratedColumn('uuid', { name: 'main_account_id' })
  mainAccountId: string;

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

  @Column({ name: 'balance_sheet_id', type: 'uuid' })
  balanceSheetId: string;

  @ManyToOne(() => BalanceSheetClassification, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn({
    name: 'balance_sheet_id',
    referencedColumnName: 'balanceSheetId',
  })
  balanceSheet: BalanceSheetClassification;

  @Column({ name: 'account_subtype_id', type: 'uuid' })
  accountSubtypeId: string;

  @ManyToOne(() => AccountSubtype, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn({
    name: 'account_subtype_id',
    referencedColumnName: 'accountSubtypeId',
  })
  accountSubtype: AccountSubtype;

  @Column({ name: 'main_code', type: 'varchar', length: 20 })
  mainCode: string;

  @Column({ type: 'varchar', length: 150 })
  description: string;

  @Column({ name: 'short_name', type: 'varchar', length: 50, nullable: true })
  shortName: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
