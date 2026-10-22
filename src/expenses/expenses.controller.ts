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
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ExpensesService } from './expenses.service';

@ApiTags('expenses')
@ApiBearerAuth()
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  create(@Body() dto: CreateExpenseDto, @Req() req: any) {
    return this.expensesService.create({...dto, createdBy: req.actor.userId});
  }

  @Get()
  findAll(
    @Query('companyId', new ParseUUIDPipe({ version: '4' })) companyId: string,
  ) {
    return this.expensesService.findAll(companyId);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.expensesService.findOne(id);
  }
}