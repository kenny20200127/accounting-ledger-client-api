import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CreateAccountCategoryDto } from './dto/create-account-category.dto';
import { AccountCategoriesService } from './account-categories.service';

@ApiTags('account-categories')
@ApiBearerAuth()
@Controller('account-categories')
export class AccountCategoriesController {
  constructor(private readonly service: AccountCategoriesService) {}

  @Post()
  create(@Body() dto: CreateAccountCategoryDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(
    @Query('accountTypeId', new ParseUUIDPipe({ version: '4' })) accountTypeId: string,
  ) {
    return this.service.findAll(accountTypeId);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.service.findOne(id);
  }
}