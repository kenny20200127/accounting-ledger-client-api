import { Like, Repository } from 'typeorm';
import { Invoice } from './invoice.entity';

export async function nextInvoiceNumber(
  repo: Pick<Repository<Invoice>, 'find'>,
  companyId: string,
  invoiceDate: string,
): Promise<string> {
  const prefix = `INV-${invoiceDate.replaceAll('-', '')}-`;
  const existing = await repo.find({
    where: { companyId, invoiceNumber: Like(`${prefix}%`) },
    select: { invoiceNumber: true },
  });
  let max = 0;
  for (const { invoiceNumber } of existing) {
    const sequence = Number(invoiceNumber.slice(prefix.length));
    if (Number.isInteger(sequence) && sequence > max) max = sequence;
  }
  return prefix + String(max + 1).padStart(4, '0');
}
