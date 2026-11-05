import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { AccountSubtypesService } from './account-subtypes.service';
import { CreateAccountSubtypeDto } from './dto/create-account-subtype.dto';

@ApiTags('account-subtypes')
@ApiBearerAuth()
@Controller('account-subtypes')
export class AccountSubtypesController {
  constructor(private readonly service: AccountSubtypesService) {}

  @Post()
  create(@Body() dto: CreateAccountSubtypeDto, @Req() req: any) {
    return this.service.create(dto, req.actor?.userId);
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
