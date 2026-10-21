import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Role } from '../roles/role.entity';
import { User } from './user.entity';

@Entity({ schema: 'core', name: 'user_roles' })
export class UserRole {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'user_id', referencedColumnName: 'userId' })
  user: User;

  @PrimaryColumn({ name: 'role_id', type: 'uuid' })
  roleId: string;

  @ManyToOne(() => Role, { onDelete: 'CASCADE', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'role_id', referencedColumnName: 'roleId' })
  role: Role;
}