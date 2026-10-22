import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CreateAccountTypeDto } from './dto/create-account-type.dto';
import { AccountTypesService } from './account-types.service';

@ApiTags('account-types')
@ApiBearerAuth()
@Controller('account-types')
export class AccountTypesController {
  constructor(private readonly service: AccountTypesService) {}

  @Post()
  create(@Body() dto: CreateAccountTypeDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.service.findOne(id);
  }
}