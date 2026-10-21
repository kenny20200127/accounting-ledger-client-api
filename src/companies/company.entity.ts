import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ schema: 'core', name: 'companies' })
export class Company {
  @Column({ name: 'industry', type: 'varchar', length: 100, nullable: true })
  industry: string | null;
  @Column({ name: 'website', type: 'varchar', length: 255, nullable: true })
  website: string | null;
  @Column({
    name: 'contact_person',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  contactPerson: string | null;
  @Column({
    name: 'contact_title',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  contactTitle: string | null;
  @Column({ name: 'postal_code', type: 'varchar', length: 30, nullable: true })
  postalCode: string | null;
  @Column({ name: 'logo_data', type: 'text', nullable: true })
  logoData: string | null;
  @Column({ name: 'primary_color', default: '#176246' })
  primaryColor: string;
  @Column({ name: 'secondary_color', default: '#edf5ef' })
  secondaryColor: string;
  @Column({ name: 'fiscal_year_start_month', default: 1 })
  fiscalYearStartMonth: number;
  @Column({ name: 'fiscal_year_start_day', default: 1 })
  fiscalYearStartDay: number;

  @PrimaryGeneratedColumn('uuid', { name: 'company_id' })
  companyId: string;

  @Column({ name: 'company_code', type: 'varchar', length: 50, unique: true })
  companyCode: string;

  @Column({ name: 'company_name', length: 200 })
  companyName: string;

  @Column({
    name: 'registration_number',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  registrationNumber: string | null;

  @Column({
    name: 'tax_identification_number',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  taxIdentificationNumber: string | null;

  @Column({ type: 'varchar', nullable: true, length: 150 })
  email: string | null;

  @Column({ type: 'varchar', nullable: true, length: 50 })
  phone: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, default: 'Nigeria' })
  country: string | null;

  @Column({
    name: 'base_currency',
    type: 'varchar',
    length: 10,
    default: 'NGN',
  })
  baseCurrency: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
  })
  updatedAt: Date;
}
