import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { AccountingPeriod } from '../accounting-periods/accounting-period.entity';
import { JournalEntry } from '../journals/journal-entry.entity';
import { FixedAsset } from './fixed-asset.entity';

@Entity({ schema: 'assets', name: 'asset_depreciations' })
@Unique('asset_depreciations_asset_id_period_id_key', ['assetId', 'periodId'])
@Check('chk_depreciation_amount', 'amount > 0')
export class AssetDepreciation {
  @PrimaryGeneratedColumn('uuid', { name: 'depreciation_id' })
  depreciationId: string;

  @Column({ name: 'asset_id', type: 'uuid' })
  assetId: string;

  @ManyToOne(() => FixedAsset, { onDelete: 'CASCADE', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'asset_id', referencedColumnName: 'assetId' })
  asset: FixedAsset;

  @Column({ name: 'period_id', type: 'uuid' })
  periodId: string;

  @ManyToOne(() => AccountingPeriod, { onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'period_id', referencedColumnName: 'periodId' })
  period: AccountingPeriod;

  @Column({ name: 'depreciation_date', type: 'date' })
  depreciationDate: string;

  @Column({ type: 'numeric', precision: 20, scale: 2 })
  amount: string;

  @Column({ name: 'journal_entry_id', type: 'uuid', nullable: true })
  journalEntryId: string | null;

  @ManyToOne(() => JournalEntry, { nullable: true, onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'journal_entry_id', referencedColumnName: 'journalEntryId' })
  journalEntry: JournalEntry | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}