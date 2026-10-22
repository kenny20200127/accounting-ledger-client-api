import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  Req, Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CreateCustomerPaymentDto } from './dto/create-customer-payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('customer-payments')
@ApiBearerAuth()
@Controller('customer-payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  create(@Body() dto: CreateCustomerPaymentDto, @Req() req: any) {
    return this.paymentsService.create({...dto, createdBy: req.actor.userId});
  }

  @Get()
  findAll(
    @Query('companyId', new ParseUUIDPipe({ version: '4' })) companyId: string,
    @Query('customerId', new ParseUUIDPipe({ version: '4', optional: true }))
    customerId?: string,
  ) {
    return this.paymentsService.findAll(companyId, customerId);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.paymentsService.findOne(id);
  }
}