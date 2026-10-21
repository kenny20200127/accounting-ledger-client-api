import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ schema: 'core', name: 'roles' })
export class Role {
  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  companyId: string | null;
  @Column({ name: 'is_company_admin', default: false })
  isCompanyAdmin: boolean;
  @PrimaryGeneratedColumn('uuid', { name: 'role_id' })
  roleId: string;

  @Column({ name: 'role_code', type: 'varchar', unique: true })
  roleCode: string;

  @Column({ name: 'role_name', type: 'varchar' })
  roleName: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
