import { Like, Repository } from 'typeorm';
import { CustomerPayment } from './customer-payment.entity';

export async function nextPaymentNumber(
  repo: Pick<Repository<CustomerPayment>, 'find'>,
  companyId: string,
  paymentDate: string,
): Promise<string> {
  const prefix = `PAY-${paymentDate.replaceAll('-', '')}-`;
  const existing = await repo.find({
    where: { companyId, paymentNumber: Like(`${prefix}%`) },
    select: { paymentNumber: true },
  });
  let max = 0;
  for (const { paymentNumber } of existing) {
    const sequence = Number(paymentNumber.slice(prefix.length));
    if (Number.isInteger(sequence) && sequence > max) max = sequence;
  }
  return prefix + String(max + 1).padStart(4, '0');
}
