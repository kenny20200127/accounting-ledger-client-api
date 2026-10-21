import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ schema: 'core', name: 'users' })
export class User {
  @Column({ name: 'is_platform_admin', default: false })
  isPlatformAdmin: boolean;
  @Column({ name: 'auth_version', default: 0 })
  authVersion: number;
  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
  @PrimaryGeneratedColumn('uuid', { name: 'user_id' })
  userId: string;

  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  companyId: string | null;

  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId: string | null;

  @Column({ type: 'varchar' })
  username: string;

  @Column({ type: 'varchar' })
  email: string;

  @Column({ name: 'password_hash', type: 'text', select: false })
  passwordHash: string;

  @Column({ name: 'first_name', type: 'varchar', nullable: true })
  firstName: string | null;

  @Column({ name: 'last_name', type: 'varchar', nullable: true })
  lastName: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
