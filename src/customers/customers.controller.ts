import { CompanyListQueryDto } from '../common/company-list-query.dto';
import {
    Body,
    Controller,
    Get,
    Param,
    ParseUUIDPipe,
    Post,
    Query,
} from '@nestjs/common';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CustomersService } from './customers.service';

@Controller('customers')
export class CustomersController {
    constructor(private readonly customersService: CustomersService) { }

    @Post()
    create(@Body() dto: CreateCustomerDto) {
        return this.customersService.create(dto);
    }

    @Get()
    findAll(@Query() query: CompanyListQueryDto) {
        return this.customersService.findAll(query);
    }

    @Get(':id/payments')
    findPayments(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
        return this.customersService.findPayments(id);
    }

    @Get(':id')
    findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
        return this.customersService.findOne(id);
    }
}