"""Render application-owned invoice JSON from stdin to a PDF on stdout."""
import base64
import io
import json
import re
import sys
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.lib.utils import ImageReader
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, LongTable, TableStyle
import reportlab

FONT_DIR = Path(reportlab.__file__).parent / 'fonts'
for name, file in [('Report','Vera.ttf'), ('ReportBold','VeraBd.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(FONT_DIR / file)))

def monetary(value):
    number=Decimal(str(value))
    formatted=f'{abs(number):,.2f}'
    return '('+formatted+')' if number<0 else formatted

def hex_color(value, fallback):
    if value and re.fullmatch(r'#[0-9A-Fa-f]{6}', value): return colors.HexColor(value)
    return colors.HexColor(fallback)

def render(invoice):
    output=io.BytesIO()
    width,height=A4
    available=width-64
    primary=hex_color(invoice.get('primaryColor'),'#176246')
    secondary=hex_color(invoice.get('secondaryColor'),'#edf5ef')
    logo=None
    data=invoice.get('logoData') or ''
    if data.startswith('data:image/png;base64,') and len(data)<3_000_000:
        try:
            logo=ImageReader(io.BytesIO(base64.b64decode(data.split(',',1)[1],validate=True)))
        except Exception:
            logo=None
    logo_height=42 if logo else 0
    normal=ParagraphStyle('Normal',fontName='Report',fontSize=8.5,leading=11,spaceAfter=0)
    bold=ParagraphStyle('Bold',parent=normal,fontName='ReportBold')
    small=ParagraphStyle('Small',parent=normal,fontSize=7.4,leading=9,textColor=colors.HexColor('#46534c'))
    meta_label=ParagraphStyle('MetaLabel',parent=small,fontName='ReportBold',textColor=colors.HexColor('#58655c'))

    story=[]
    story += [Paragraph(escape(invoice['companyName']),ParagraphStyle('Company',fontName='ReportBold',fontSize=13,leading=16,alignment=TA_CENTER))]
    if invoice.get('companyAddress'):
        story.append(Paragraph(escape(invoice['companyAddress']),ParagraphStyle('Addr',fontName='Report',fontSize=8,leading=10,alignment=TA_CENTER,textColor=colors.HexColor('#46534c'))))
    story += [Spacer(1,14),
        Paragraph('INVOICE',ParagraphStyle('Title',fontName='ReportBold',fontSize=18,leading=22,alignment=TA_CENTER,textColor=primary)),
        Spacer(1,14)]

    currency=invoice.get('currency','')
    meta_rows=[('Invoice number',invoice['invoiceNumber']),('Invoice date',invoice['invoiceDate'])]
    if invoice.get('dueDate'): meta_rows.append(('Due date',invoice['dueDate']))
    meta_rows.append(('Status',invoice.get('status','')))
    meta=[[Paragraph(escape(label),meta_label),Paragraph(escape(str(value)),normal)] for label,value in meta_rows]
    bill_rows=[('Bill to',invoice.get('customerName',''))]
    for label,value in [('Address',invoice.get('customerAddress')),('Email',invoice.get('customerEmail')),('Phone',invoice.get('customerPhone')),('Tax number',invoice.get('customerTaxNumber'))]:
        if value: bill_rows.append((label,str(value)))
    bill=[[Paragraph(escape(label),meta_label),Paragraph(escape(str(value)),normal)] for label,value in bill_rows]
    info=LongTable([[meta,bill]],colWidths=[available/2,available/2],hAlign='LEFT')
    info.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),12),
        ('TOPPADDING',(0,0),(-1,-1),0),('BOTTOMPADDING',(0,0),(-1,-1),0),
        ('LINEAFTER',(0,0),(0,0),0.8,colors.HexColor('#c9d4cd'))]))
    story += [info,Spacer(1,16)]

    columns=[('Description',available-(66+84+70+70+90),None),('Qty',66,'R'),('Unit price',84,'R'),('Discount',70,'R'),('Tax',70,'R'),('Amount',90,'R')]
    data=[[Paragraph(escape(label),ParagraphStyle('CellHeader',parent=bold,textColor=colors.white,
        alignment=TA_RIGHT if align else TA_LEFT)) for label,w,align in columns]]
    commands=[('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),5),('RIGHTPADDING',(0,0),(-1,-1),5),
        ('TOPPADDING',(0,0),(-1,-1),3),('BOTTOMPADDING',(0,0),(-1,-1),3),
        ('BACKGROUND',(0,0),(-1,0),primary),('LINEBELOW',(0,0),(-1,0),0.8,primary),
        ('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,secondary])]
    for line in invoice['lines']:
        cells=[Paragraph(escape(line['description']),normal),
            Paragraph(escape(str(line['quantity'])),ParagraphStyle('Cell',parent=normal,alignment=TA_RIGHT)),
            Paragraph(monetary(line['unitPrice']),ParagraphStyle('Cell',parent=normal,alignment=TA_RIGHT)),
            Paragraph(monetary(line['discountAmount']),ParagraphStyle('Cell',parent=normal,alignment=TA_RIGHT)),
            Paragraph(monetary(line['taxAmount']),ParagraphStyle('Cell',parent=normal,alignment=TA_RIGHT)),
            Paragraph(monetary(line['lineTotal']),ParagraphStyle('Cell',parent=bold,alignment=TA_RIGHT))]
        data.append(cells)
    table=LongTable(data,colWidths=[w for _,w,_ in columns],repeatRows=1,hAlign='LEFT')
    table.setStyle(TableStyle(commands))
    story.append(table)
    story.append(Spacer(1,10))

    totals=[('Subtotal',invoice['subtotal']),('Discount',invoice['discountAmount']),('Tax',invoice['taxAmount']),
        ('Total',invoice['totalAmount']),('Amount paid',invoice['amountPaid']),('Balance due',invoice['balanceDue'])]
    totals_data=[]
    for label,value in totals:
        is_total=label in ('Total','Balance due')
        totals_data.append([Paragraph(escape(label),bold if is_total else small),
            Paragraph(monetary(value),ParagraphStyle('TotalCell',parent=bold if is_total else normal,alignment=TA_RIGHT))])
    totals_table=LongTable(totals_data,colWidths=[140,110],hAlign='RIGHT')
    total_style=TableStyle([('LEFTPADDING',(0,0),(-1,-1),5),('RIGHTPADDING',(0,0),(-1,-1),5),
        ('TOPPADDING',(0,0),(-1,-1),2.5),('BOTTOMPADDING',(0,0),(-1,-1),2.5),('ALIGN',(1,0),(1,-1),'RIGHT')])
    for index,(label,_) in enumerate(totals):
        if label=='Total': total_style.add('LINEABOVE',(0,index),(-1,index),0.8,primary)
        if label in ('Total','Balance due'):
            total_style.add('BACKGROUND',(0,index),(-1,index),secondary)
        if label=='Balance due': total_style.add('LINEBELOW',(0,index),(-1,index),0.8,primary)
    totals_table.setStyle(total_style)
    story.append(totals_table)

    doc=SimpleDocTemplate(output,pagesize=A4,rightMargin=32,leftMargin=32,topMargin=54+logo_height,bottomMargin=48,
        title='Invoice '+invoice['invoiceNumber'],author=invoice['companyName'])
    stamp=datetime.fromisoformat(invoice['generatedAt'].replace('Z','+00:00')).astimezone(timezone(timedelta(hours=1))).strftime('%d/%m/%Y %H:%M')
    def header_footer(canvas,document):
        canvas.saveState()
        y=height-30
        if logo:
            lw,lh=logo.getSize(); scale=min(110/lw,36/lh)
            canvas.drawImage(logo,(width-lw*scale)/2,y-lh*scale,width=lw*scale,height=lh*scale,mask='auto')
            y-=logo_height
        canvas.setFont('Report',7)
        canvas.drawString(32,24,'Produced on: '+stamp+' (Africa/Lagos)')
        if currency: canvas.drawString(32,36,'All amounts in '+currency)
        canvas.drawRightString(width-32,24,'Page '+str(document.page))
        canvas.setStrokeColor(primary)
        canvas.line(32,height-40,width-32,height-40)
        canvas.restoreState()
    doc.build(story,onFirstPage=header_footer,onLaterPages=header_footer)
    return output.getvalue()

if __name__=='__main__':
    invoice=json.loads(sys.stdin.buffer.read().decode('utf-8'))
    sys.stdout.buffer.write(render(invoice))
