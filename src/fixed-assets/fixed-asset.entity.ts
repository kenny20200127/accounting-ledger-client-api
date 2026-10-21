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
import { Account } from '../accounts/account.entity';
import { Company } from '../companies/company.entity';

@Entity({ schema: 'assets', name: 'fixed_assets' })
@Index('fixed_assets_company_id_asset_code_key', ['companyId', 'assetCode'], {
  unique: true,
})
@Check('chk_asset_cost', 'purchase_cost >= 0')
@Check('chk_useful_life', 'useful_life_months > 0')
export class FixedAsset {
  @PrimaryGeneratedColumn('uuid', { name: 'asset_id' })
  assetId: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'company_id', referencedColumnName: 'companyId' })
  company: Company;

  @Column({ name: 'asset_code', type: 'varchar', length: 50 })
  assetCode: string;

  @Column({ name: 'asset_name', type: 'varchar', length: 200 })
  assetName: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'purchase_date', type: 'date' })
  purchaseDate: string;

  @Column({ name: 'purchase_cost', type: 'numeric', precision: 20, scale: 2 })
  purchaseCost: string;

  @Column({ name: 'salvage_value', type: 'numeric', precision: 20, scale: 2, default: 0 })
  salvageValue: string;

  @Column({ name: 'useful_life_months', type: 'integer' })
  usefulLifeMonths: number;

  @Column({ name: 'accumulated_depreciation', type: 'numeric', precision: 20, scale: 2, default: 0 })
  accumulatedDepreciation: string;

  @Column({ name: 'asset_account_id', type: 'uuid' })
  assetAccountId: string;

  @ManyToOne(() => Account, { onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'asset_account_id', referencedColumnName: 'accountId' })
  assetAccount: Account;

  @Column({ name: 'depreciation_account_id', type: 'uuid' })
  depreciationAccountId: string;

  @ManyToOne(() => Account, { onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'depreciation_account_id', referencedColumnName: 'accountId' })
  depreciationAccount: Account;

  @Column({ name: 'accumulated_depreciation_account_id', type: 'uuid' })
  accumulatedDepreciationAccountId: string;

  @ManyToOne(() => Account, { onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
  @JoinColumn({
    name: 'accumulated_depreciation_account_id',
    referencedColumnName: 'accountId',
  })
  accumulatedDepreciationAccount: Account;

  @Column({ name: 'status', type: 'varchar', length: 30, default: 'ACTIVE' })
  status: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}