import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Account } from '../accounts/account.entity';
import { Branch } from '../branches/branch.entity';
import { Company } from '../companies/company.entity';
import { CompanyListQueryDto } from '../common/company-list-query.dto';
import { CreateLedgerBatchDto } from './dto/create-ledger-batch.dto';
import { nextLedgerDocumentNumber } from './ledger-document-number';
import { Ledger } from './ledger.entity';
import { LedgerHistory } from './ledger-history.entity';

@Injectable()
export class LedgerService {
  constructor(
    @InjectRepository(Ledger)
    private readonly ledgers: Repository<Ledger>,
    @InjectRepository(LedgerHistory)
    private readonly histories: Repository<LedgerHistory>,
    @InjectRepository(Company)
    private readonly companies: Repository<Company>,
    @InjectRepository(Account)
    private readonly accounts: Repository<Account>,
    @InjectRepository(Branch)
    private readonly branches: Repository<Branch>,
    private readonly dataSource: DataSource,
  ) {}

  // Port of npf_Update_Ledger_Batch: apply debit/credit lines to running
  // balances, record one history row per line, in a single transaction.
  async createBatch(dto: CreateLedgerBatchDto, userId: string) {
    if (!(await this.companies.exists({ where: { companyId: dto.companyId } }))) {
      throw new BadRequestException('Company does not exist.');
    }
    if (dto.branchId) {
      const branch = await this.branches.findOne({ where: { branchId: dto.branchId } });
      if (!branch || branch.companyId !== dto.companyId) {
        throw new BadRequestException(
          'Branch must exist and belong to the selected company.',
        );
      }
    }
    const codes = [...new Set(dto.lines.map(line => line.accountCode))];
    const accountRows = await this.accounts.find({
      where: codes.map(code => ({ companyId: dto.companyId, accountCode: code })),
    });
    const byCode = new Map(accountRows.map(account => [account.accountCode, account]));
    for (const code of codes) {
      const account = byCode.get(code);
      if (!account) {
        throw new BadRequestException(
          `Account code ${code} does not exist for this company.`,
        );
      }
      const label = `${account.accountCode}-${account.accountName}`;
      if (!account.isActive) {
        throw new BadRequestException(`Account ${label} is inactive.`);
      }
      if (account.isHeader) {
        throw new BadRequestException(
          `Account ${label} is a header account and cannot be posted to. Select one of its detail accounts instead.`,
        );
      }
      if (!account.allowPosting) {
        throw new BadRequestException(
          `Account ${label} is not a posting account.`,
        );
      }
    }
    const period = dto.docDate.slice(0, 7).replace('-', '');

    return this.dataSource.transaction(async manager => {
      const docNo = await nextLedgerDocumentNumber(
        manager.getRepository(LedgerHistory),
        dto.companyId,
        dto.docType,
        dto.docDate,
      );
      const aggregates = new Map<
        string,
        { accountId: string; debit: bigint; credit: bigint; count: number }
      >();
      for (const line of dto.lines) {
        const account = byCode.get(line.accountCode)!;
        const aggregate =
          aggregates.get(account.accountId) ??
          { accountId: account.accountId, debit: 0n, credit: 0n, count: 0 };
        if (line.transactionType === 'DB') {
          aggregate.debit += toCents(line.amount);
        } else {
          aggregate.credit += toCents(line.amount);
        }
        aggregate.count++;
        aggregates.set(account.accountId, aggregate);
      }

      for (const aggregate of aggregates.values()) {
        await manager.query(
          `INSERT INTO ledger.ledgers
             (company_id, account_id, branch_id, debit_balance, credit_balance, transaction_count, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (company_id, account_id) DO UPDATE SET
             debit_balance = ledger.ledgers.debit_balance + EXCLUDED.debit_balance,
             credit_balance = ledger.ledgers.credit_balance + EXCLUDED.credit_balance,
             transaction_count = ledger.ledgers.transaction_count + EXCLUDED.transaction_count,
             updated_by = EXCLUDED.created_by,
             updated_at = now()`,
          [
            dto.companyId,
            aggregate.accountId,
            dto.branchId ?? null,
            centsToAmount(aggregate.debit),
            centsToAmount(aggregate.credit),
            aggregate.count,
            userId,
          ],
        );
      }

      const saved = await manager.getRepository(LedgerHistory).save(
        dto.lines.map(line => {
          const account = byCode.get(line.accountCode)!;
          const cents = toCents(line.amount);
          const isDebit = line.transactionType === 'DB';
          return manager.getRepository(LedgerHistory).create({
            companyId: dto.companyId,
            accountId: account.accountId,
            branchId: dto.branchId ?? null,
            docNo,
            docType: dto.docType,
            refNo: dto.refNo ?? null,
            docDate: dto.docDate,
            period,
            debitAmount: isDebit ? centsToAmount(cents) : '0.00',
            creditAmount: isDebit ? '0.00' : centsToAmount(cents),
            netAmount: centsToAmount(isDebit ? cents : -cents),
            remarks: line.remarks ?? null,
            createdBy: userId,
          });
        }),
      );

      const balanceRows: any[] = await manager.query(
        `SELECT l.account_id AS "accountId", l.opening_balance AS "openingBalance",
                l.debit_balance AS "debitBalance", l.credit_balance AS "creditBalance"
         FROM ledger.ledgers l
         WHERE l.company_id = $1 AND l.account_id = ANY($2::uuid[])`,
        [dto.companyId, [...aggregates.keys()]],
      );

      return {
        docNo,
        docType: dto.docType,
        docDate: dto.docDate,
        refNo: dto.refNo ?? null,
        period,
        lines: saved.map((row, index) => {
          const line = dto.lines[index];
          const account = byCode.get(line.accountCode)!;
          return {
            historyId: row.historyId,
            accountId: row.accountId,
            accountCode: account.accountCode,
            accountName: account.accountName,
            transactionType: line.transactionType,
            amount: line.amount,
            debitAmount: row.debitAmount,
            creditAmount: row.creditAmount,
            netAmount: row.netAmount,
            remarks: row.remarks,
          };
        }),
        balances: balanceRows.map(row => {
          const account = [...byCode.values()].find(a => a.accountId === row.accountId);
          return {
            accountId: row.accountId,
            accountCode: account?.accountCode,
            accountName: account?.accountName,
            openingBalance: row.openingBalance,
            debitBalance: row.debitBalance,
            creditBalance: row.creditBalance,
          };
        }),
      };
    });
  }

