// Both legs of an auto-posted document must be real, postable chart-of-accounts
// rows of the same company, otherwise ledger.histories ends up one-sided.
import { BadRequestException } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { Account } from '../accounts/account.entity';

export interface AccountSelection {
  label: string;
  accountId: string;
}

export async function assertPostableAccounts(
  manager: EntityManager,
  companyId: string,
  selections: AccountSelection[],
): Promise<Account[]> {
  const ids = selections.map((s) => s.accountId);
  if (new Set(ids).size !== ids.length) {
    throw new BadRequestException(
      'Select different accounts for the debit and credit sides.',
    );
  }

  const accounts = await manager.getRepository(Account).findBy({
    accountId: In(ids),
  });
  const byId = new Map(accounts.map((a) => [a.accountId, a]));

  return selections.map((s) => {
    const account = byId.get(s.accountId);
    if (!account) {
      throw new BadRequestException(
        `${s.label} must be an account from the chart of accounts.`,
      );
    }
    if (account.companyId !== companyId) {
      throw new BadRequestException(
        `${s.label} must belong to the selected company.`,
      );
    }
    if (account.isHeader) {
      throw new BadRequestException(
        `${s.label} "${account.accountCode} ${account.accountName}" is a header account and cannot receive postings.`,
      );
    }
    if (!account.allowPosting) {
      throw new BadRequestException(
        `${s.label} "${account.accountCode} ${account.accountName}" does not allow postings.`,
      );
    }
    if (!account.isActive) {
      throw new BadRequestException(
        `${s.label} "${account.accountCode} ${account.accountName}" is inactive.`,
      );
    }
    return account;
  });
}
