import {
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

@Entity({ schema: 'sales', name: 'customers' })
@Index('customers_company_id_customer_code_key', ['companyId', 'customerCode'], {
    unique: true,
})
@Index('idx_customer_company', ['companyId'])
export class Customer {
    @PrimaryGeneratedColumn('uuid', { name: 'customer_id' })
    customerId: string;

    @Column({ name: 'company_id', type: 'uuid' })
    companyId: string;

    @ManyToOne(() => Company, { onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
    @JoinColumn({ name: 'company_id', referencedColumnName: 'companyId' })
    company: Company;

    @Column({ name: 'customer_code', type: 'varchar', length: 50 })
    customerCode: string;

    @Column({ name: 'customer_name', type: 'varchar', length: 200 })
    customerName: string;

    @Column({ type: 'varchar', length: 150, nullable: true })
    email: string | null;

    @Column({ type: 'varchar', length: 50, nullable: true })
    phone: string | null;

    @Column({ name: 'tax_number', type: 'varchar', length: 100, nullable: true })
    taxNumber: string | null;

    @Column({ name: 'billing_address', type: 'text', nullable: true })
    billingAddress: string | null;

    @Column({ name: 'receivable_account_id', type: 'uuid', nullable: true })
    receivableAccountId: string | null;

    @ManyToOne(() => Account, { onDelete: 'NO ACTION', onUpdate: 'NO ACTION', nullable: true })
    @JoinColumn({ name: 'receivable_account_id', referencedColumnName: 'accountId' })
    receivableAccount: Account | null;

    @Column({ name: 'credit_limit', type: 'numeric', precision: 20, scale: 2, default: 0 })
    creditLimit: string;

    @Column({ name: 'is_active', type: 'boolean', default: true })
    isActive: boolean;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;
}