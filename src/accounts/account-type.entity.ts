import { Check, Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity({ schema: 'accounting', name: 'account_types' })
@Unique('account_types_code_key', ['code'])
@Check('chk_normal_balance', "normal_balance IN ('DEBIT', 'CREDIT')")
export class AccountType {
  @PrimaryGeneratedColumn('uuid', { name: 'account_type_id' })
  accountTypeId: string;

  @Column({ type: 'varchar', length: 30 })
  code: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'normal_balance', type: 'varchar', length: 10 })
  normalBalance: 'DEBIT' | 'CREDIT';
}
