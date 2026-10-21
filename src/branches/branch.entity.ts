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

@Entity({ schema: 'core', name: 'branches' })
@Index('uq_branch_company_code', ['companyId', 'branchCode'], { unique: true })
export class Branch {
    @PrimaryGeneratedColumn('uuid', { name: 'branch_id' })
    branchId: string;

    @Column({ name: 'company_id', type: 'uuid' })
    companyId: string;

    @ManyToOne(() => Company, { onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
    @JoinColumn({ name: 'company_id', referencedColumnName: 'companyId' })
    company: Company;

    @Column({ name: 'branch_code', type: 'varchar', length: 50 })
    branchCode: string;

    @Column({ name: 'branch_name', type: 'varchar', length: 150 })
    branchName: string;

    @Column({ type: 'text', nullable: true })
    address: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    city: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    state: string | null;

    @Column({ type: 'varchar', length: 150, nullable: true })
    email: string | null;

    @Column({ type: 'varchar', length: 50, nullable: true })
    phone: string | null;

    @Column({ name: 'is_active', type: 'boolean', default: true })
    isActive: boolean;

    @Column({ name: 'is_head_office', type: 'boolean', default: false })
    isHeadOffice: boolean;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
    updatedAt: Date;
}