  async listHistories(query: CompanyListQueryDto) {
    const term = query.q?.trim();
    const pattern = term ? `%${term.replace(/[\\%_]/g, '\\$&')}%` : undefined;
    const qb = this.histories
      .createQueryBuilder('h')
      .leftJoin(Account, 'a', 'a.account_id = h.account_id')
      .where('h.company_id = :companyId', { companyId: query.companyId });
    if (pattern) {
      qb.andWhere(
        `(h.doc_no ILIKE :pattern OR h.ref_no ILIKE :pattern OR h.doc_type ILIKE :pattern
          OR a.account_code ILIKE :pattern OR a.account_name ILIKE :pattern OR h.remarks ILIKE :pattern)`,
        { pattern },
      );
    }
    const total = await qb.getCount();
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const rows: any[] = await qb
      .select([
        'h.history_id AS "historyId"',
        'h.doc_no AS "docNo"',
        'h.doc_type AS "docType"',
        'h.ref_no AS "refNo"',
        `to_char(h.doc_date, 'YYYY-MM-DD') AS "docDate"`,
        'h.period AS "period"',
        'h.debit_amount AS "debitAmount"',
        'h.credit_amount AS "creditAmount"',
        'h.net_amount AS "netAmount"',
        'h.remarks AS "remarks"',
        'h.unit_code AS "unitCode"',
        'a.account_id AS "accountId"',
        'a.account_code AS "accountCode"',
        'a.account_name AS "accountName"',
      ])
      .orderBy('h.doc_date', 'DESC')
      .addOrderBy('h.history_id', 'DESC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany();
    return { items: rows, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findHistory(id: string) {
    const [row] = await this.dataSource.query(
      `SELECT h.history_id AS "historyId", h.company_id AS "companyId", h.account_id AS "accountId",
              h.branch_id AS "branchId", h.doc_no AS "docNo", h.doc_type AS "docType",
              h.ref_no AS "refNo", to_char(h.doc_date, 'YYYY-MM-DD') AS "docDate", h.period AS "period",
              h.debit_amount AS "debitAmount", h.credit_amount AS "creditAmount",
              h.net_amount AS "netAmount", h.remarks AS "remarks", h.unit_code AS "unitCode",
              h.created_at AS "createdAt",
              a.account_code AS "accountCode", a.account_name AS "accountName"
       FROM ledger.histories h
       JOIN accounting.accounts a ON a.account_id = h.account_id
       WHERE h.history_id = $1`,
      [id],
    );
    if (!row) throw new NotFoundException('Ledger history entry not found.');
    return row;
  }

  async listBalances(companyId: string) {
    return this.dataSource.query(
      `SELECT l.ledger_id AS "ledgerId", l.company_id AS "companyId", l.account_id AS "accountId",
              l.branch_id AS "branchId", l.opening_balance AS "openingBalance",
              l.debit_balance AS "debitBalance", l.credit_balance AS "creditBalance",
              l.budget_amount AS "budgetAmount", l.pl_balance AS "plBalance",
              l.transaction_count AS "transactionCount", l.updated_at AS "updatedAt",
              a.account_code AS "accountCode", a.account_name AS "accountName"
       FROM ledger.ledgers l
       JOIN accounting.accounts a ON a.account_id = l.account_id
       WHERE l.company_id = $1
       ORDER BY a.account_code`,
      [companyId],
    );
  }

  async listMonthlyBalances(companyId: string, year?: string) {
    const params: unknown[] = [companyId];
    let yearSql = '';
    if (year) {
      params.push(Number(year));
      yearSql = ` AND mb.budget_year = $${params.length}`;
    }
    return this.dataSource.query(
      `SELECT mb.monthly_balance_id AS "monthlyBalanceId", mb.budget_year AS "year",
              mb.month_number AS "month", mb.net_amount AS "netAmount",
              a.account_id AS "accountId", a.account_code AS "accountCode",
              a.account_name AS "accountName"
       FROM ledger.monthly_balances mb
       JOIN accounting.accounts a ON a.account_id = mb.account_id
       WHERE mb.company_id = $1 ${yearSql}
       ORDER BY a.account_code, mb.budget_year, mb.month_number`,
      params,
    );
  }

  async getLedger(companyId: string, accountId: string, from?: string, to?: string) {
    if (from && to && from > to) throw new BadRequestException('from must be on or before to.');
    const params: any[] = [companyId, accountId];
    let dateSql = '';
    if (from) { params.push(from); dateSql += ` AND je.transaction_date >= $${params.length}`; }
    if (to) { params.push(to); dateSql += ` AND je.transaction_date <= $${params.length}`; }

    const rows = await this.dataSource.query(`
      SELECT je.journal_entry_id AS "journalEntryId",
             je.journal_number AS "journalNumber",
             je.transaction_date AS "transactionDate",
             je.reference_number AS "referenceNumber",
             je.description AS "journalDescription",
             jel.line_number AS "lineNumber",
             jel.description AS "lineDescription",
             jel.debit_amount AS "debitAmount",
             jel.credit_amount AS "creditAmount",
             a.account_code AS "accountCode",
             a.account_name AS "accountName"
      FROM accounting.journal_entry_lines jel
      JOIN accounting.journal_entries je ON je.journal_entry_id = jel.journal_entry_id
      JOIN accounting.accounts a ON a.account_id = jel.account_id
      WHERE je.company_id = $1 AND a.company_id = $1 AND jel.account_id = $2 AND je.status IN ('POSTED', 'REVERSED')
        ${dateSql}
      ORDER BY je.transaction_date, je.journal_number, jel.line_number
    `, params);

    let runningCents = 0n;
    if (from) {
      const [opening] = await this.dataSource.query(`
        SELECT COALESCE(SUM(l.debit_amount - l.credit_amount), 0)::numeric(20,2) AS balance
        FROM accounting.journal_entry_lines l
        JOIN accounting.journal_entries j ON j.journal_entry_id = l.journal_entry_id
        JOIN accounting.accounts a ON a.account_id = l.account_id
        WHERE j.company_id = $1 AND a.company_id = $1 AND l.account_id = $2
          AND j.status IN ('POSTED', 'REVERSED') AND j.transaction_date < $3
      `, [companyId, accountId, from]);
      runningCents = toCents(opening.balance);
    }
    return rows.map((row: any) => {
      runningCents += toCents(row.debitAmount) - toCents(row.creditAmount);
      return { ...row, runningBalance: centsToAmount(runningCents) };
    });
  }

  async trialBalance(companyId: string, asOf: string) {
    const rows = await this.dataSource.query(`
      SELECT a.account_id AS "accountId", a.account_code AS "accountCode",
             a.account_name AS "accountName", at.code AS "accountType",
             COALESCE(SUM(jel.debit_amount) FILTER (WHERE je.journal_entry_id IS NOT NULL), 0)::numeric(20,2) AS "totalDebit",
             COALESCE(SUM(jel.credit_amount) FILTER (WHERE je.journal_entry_id IS NOT NULL), 0)::numeric(20,2) AS "totalCredit"
      FROM accounting.accounts a
      JOIN accounting.account_types at ON at.account_type_id = a.account_type_id
      LEFT JOIN accounting.journal_entry_lines jel ON jel.account_id = a.account_id
      LEFT JOIN accounting.journal_entries je ON je.journal_entry_id = jel.journal_entry_id
        AND je.company_id = a.company_id AND je.status IN ('POSTED', 'REVERSED') AND je.transaction_date <= $2
      WHERE a.company_id = $1
      GROUP BY a.account_id, a.account_code, a.account_name, at.code
      ORDER BY a.account_code
    `, [companyId, asOf]);

    return rows.map((row: any) => ({
      ...row,
      balance: centsToAmount(toCents(row.totalDebit) - toCents(row.totalCredit)),
    }));
  }
}
function toCents(value: string | number): bigint {
  const raw = String(value);
  const negative = raw.startsWith('-');
  const [whole, fraction = ''] = raw.replace(/^[+-]/, '').split('.');
  const cents = BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2));
  return negative ? -cents : cents;
}
function centsToAmount(cents: bigint): string {
  const sign = cents < 0n ? '-' : '';
  const abs = cents < 0n ? -cents : cents;
  return `${sign}${abs / 100n}.${String(abs % 100n).padStart(2, '0')}`;
}
