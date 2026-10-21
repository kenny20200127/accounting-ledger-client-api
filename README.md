<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Authentication

Apply `database/migrations/20261012_add_menu_based_access_control.sql` to the existing database after `core.users`, `core.roles`, and `core.user_roles` are present. Set `JWT_SECRET` to a random secret of at least 32 characters and optionally set `JWT_EXPIRES_IN` (defaults to `1h`). The API does not synchronize or execute schema migrations automatically.

Create users with a bcrypt-compatible hash in `core.users.password_hash`, and assign roles through `core.user_roles`. Login at `POST /api/v1/auth/login` with `{ "identifier": "username-or-email", "password": "..." }`; use the returned bearer token for protected routes. `GET /api/v1/auth/me` returns the current user and roles, and `GET /api/v1/auth/menus` returns the menus and aggregated permissions assigned through the user's roles. Menu permissions are enforced for mapped API route prefixes.

To seed or refresh an administrator, first apply the menu migration, then provide credentials only in your terminal environment and run `npm run seed:admin`. The script is repeatable: it creates or updates the exact matching username/email, ensures the `ADMIN` role and role assignment, and grants current menus. It rejects conflicting username/email matches. It never prints the password or password hash.

PowerShell example (the password prompt is masked; the value is only held in this terminal process):

```powershell
$env:SEED_ADMIN_USERNAME = 'admin'
$env:SEED_ADMIN_EMAIL = 'admin@example.com'
$securePassword = Read-Host 'Admin password' -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
  $env:SEED_ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  npm run seed:admin
} finally {
  Remove-Item Env:SEED_ADMIN_PASSWORD -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
  $securePassword.Dispose()
}
```

Optional values are `SEED_ADMIN_COMPANY_ID`, `SEED_ADMIN_FIRST_NAME`, and `SEED_ADMIN_LAST_NAME`.

## Financial reports and PDF downloads

Open **Reports**, choose Trial Balance, Profit & Loss, or Balance of Account, select the **As at** date, and use **Download PDF**. Previews update when filters change; PDF downloads contain every matching row, including rows outside the current 50-row preview page. Branch, fiscal year, and zero-balance filters are available. Balance of Account includes presets for bank/cash balances, accruals/expenses, directors current accounts, long-term investments, staff debtors, insurance company creditors, and client debtors when their legacy account codes exist. Custom selections support up to 30 account groups.

These formats follow the supplied 24-page scanned report reference. Company details, account descriptions, currency, report dates, printed totals, and page numbers come from the new application. The scanned monetary figures are not imported as transactions.

Calculations:

- Trial Balance groups legacy detail accounts under their six-digit main-account codes. Current month shows net posted movement from the first of the month through the selected date. Year-to-date columns show closing balances through that date, including brought-forward posted entries. Each group is split into a debit or credit balance after aggregation; headers are not counted again. Totals and a balance status are included.
- Profit & Loss shows current-month and fiscal-year-to-date income, operating expenses, depreciation charges, and net profit/loss. Credit income and profit appear in parentheses, matching the scanned convention. Income and expense classification uses the chart of accounts. Fiscal years are detected from the selected date; select one explicitly if date ranges overlap.
- Balance of Account lists each matching detail account and its signed closing balance through the selected date. Bank/cash or other groups can be selected together. Totals cover all selected accounts.

Only `POSTED` and `REVERSED` journal entries affect the figures. A reversed original remains in the report alongside its posted offsetting reversal. Draft/pending/approved entries and transactions after the cutoff are excluded. Reports identify unposted journals, months with no posted transactions, missing fiscal-year setup, and retained legacy balance snapshots. For example, the migrated ledger currently has no posted transactions in March 2026; it therefore cannot reproduce the March movements and historical figures in the scan until the remaining old data is reconciled. No old snapshot is silently assigned a date or added to live postings.

API endpoints require a bearer token and `REPORTS.canView`:

- `GET /api/v1/reports/financial/options?companyId=<uuid>` returns account groups, branch choices, and fiscal-year choices.
- `GET /api/v1/reports/financial?companyId=<uuid>&report=trial-balance&asOf=2026-03-31` returns the structured preview, totals, and data notes.
- `GET /api/v1/reports/financial/pdf?companyId=<uuid>&report=account-balances&asOf=2026-03-31&groupCodes=156000,157000` downloads an A4 PDF.

`report` accepts `trial-balance`, `profit-loss`, or `account-balances`. Optional filters are `branchId`, `fiscalYearId`, and `includeZero=true|false`. `groupCodes` is a comma-separated list supported only by Balance of Account; all IDs and dates are validated and scoped to the selected company. `asOf` must be a real `YYYY-MM-DD` calendar date. Existing `/api/v1/reports/trial-balance` and `/api/v1/ledger` routes retain their previous contracts.

PDF rendering uses the ReportLab worker in `scripts/render_financial_report.py`. Install the dependency on each app host once:

```powershell
npm run setup:pdf
```

