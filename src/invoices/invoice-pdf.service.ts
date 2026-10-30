import { Injectable } from '@nestjs/common';
import { renderPdfViaPython } from '../pdf/python-pdf';

export interface InvoiceDocument {
  companyName: string;
  companyAddress?: string;
  taxNumber?: string;
  logoData?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  currency?: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string | null;
  status: string;
  customerName: string;
  customerAddress?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerTaxNumber?: string | null;
  lines: Array<{
    description: string;
    quantity: string;
    unitPrice: string;
    discountAmount: string;
    taxAmount: string;
    lineTotal: string;
  }>;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  totalAmount: string;
  amountPaid: string;
  balanceDue: string;
  generatedAt: string;
}

@Injectable()
export class InvoicePdfService {
  render(invoice: InvoiceDocument): Promise<Buffer> {
    return renderPdfViaPython(
      'scripts/render_invoice_pdf.py',
      invoice,
      'Invoice PDF exceeds the download size limit.',
    );
  }
}
