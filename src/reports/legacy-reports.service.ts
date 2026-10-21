import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { LegacyIssuesQuery } from './legacy-reports.controller';
@Injectable()
export class LegacyReportsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}
  async summary(companyId: string) {
    const records = await this.dataSource.query(`
      SELECT source_table AS "sourceTable", status, COUNT(*)::int AS count
      FROM accounting.legacy_migration_records WHERE company_id = $1
      GROUP BY source_table, status ORDER BY source_table, status
    `, [companyId]);
    const [journals] = await this.dataSource.query(`
      SELECT COUNT(*)::int AS "journalCount",
        COUNT(*) FILTER (WHERE j.status = 'POSTED')::int AS "postedCount",
        COUNT(*) FILTER (WHERE j.status = 'DRAFT')::int AS "draftCount",
        COALESCE(SUM(j.total_debit) FILTER (WHERE j.status = 'POSTED'), 0)::text AS "postedDebit",
        COALESCE(SUM(j.total_credit) FILTER (WHERE j.status = 'POSTED'), 0)::text AS "postedCredit"
      FROM accounting.journal_entries j
      WHERE j.company_id = $1 AND EXISTS (
        SELECT 1 FROM accounting.legacy_migration_records r
        WHERE r.company_id = $1 AND r.journal_entry_id = j.journal_entry_id
      )
    `, [companyId]);
    return { companyId, records, journals };
  }
  async issues(query: LegacyIssuesQuery) {
    const [count] = await this.dataSource.query(`
      SELECT COUNT(*)::int AS total FROM accounting.legacy_migration_records
      WHERE company_id = $1 AND status = 'REVIEW'
    `, [query.companyId]);
    const items = await this.dataSource.query(`
      SELECT source_table AS "sourceTable", source_key AS "sourceKey",
        journal_entry_id AS "journalEntryId", issues
      FROM accounting.legacy_migration_records WHERE company_id = $1 AND status = 'REVIEW'
      ORDER BY source_table, source_key LIMIT $2 OFFSET $3
    `, [query.companyId, query.limit, query.offset]);
    return { total: count.total, limit: query.limit, offset: query.offset, items };
  }
}
