import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
    Body,
    Controller,
    Get,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Query,
} from '@nestjs/common';
import { BankingService } from './banking.service';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { CreateBankTransactionDto } from './dto/create-bank-transaction.dto';

@ApiTags('banking/accounts')
@ApiBearerAuth()
@Controller('banking/accounts')
export class BankingController {
    constructor(private readonly bankingService: BankingService) { }

    @Post()
    create(@Body() dto: CreateBankAccountDto) {
        return this.bankingService.create(dto);
    }

    @Get()
    findAll(
        @Query('companyId', new ParseUUIDPipe({ version: '4' })) companyId: string,
    ) {
        return this.bankingService.findAll(companyId);
    }

    @Get(':id')
    findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
        return this.bankingService.findOne(id);
    }

    @Post(':id/transactions')
    createTransaction(
        @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
        @Body() dto: CreateBankTransactionDto,
    ) {
        return this.bankingService.createTransaction(id, dto);
    }

    @Get(':id/transactions')
    findTransactions(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
        return this.bankingService.findTransactions(id);
    }

    @Patch(':id/transactions/:transactionId/reconcile')
    reconcileTransaction(
        @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
        @Param('transactionId', new ParseUUIDPipe({ version: '4' })) transactionId: string,
    ) {
        return this.bankingService.reconcileTransaction(id, transactionId);
    }
}