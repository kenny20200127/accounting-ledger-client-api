import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { Account } from '../accounts/account.entity';
import { Company } from '../companies/company.entity';

@Entity({ schema: 'banking', name: 'bank_accounts' })
export class BankAccount {
    @PrimaryGeneratedColumn('uuid', { name: 'bank_account_id' })
    bankAccountId: string;

    @Column({ name: 'company_id', type: 'uuid' })
    companyId: string;

    @ManyToOne(() => Company, { onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
    @JoinColumn({ name: 'company_id', referencedColumnName: 'companyId' })
    company: Company;

    @Column({ name: 'account_id', type: 'uuid' })
    accountId: string;

    @ManyToOne(() => Account, { onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
    @JoinColumn({ name: 'account_id', referencedColumnName: 'accountId' })
    account: Account;

    @Column({ name: 'bank_name', type: 'varchar', length: 150 })
    bankName: string;

    @Column({ name: 'account_name', type: 'varchar', length: 200 })
    accountName: string;

    @Column({ name: 'account_number', type: 'varchar', length: 100, nullable: true })
    accountNumber: string | null;

    @Column({ name: 'currency', type: 'varchar', length: 10, default: 'NGN' })
    currency: string;

    @Column({ name: 'opening_balance', type: 'numeric', precision: 20, scale: 2, default: 0 })
    openingBalance: string;

    @Column({ name: 'current_balance', type: 'numeric', precision: 20, scale: 2, default: 0 })
    currentBalance: string;

    @Column({ name: 'is_active', type: 'boolean', default: true })
    isActive: boolean;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;

}