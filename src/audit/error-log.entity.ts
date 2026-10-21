import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ schema: 'audit', name: 'error_logs' })
export class ErrorLog {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  errorId: string;

  @CreateDateColumn({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt: Date;

  @Column({ name: 'status_code', type: 'integer' })
  statusCode: number;

  @Column({ type: 'varchar', length: 10, nullable: true })
  method: string | null;

  @Column({ type: 'text', nullable: true })
  path: string | null;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'text', nullable: true })
  stack: string | null;

  @Column({ name: 'error_name', type: 'varchar', length: 120, nullable: true })
  errorName: string | null;

  @Column({ name: 'request_id', type: 'varchar', length: 64, nullable: true })
  requestId: string | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  companyId: string | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 64, nullable: true })
  ipAddress: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string | null;

  @Column({ name: 'request_body', type: 'jsonb', nullable: true })
  requestBody: object | null;
}
