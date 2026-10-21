import { Like, Repository } from 'typeorm';
import { LedgerHistory } from './ledger-history.entity';

export async function nextLedgerDocumentNumber(
  repo: Pick<Repository<LedgerHistory>, 'find'>,
  companyId: string,
  docType: string,
  docDate: string,
): Promise<string> {
  const prefix = `${docType}-${docDate.replaceAll('-', '')}-`;
  const existing = await repo.find({
    where: { companyId, docNo: Like(`${prefix}%`) },
    select: { docNo: true },
  });
  let max = 0;
  for (const { docNo } of existing) {
    const sequence = Number(docNo.slice(prefix.length));
    if (Number.isInteger(sequence) && sequence > max) max = sequence;
  }
  return prefix + String(max + 1).padStart(4, '0');
}
