import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CompanyListQueryDto } from '../common/company-list-query.dto';
import {
  Req,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoicesService } from './invoices.service';

@ApiTags('invoices')
@ApiBearerAuth()
@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly pdf: InvoicePdfService,
  ) {}

  @Post()
  create(@Body() dto: CreateInvoiceDto, @Req() req: any) {
    return this.invoicesService.create({...dto, createdBy: req.actor.userId});
  }

  @Get()
  findAll(@Query() query: CompanyListQueryDto) {
    return this.invoicesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.invoicesService.findOne(id);
  }

  @Get(':id/pdf')
  async download(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<StreamableFile> {
    const invoice = await this.invoicesService.findForDocument(id);
    const buffer = await this.pdf.render(invoice);
    const filename = invoice.invoiceNumber.replace(/[^\w.-]+/g, '-');
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${filename}.pdf"`,
      length: buffer.length,
    });
  }
}
