
ALTER TABLE core.users ADD COLUMN IF NOT EXISTS is_platform_admin boolean NOT NULL DEFAULT false;
ALTER TABLE core.users ADD COLUMN IF NOT EXISTS auth_version integer NOT NULL DEFAULT 0;
ALTER TABLE core.roles ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES core.companies(company_id);
ALTER TABLE core.roles ADD COLUMN IF NOT EXISTS is_company_admin boolean NOT NULL DEFAULT false;
ALTER TABLE core.roles ALTER COLUMN role_code TYPE varchar(100);
ALTER TABLE core.companies ADD COLUMN IF NOT EXISTS industry varchar(100), ADD COLUMN IF NOT EXISTS website varchar(255),
 ADD COLUMN IF NOT EXISTS contact_person varchar(150), ADD COLUMN IF NOT EXISTS contact_title varchar(100), ADD COLUMN IF NOT EXISTS postal_code varchar(30),
 ADD COLUMN IF NOT EXISTS logo_data text, ADD COLUMN IF NOT EXISTS primary_color varchar(7) NOT NULL DEFAULT '#176246',
 ADD COLUMN IF NOT EXISTS secondary_color varchar(7) NOT NULL DEFAULT '#edf5ef',
 ADD COLUMN IF NOT EXISTS fiscal_year_start_month integer NOT NULL DEFAULT 1 CHECK(fiscal_year_start_month BETWEEN 1 AND 12),
 ADD COLUMN IF NOT EXISTS fiscal_year_start_day integer NOT NULL DEFAULT 1 CHECK(fiscal_year_start_day BETWEEN 1 AND 28);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_unique ON core.users(lower(username));
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique ON core.users(lower(email));
CREATE INDEX IF NOT EXISTS roles_company_idx ON core.roles(company_id);
UPDATE core.users u SET is_platform_admin=true WHERE EXISTS (SELECT 1 FROM core.user_roles ur JOIN core.roles r ON r.role_id=ur.role_id WHERE ur.user_id=u.user_id AND r.role_code='ADMIN');
INSERT INTO core.menus(menu_code,menu_name,menu_url,icon,display_order) VALUES('PLATFORM_ADMIN','Platform Administration','/platform-admin','ShieldCheck',1) ON CONFLICT(menu_code) DO NOTHING;
