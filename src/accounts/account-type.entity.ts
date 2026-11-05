import { Check, Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity({ schema: 'accounting', name: 'account_types' })
@Unique('account_types_code_key', ['code'])
@Check('chk_normal_balance', "normal_balance IN ('DEBIT', 'CREDIT')")
@Check('chk_account_types_code_prefix', "code_prefix IN ('1', '2', '3', '4', '5')")
export class AccountType {
  @PrimaryGeneratedColumn('uuid', { name: 'account_type_id' })
  accountTypeId: string;

  @Column({ type: 'varchar', length: 30 })
  code: string;

  @Column({ name: 'code_prefix', type: 'char', length: 1 })
  codePrefix: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'normal_balance', type: 'varchar', length: 10 })
  normalBalance: 'DEBIT' | 'CREDIT';

  @Column({ type: 'text', nullable: true })
  description: string | null;
}