Python must be on PATH, or set `REPORT_PDF_PYTHON` to the Python executable. Include `scripts/render_financial_report.py` with the deployed application and start the API from the project root. The PDF process receives report JSON through stdin, uses no shell interpolation, and has a 30-second timeout and 20-MiB output limit. The renderer embeds fonts, repeats report/table headers on every page, wraps long descriptions, and keeps totals with preceding account rows. Missing runtime dependencies produce a descriptive 503 response.

Local PDF previews can be regenerated with `node scripts/preview-financial-reports.cjs`. They are written to `output/pdf/`, with QA data in `tmp/pdfs/`; both locations are excluded from Git. The sample previews use March 31, 2026 and the current posted ledger, not the scan's printed figures. No report generation changes the database.

## List pagination

Journals (`/api/v1/journals`), chart of accounts (`/api/v1/accounts`), customers (`/api/v1/customers`), and suppliers (`/api/v1/suppliers`) support database pagination. The application uses 25 rows per page initially, with Previous/Next buttons and 10/25/50/100 row options. Changing the list, company, search, or page size returns to page 1. Search runs across all matching records in the selected company.

Example: `GET /api/v1/accounts?companyId=<uuid>&page=2&limit=25&q=bank`.

Supplying `page` or `limit` returns `{ items, total, page, limit, totalPages }`. Defaults are page 1 and limit 25; limit must be between 1 and 100. Page numbers must be positive integers, up to 1,000,000. Out-of-range pages return an empty `items` array with the matching total. Ordering uses a unique ID as a final tie breaker. Company ID and query parameters are validated.

Optional `q` searches account/customer/supplier codes and names, customer/supplier emails, or journal references/descriptions. Search terms are limited to 100 characters, trimmed, case insensitive, and treated as literal substrings. Requests without `page` and `limit` keep the existing array response used by dashboards and lookups. Authentication and menu permissions continue to apply.

## Resuming the old accounting import

The interrupted import wrote voucher headers into the first database company, while its accounts belonged to `KB01`. The resume importer selects the exact company from `accsystem.coycode`, repairs matching pristine empty headers without changing their IDs, and loads historical periods from voucher dates. It keeps a JSON backup under `database/backups/` before every write run, and commits all repairs together. Existing tracked journals are left unchanged on retries.

Requirements: the configured PostgreSQL database, the source company and account types, Python with `psycopg2-binary` (`python -m pip install -r scripts/requirements-migration.txt`), and the SQL Server export. The Node wrapper loads database settings from `.env`; no password is embedded in the importer. Run from the repository root:

```powershell
npm run migrate:old-account -- --dry-run
npm run migrate:old-account
npm run verify:old-account
```

Use `--sql-file "C:\path\oldAccountscript.sql"` for another source location, or `--phase 6 7 8` to resume just journal, receipt, and payment vouchers. Dry runs read the database and write a local preview report, but do not change database records. Write runs apply `database/migrations/20261014_resume_old_account.sql` inside the migration transaction; application startup does not run migrations.

Receipt and payment details exclude the bank counterpart. The importer adds that counterpart only when the header explicitly supplies a valid bank account, the detail bank agrees, and the detail totals exactly match the header. Missing accounts, conflicting banks, mismatched totals, and repeated voucher numbers are retained for review as drafts. No suspense account or arbitrary adjustment is generated.

`accounting.legacy_migration_records` retains source evidence, cost centres, account classification metadata, detail rows, and ledger snapshots. `accledger` contains cumulative balance figures without a reliable snapshot date; those figures are retained separately rather than added to historical voucher postings. Reports therefore reflect the recovered voucher transactions, not a certified reconstruction of every old-system balance. Insurance policies, claims, backup/history tables, and temporary report tables are outside this accounting voucher importer. The source SQL file is preserved.

Source customers and agents are upserted into `KB01`. Unused exact matches from the earlier wrong-company import are moved while preserving their IDs. Other-company records with differing contact data or existing references are preserved. One customer with no usable code/name is retained in source evidence rather than fabricated as an active customer; repeated supplier codes resolve to one master record.

Select **Koguna** in the company selector and open **Reports** to see the migration review panel. The following endpoints require a bearer token and the existing `REPORTS.canView` menu permission:

- `GET /api/v1/reports/legacy-migration?companyId=<uuid>` â€” source counts and posted/draft totals.
- `GET /api/v1/reports/legacy-migration/issues?companyId=<uuid>&limit=20&offset=0` â€” paginated voucher identifiers and reconciliation issues; raw customer records are excluded.

The migration report and backups contain business data and are excluded from Git. The first repair report is also retained as `database/backups/first-old-account-repair-report.json`. Historical review drafts cannot be posted until their period and voucher issues are resolved through the normal journal workflow. Imported journals with known lines keep their computed detail totals; duplicate source numbers retain evidence without guessing line ownership.

Trial balances now exclude drafts and transactions after the requested date. Ledger date ranges include the balance before the start date and use exact integer cents, including negative balances. The SQL trial-balance view also excludes unposted entries and includes posted originals offset by reversal journals.

