import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { AccountListQueryDto } from './dto/account-list-query.dto';

@Controller('accounts')
export class AccountsController {
  constructor(private readonly service: AccountsService) {}

  @Post()
  create(@Body() dto: CreateAccountDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query() query: AccountListQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.service.findOne(id);
  }
}
