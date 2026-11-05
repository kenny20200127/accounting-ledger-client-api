import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { CreateMainAccountDto } from './dto/create-main-account.dto';
import { MainAccountListQueryDto } from './dto/main-account-list-query.dto';
import { UpdateMainAccountDto } from './dto/update-main-account.dto';
import { MainAccountsService } from './main-accounts.service';

@ApiTags('main-accounts')
@ApiBearerAuth()
@Controller('main-accounts')
export class MainAccountsController {
  constructor(private readonly service: MainAccountsService) {}

  @Get('next-code')
  nextCode(
    @Query('companyId', new ParseUUIDPipe({ version: '4' }))
    companyId: string,
    @Query('accountTypeId', new ParseUUIDPipe({ version: '4' }))
    accountTypeId: string,
  ) {
    return this.service.nextCode(companyId, accountTypeId);
  }

  @Post()
  create(@Body() dto: CreateMainAccountDto, @Req() req: any) {
    return this.service.create(dto, req.actor?.userId);
  }

  @Get()
  findAll(@Query() query: MainAccountListQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateMainAccountDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.service.remove(id);
  }
}
