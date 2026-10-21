-- Provision administrative roles for existing companies without changing their financial records.
INSERT INTO core.roles(company_id,role_code,role_name,is_company_admin)
 SELECT c.company_id,c.company_id::text||':'||v.code,v.name,v.code='ADMIN'
 FROM core.companies c CROSS JOIN (VALUES('ADMIN','Company Administrator'),('ACCOUNTANT','Accountant'),('VIEWER','Viewer')) v(code,name)
 ON CONFLICT(role_code) DO NOTHING;
INSERT INTO core.role_menus(role_id,menu_id,can_view,can_create,can_edit,can_delete,can_approve)
 SELECT r.role_id,m.menu_id,
  r.is_company_admin OR m.menu_code NOT IN('COMPANIES','USERS','ROLES','AUDIT_LOGS'),
  (r.is_company_admin OR m.menu_code NOT IN('COMPANIES','USERS','ROLES','AUDIT_LOGS')) AND r.role_code NOT LIKE '%:VIEWER',
  (r.is_company_admin OR m.menu_code NOT IN('COMPANIES','USERS','ROLES','AUDIT_LOGS')) AND r.role_code NOT LIKE '%:VIEWER',
  r.is_company_admin,
  (r.is_company_admin OR m.menu_code NOT IN('COMPANIES','USERS','ROLES','AUDIT_LOGS')) AND r.role_code NOT LIKE '%:VIEWER'
 FROM core.roles r CROSS JOIN core.menus m
 WHERE r.company_id IS NOT NULL AND r.role_code IN(r.company_id::text||':ADMIN',r.company_id::text||':ACCOUNTANT',r.company_id::text||':VIEWER')
 AND m.is_active AND m.menu_code<>'PLATFORM_ADMIN' ON CONFLICT(role_id,menu_id) DO NOTHING;
-- Preserve the exact menu grants of pre-existing, non-platform users in a company-owned role.
INSERT INTO core.roles(company_id,role_code,role_name,description)
 SELECT DISTINCT u.company_id,u.company_id::text||':LEGACY:'||r.role_id::text,r.role_name,r.description
 FROM core.users u JOIN core.user_roles ur USING(user_id) JOIN core.roles r USING(role_id)
 WHERE NOT u.is_platform_admin AND u.company_id IS NOT NULL AND r.company_id IS NULL
 ON CONFLICT(role_code) DO NOTHING;
INSERT INTO core.role_menus(role_id,menu_id,can_view,can_create,can_edit,can_delete,can_approve)
 SELECT scoped.role_id,rm.menu_id,rm.can_view,rm.can_create,rm.can_edit,rm.can_delete,rm.can_approve
 FROM core.roles scoped JOIN core.roles original ON scoped.role_code=scoped.company_id::text||':LEGACY:'||original.role_id::text
 JOIN core.role_menus rm ON rm.role_id=original.role_id JOIN core.menus m USING(menu_id)
 WHERE m.menu_code<>'PLATFORM_ADMIN' ON CONFLICT(role_id,menu_id) DO NOTHING;
INSERT INTO core.user_roles(user_id,role_id)
 SELECT u.user_id,scoped.role_id FROM core.users u JOIN core.user_roles ur USING(user_id)
 JOIN core.roles original USING(role_id) JOIN core.roles scoped ON scoped.role_code=u.company_id::text||':LEGACY:'||original.role_id::text
 WHERE NOT u.is_platform_admin AND original.company_id IS NULL ON CONFLICT(user_id,role_id) DO NOTHING;