```powershell
npm run test:migration
npm run test:e2e
npm test
npm --prefix client run build
```

The e2e checks use the configured PostgreSQL database and Node's native test runner, which handles the installed Nest ESM packages. Ledger fixtures are rolled back; the authorization checks do not create users or print tokens. An existing Reports-enabled user enables the additional read-only authorized-route smoke check.

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil MyÃ…â€ºliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

## Platform and company administration

Run `npm run migrate:company-tenancy` before starting this version of the API. This repeatable migration backs up existing core records under the ignored `database/backups/` directory, adds branding and session fields, promotes existing ADMIN users to platform administrators once, and provisions company-owned roles for existing companies. Financial records are preserved. Keep these backups private because they contain password hashes.

Open `/platform/` and sign in with your existing platform administrator account. The platform is a separate frontend entry point with its own login, navigation, fixed platform identity, and session storage. The company application remains at `/`. Onboarding captures registration, tax, contact and address details, base currency, fiscal-year start, brand colors, and the first company administrator. It creates a head office, scoped Administrator/Accountant/Viewer roles, the current fiscal year with twelve periods, and optionally nine starter accounts in a single transaction. Upload a PNG/JPEG/WebP logo up to 2 MB; the server validates and normalizes it to PNG. App navigation and financial PDF exports use the selected company's branding.

Company administrators sign in at `/` using a company account, see only their company, and use **Company Settings**, **Users**, and **Roles & Permissions**. They can create users, assign company-owned roles, reset passwords, activate/deactivate users, and maintain branding. The built-in administrator role cannot be edited, and at least one active company administrator must remain. Global roles and platform privileges cannot be assigned through company user management. Company suspension blocks login and existing sessions. User updates and password resets revoke existing user tokens.

New endpoints (all under `/api/v1`):

- `POST auth/platform/login` and `POST auth/company/login`: separate login surfaces. The existing `POST auth/login` remains an alias for company login.
- `GET/POST platform/companies`, `GET/PATCH platform/companies/:id`: platform onboarding and status management.
- `POST/DELETE platform/companies/:id/logo`, company-scoped `platform/companies/:id/users`, `platform/companies/:id/roles`, and `platform/companies/:id/audit-logs`: platform administration without access to financial operations.
- `PATCH companies/:id`, `POST/DELETE companies/:id/logo`: company details and logo management.
- `GET/POST users`, `PATCH users/:id`, `POST users/:id/reset-password`: scoped user management.
- `GET/POST roles`, `PATCH roles/:id`, `GET roles/:id/permissions`: scoped role permissions.
- `GET audit-logs?companyId=...&page=1&limit=25`: paginated administration audit records.

Company users are checked against database-backed active membership on every request. List filters, detail IDs, and financial reference IDs are checked for ownership, including nested journal/invoice lines. Shared account type/category catalogs are readable but only platform administrators can modify them. `npm run test:e2e` covers existing accounting reports plus temporary-company onboarding, tenant access boundaries, branding, role escalation, password resets, and suspension. Verification fixtures are removed when the tests finish.

### Separate application sessions

The production build emits `client/dist/index.html` for the company application and `client/dist/platform/index.html` for the platform application, with separate entry bundles. Host both paths or deploy the entry points separately with the same API proxy. Development URLs are `http://localhost:5174/` and `http://localhost:5174/platform/` when Vite is started on port 5174.

Platform accounts authenticate only through `auth/platform/login`; company accounts authenticate through `auth/company/login` or the compatibility `auth/login` route. Tokens include a server-issued `scope`, and every protected request checks that scope against the active database account. Legacy tokens inherit their account's portal scope. Platform tokens can access platform administration and session/profile endpoints; company tokens cannot access `/platform/*`. Signing out of one app leaves the other app's independent session intact.

Existing platform administrators must create or appoint a separate company administrator through **Company Users** before signing in to an existing company's accounting workspace. Platform accounts remain available for onboarding and administration, including companies with suspended access.

### Edit and delete company users in the platform

Open **Company Users**, select a company, and use **Edit** to change a user's username, email, name, or assigned company roles. Changes revoke the user's previous sessions. **Delete** opens a confirmation panel; confirming removes the user from active administration lists, disables sign-in, revokes sessions, and removes role assignments. The retained user record preserves financial and audit references. The last active company administrator cannot be deleted. Platform staff accounts are protected from company user deletion.

`DELETE /api/v1/platform/companies/:companyId/users/:userId` implements deletion. Run `npm run migrate:company-tenancy` when installing this version; it adds the nullable `core.users.deleted_at` field through a backed-up, repeatable migration.

### Company application colors

The company workspace derives its sidebar, selected navigation, primary actions, dashboard accents/charts, shortcuts, and report highlights from the company's primary and secondary colors. Foregrounds are chosen for readable contrast, including light or saturated brand colors. Branding saves notify other tabs on the same origin; the company workspace also refreshes company metadata when it regains focus or becomes visible. The separate platform retains its platform colors. Financial status colors (success, warning, overdue/error) retain their meanings.
