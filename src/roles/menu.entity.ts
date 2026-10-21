import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ schema: 'core', name: 'menus' })
@Index('ix_menus_parent', ['parentMenuId'])
@Index('ix_menus_display_order', ['displayOrder'])
export class Menu {
  @PrimaryGeneratedColumn('uuid', { name: 'menu_id' })
  menuId: string;

  @Column({ name: 'parent_menu_id', type: 'uuid', nullable: true })
  parentMenuId: string | null;

  @ManyToOne(() => Menu, { nullable: true, onDelete: 'RESTRICT', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'parent_menu_id', referencedColumnName: 'menuId' })
  parentMenu: Menu | null;

  @Column({ name: 'menu_code', type: 'varchar', length: 100, unique: true })
  menuCode: string;

  @Column({ name: 'menu_name', type: 'varchar', length: 100 })
  menuName: string;

  @Column({ name: 'menu_url', type: 'varchar', length: 255, nullable: true })
  menuUrl: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  icon: string | null;

  @Column({ name: 'display_order', type: 'integer', default: 0 })
  displayOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}