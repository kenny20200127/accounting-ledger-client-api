// Shared helper that posts transaction lines (payments, expenses, ...) to the
// ledger: one history row per line against the account, auto document number,
// and running balances in ledger.ledgers — inside the caller's transaction.
import { EntityManager } from 'typeorm';
import { LedgerHistory } from './ledger-history.entity';
import { nextLedgerDocumentNumber } from './ledger-document-number';

export interface LedgerPostingLine {
  accountId: string;
  debit: string;
  credit: string;
  remarks?: string | null;
}

export interface LedgerPostingInput {
  companyId: string;
  branchId?: string | null;
  docType: string;
  docDate: string; // YYYY-MM-DD
  refNo?: string | null;
  createdBy?: string | null;
  // Unique source identifier, e.g. `payment:<uuid>`; history rows are tagged
  // AUTO::<sourceKey>::<line> so a transaction is never posted to the ledger twice.
  sourceKey: string;
  lines: LedgerPostingLine[];
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

export async function postLedgerLines(
  manager: EntityManager,
  input: LedgerPostingInput,
): Promise<string | null> {
  const histories = manager.getRepository(LedgerHistory);
  const relevant = input.lines.filter(
    (line) => toCents(line.debit) !== 0n || toCents(line.credit) !== 0n,
  );
  if (relevant.length === 0) return null;
  if (await histories.exists({ where: { legacyRef: `AUTO::${input.sourceKey}::0` } })) {
    return null;
  }

  const docNo = await nextLedgerDocumentNumber(
    histories,
    input.companyId,
    input.docType,
    input.docDate,
  );
  const period = input.docDate.slice(0, 7).replace('-', '');

  const deltas = new Map<string, { debit: bigint; credit: bigint; count: number }>();
  for (const line of relevant) {
    const delta =
      deltas.get(line.accountId) ?? { debit: 0n, credit: 0n, count: 0 };
    delta.debit += toCents(line.debit);
    delta.credit += toCents(line.credit);
    delta.count++;
    deltas.set(line.accountId, delta);
  }
  for (const [accountId, delta] of deltas) {
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
        input.companyId,
        accountId,
        input.branchId ?? null,
        centsToAmount(delta.debit),
        centsToAmount(delta.credit),
        delta.count,
        input.createdBy ?? null,
      ],
    );
  }

  await histories.save(
    relevant.map((line, index) => {
      const debitCents = toCents(line.debit);
      const creditCents = toCents(line.credit);
      return histories.create({
        companyId: input.companyId,
        accountId: line.accountId,
        branchId: input.branchId ?? null,
        docNo,
        docType: input.docType,
        refNo: input.refNo ?? null,
        docDate: input.docDate,
        period,
        debitAmount: centsToAmount(debitCents),
        creditAmount: centsToAmount(creditCents),
        netAmount: centsToAmount(debitCents - creditCents),
        remarks: line.remarks ?? null,
        createdBy: input.createdBy ?? null,
        legacyRef: `AUTO::${input.sourceKey}::${index}`,
      });
    }),
  );

  return docNo;
}
