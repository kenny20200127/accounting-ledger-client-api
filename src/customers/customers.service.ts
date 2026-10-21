import { CompanyListQueryDto } from '../common/company-list-query.dto';
import { findCompanyList } from '../common/find-company-list';
import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Account } from '../accounts/account.entity';
import { Company } from '../companies/company.entity';
import { CustomerPayment } from '../payments/customer-payment.entity';
import { Customer } from './customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';

@Injectable()
export class CustomersService {
    constructor(
        @InjectRepository(Customer)
        private readonly customers: Repository<Customer>,
        @InjectRepository(Company)
        private readonly companies: Repository<Company>,
        @InjectRepository(Account)
        private readonly accounts: Repository<Account>,
        @InjectRepository(CustomerPayment)
        private readonly payments: Repository<CustomerPayment>,
    ) { }

    async create(dto: CreateCustomerDto): Promise<Customer> {
        if (!(await this.companies.exists({ where: { companyId: dto.companyId } }))) {
            throw new BadRequestException('Company does not exist.');
        }

        if (dto.receivableAccountId) {
            const account = await this.accounts.findOne({
                where: { accountId: dto.receivableAccountId },
            });
            if (!account || account.companyId !== dto.companyId) {
                throw new BadRequestException(
                    'Receivable account must exist and belong to the selected company.',
                );
            }
        }

        const customer = this.customers.create({
            ...dto,
            creditLimit: dto.creditLimit ?? '0.00',
        });

        try {
            return await this.customers.save(customer);
        } catch (error) {
            if (
                error instanceof QueryFailedError &&
                (error as any).driverError?.code === '23505'
            ) {
                throw new ConflictException(
                    'A customer with this code already exists for the company.',
                );
            }
            throw error;
        }
    }
  findAll(query: CompanyListQueryDto) {
    return findCompanyList(this.customers, query, { order: { customerName: 'ASC', customerId: 'ASC' } }, ['customerCode', 'customerName', 'email']);
  }


    async findOne(id: string): Promise<Customer> {
        const customer = await this.customers.findOne({
            where: { customerId: id },
        });
        if (!customer) throw new NotFoundException('Customer not found.');
        return customer;
    }

    async findPayments(customerId: string): Promise<CustomerPayment[]> {
        await this.findOne(customerId);
        return this.payments.find({
            where: { customerId },
            order: { paymentDate: 'DESC', paymentNumber: 'ASC' },
        });
    }
}