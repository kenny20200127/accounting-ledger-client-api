import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { Account } from '../accounts/account.entity';
import { JournalEntry } from '../journals/journal-entry.entity';
import { BankAccount } from './bank-account.entity';
import { BankTransaction } from './bank-transaction.entity';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { CreateBankTransactionDto } from './dto/create-bank-transaction.dto';

@Injectable()
export class BankingService {
    constructor(
        @InjectRepository(BankAccount)
        private readonly bankAccounts: Repository<BankAccount>,
        @InjectRepository(Account)
        private readonly accounts: Repository<Account>,
        @InjectRepository(BankTransaction)
        private readonly bankTransactions: Repository<BankTransaction>,
        @InjectRepository(JournalEntry)
        private readonly journals: Repository<JournalEntry>,
        private readonly dataSource: DataSource,
    ) { }

    async create(dto: CreateBankAccountDto): Promise<BankAccount> {
        const account = await this.accounts.findOne({
            where: { accountId: dto.accountId },
        });
        if (!account) {
            throw new BadRequestException('Accounting account does not exist.');
        }
        if (account.companyId !== dto.companyId) {
            throw new BadRequestException(
                'Accounting account must belong to the selected company.',
            );
        }

        const openingBalance = dto.openingBalance ?? '0.00';
        const bankAccount = this.bankAccounts.create({
            ...dto,
            currency: dto.currency?.toUpperCase() ?? 'NGN',
            openingBalance,
            currentBalance: openingBalance,
        });
        return this.bankAccounts.save(bankAccount);
    }

    findAll(companyId: string): Promise<BankAccount[]> {
        return this.bankAccounts.find({
            where: { companyId },
            order: { bankName: 'ASC', accountName: 'ASC' },
        });
    }

    async findOne(id: string): Promise<BankAccount> {
        const bankAccount = await this.bankAccounts.findOne({
            where: { bankAccountId: id },
        });
        if (!bankAccount) throw new NotFoundException('Bank account not found.');
        return bankAccount;
    }

    async createTransaction(
        bankAccountId: string,
        dto: CreateBankTransactionDto,
    ): Promise<BankTransaction> {
        if (dto.journalEntryId) {
            const journal = await this.journals.findOne({
                where: { journalEntryId: dto.journalEntryId },
            });
            const bankAccount = await this.findOne(bankAccountId);
            if (!journal || journal.companyId !== bankAccount.companyId) {
                throw new BadRequestException(
                    'Journal entry must exist and belong to the bank account company.',
                );
            }
        }

        try {
            return await this.dataSource.transaction(async manager => {
                const accountRepo = manager.getRepository(BankAccount);
                const transactionRepo = manager.getRepository(BankTransaction);
                const bankAccount = await accountRepo.findOne({
                    where: { bankAccountId },
                    lock: { mode: 'pessimistic_write' },
                });
                if (!bankAccount) throw new NotFoundException('Bank account not found.');

                const priorBalanceCents = toCents(bankAccount.currentBalance);
                const amountCents = toCents(dto.amount);
                const nextBalanceCents = dto.transactionType === 'DEBIT'
                    ? priorBalanceCents + amountCents
                    : priorBalanceCents - amountCents;
                const balance = centsToAmount(nextBalanceCents);

                const transaction = await transactionRepo.save(
                    transactionRepo.create({
                        bankAccountId,
                        transactionDate: dto.transactionDate,
                        valueDate: dto.valueDate ?? null,
                        referenceNumber: dto.referenceNumber ?? null,
                        description: dto.description ?? null,
                        transactionType: dto.transactionType,
                        amount: dto.amount,
                        balance,
                        isReconciled: false,
                        reconciledAt: null,
                        journalEntryId: dto.journalEntryId ?? null,
                    }),
                );

                bankAccount.currentBalance = balance;
                await accountRepo.save(bankAccount);
                return transaction;
            });
        } catch (error) {
            if (
                error instanceof QueryFailedError &&
                (error as any).driverError?.code === '23503'
            ) {
                throw new BadRequestException('Referenced journal entry does not exist.');
            }
            throw error;
        }
    }

    async findTransactions(bankAccountId: string): Promise<BankTransaction[]> {
        await this.findOne(bankAccountId);
        return this.bankTransactions.find({
            where: { bankAccountId },
            order: { transactionDate: 'DESC', createdAt: 'DESC' },
        });
    }

    async reconcileTransaction(
        bankAccountId: string,
        transactionId: string,
    ): Promise<BankTransaction> {
        return this.dataSource.transaction(async manager => {
            const transactionRepo = manager.getRepository(BankTransaction);
            const transaction = await transactionRepo.findOne({
                where: { bankTransactionId: transactionId, bankAccountId },
                lock: { mode: 'pessimistic_write' },
            });
            if (!transaction) throw new NotFoundException('Bank transaction not found.');
            if (transaction.isReconciled) {
                throw new ConflictException('Bank transaction is already reconciled.');
            }
            transaction.isReconciled = true;
            transaction.reconciledAt = new Date();
            return transactionRepo.save(transaction);
        });
    }
}

function toCents(value: string): bigint {
    const [whole, fraction = ''] = String(value).split('.');
    return BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2));
}

function centsToAmount(cents: bigint): string {
    const negative = cents < 0n;
    const absolute = negative ? -cents : cents;
    return `${negative ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
}