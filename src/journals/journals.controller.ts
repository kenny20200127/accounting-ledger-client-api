import { CompanyListQueryDto } from '../common/company-list-query.dto';
import { Req, Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { JournalsService } from './journals.service';
import { CreateJournalDto } from './dto/create-journal.dto';

@Controller('journals')
export class JournalsController {
  constructor(private readonly service: JournalsService) {}

  @Post()
  create(@Body() dto: CreateJournalDto, @Req() req: any) {
    return this.service.create({...dto, createdBy: req.actor.userId});
  }

  @Get()
  findAll(@Query() query: CompanyListQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.service.findOne(id);
  }

  @Post(':id/post')
  post(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Req() req: any) {
    return this.service.post(id, req.actor.userId);
  }

  @Post(':id/reverse')
  reverse(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Req() req: any) {
    return this.service.reverse(id, req.actor.userId);
  }
}
