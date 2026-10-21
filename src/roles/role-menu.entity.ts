import { CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, Column } from 'typeorm';
import { Menu } from './menu.entity';
import { Role } from './role.entity';

@Entity({ schema: 'core', name: 'role_menus' })
export class RoleMenu {
  @PrimaryColumn({ name: 'role_id', type: 'uuid' })
  roleId: string;

  @ManyToOne(() => Role, { onDelete: 'CASCADE', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'role_id', referencedColumnName: 'roleId' })
  role: Role;

  @PrimaryColumn({ name: 'menu_id', type: 'uuid' })
  menuId: string;

  @ManyToOne(() => Menu, { onDelete: 'CASCADE', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'menu_id', referencedColumnName: 'menuId' })
  menu: Menu;

  @Column({ name: 'can_view', type: 'boolean', default: true })
  canView: boolean;

  @Column({ name: 'can_create', type: 'boolean', default: false })
  canCreate: boolean;

  @Column({ name: 'can_edit', type: 'boolean', default: false })
  canEdit: boolean;

  @Column({ name: 'can_delete', type: 'boolean', default: false })
  canDelete: boolean;

  @Column({ name: 'can_approve', type: 'boolean', default: false })
  canApprove: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}