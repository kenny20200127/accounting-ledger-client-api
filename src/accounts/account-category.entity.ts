import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { AccountType } from './account-type.entity';

@Entity({ schema: 'accounting', name: 'account_categories' })
@Unique('account_categories_account_type_id_code_key', ['accountTypeId', 'code'])
export class AccountCategory {
  @PrimaryGeneratedColumn('uuid', { name: 'account_category_id' })
  accountCategoryId: string;

  @Column({ name: 'account_type_id', type: 'uuid' })
  accountTypeId: string;

  @ManyToOne(() => AccountType, { onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'account_type_id', referencedColumnName: 'accountTypeId' })
  accountType: AccountType;

  @Column({ type: 'varchar', length: 50 })
  code: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;
}