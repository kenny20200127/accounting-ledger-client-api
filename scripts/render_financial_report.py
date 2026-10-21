"""Render application-owned financial report JSON from stdin to a PDF on stdout."""
import base64
import re
import io
import json
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

def render(report):
    output=io.BytesIO()
    width,height=A4
    available=width-64
    primary=colors.HexColor(report.get('primaryColor') if re.fullmatch(r'#[0-9A-Fa-f]{6}',report.get('primaryColor','')) else '#273a30')
    secondary=colors.HexColor(report.get('secondaryColor') if re.fullmatch(r'#[0-9A-Fa-f]{6}',report.get('secondaryColor','')) else '#edf3ef')
    logo=None
    data=report.get('logoData') or ''
    if data.startswith('data:image/png;base64,') and len(data)<3_000_000:
        try:
            logo=ImageReader(io.BytesIO(base64.b64decode(data.split(',',1)[1],validate=True)))
        except Exception:
            logo=None
    logo_height=42 if logo else 0
    header_blocks=[]
    for text,size,leading,font in [(report['companyName'],10,12,'ReportBold'),(report.get('address',''),8,10,'Report'),(report['title'],12,15,'ReportBold'),
        (f"As at: {report['asOf']} | {report['branchName']} | Currency: {report['currency']}",7.4,9,'Report')]:
        if not text:continue
        paragraph=Paragraph(escape(text),ParagraphStyle('Header',fontName=font,fontSize=size,leading=leading,alignment=TA_CENTER))
        _,ph=paragraph.wrap(available,height)
        header_blocks.append((paragraph,ph))
    top_margin=30+logo_height+sum(ph+5 for _,ph in header_blocks)+19
    doc=SimpleDocTemplate(output,pagesize=A4,rightMargin=32,leftMargin=32,topMargin=top_margin,bottomMargin=42,
        title=report['title'],author=report['companyName'])
    normal=ParagraphStyle('Normal',fontName='Report',fontSize=7.4,leading=9,spaceAfter=0)
    note=ParagraphStyle('Note',parent=normal,fontSize=7.3,leading=10,textColor=colors.HexColor('#46534c'))
    bold=ParagraphStyle('Bold',parent=normal,fontName='ReportBold')
    columns=report['columns']
    if report['kind']=='trial-balance': widths=[77,available-77-4*69,69,69,69,69]
    elif report['kind']=='profit-loss': widths=[available-200,100,100]
    else: widths=[87,available-207,120]
    def cell(value,index,header=False,is_bold=False,numeric=False):
        text=monetary(value) if numeric else str(value or '')
        style=ParagraphStyle('Cell',parent=bold if header or is_bold else normal,
            alignment=TA_RIGHT if numeric or (header and columns[index].get('numeric')) else TA_LEFT)
        if numeric:
            text_width=pdfmetrics.stringWidth(text,style.fontName,style.fontSize)
            if text_width>widths[index]-12: style.fontSize=max(4.5,style.fontSize*(widths[index]-12)/text_width)
            style.splitLongWords=False
        return Paragraph(escape(text),style)
    data=[[cell(column['label'],i,header=True) for i,column in enumerate(columns)]]
    commands=[('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),5),('RIGHTPADDING',(0,0),(-1,-1),5),
        ('TOPPADDING',(0,0),(-1,-1),1.5),('BOTTOMPADDING',(0,0),(-1,-1),1.5),
        ('BACKGROUND',(0,0),(-1,0),secondary),('LINEBELOW',(0,0),(-1,0),0.8,primary)]
    for row in report['rows']:
        row_index=len(data)
        if row.get('isSection'):
            data.append([Paragraph(escape(row['description']),bold)]+['']*(len(columns)-1))
            commands += [('SPAN',(0,row_index),(-1,row_index)),('BACKGROUND',(0,row_index),(-1,row_index),colors.HexColor('#f3f6f4'))]
        else:
            data.append([cell(row.get(column['key'],'0.00' if column.get('numeric') else ''),i,
                is_bold=row.get('isTotal',False),numeric=column.get('numeric',False)) for i,column in enumerate(columns)])
            if row.get('isTotal'): commands.append(('LINEABOVE',(0,row_index),(-1,row_index),0.4,colors.HexColor('#8b978f')))
    if not report['rows']:
        data.append([Paragraph('No matching accounts or transactions for these filters.',normal)]+['']*(len(columns)-1))
        commands.append(('SPAN',(0,1),(-1,1)))
    for total in report['totals']:
        row_index=len(data)
        cells=[]
        label_index=next((i for i,c in enumerate(columns) if c['key']=='description'),0)
        for i,column in enumerate(columns):
            if i==label_index: cells.append(cell(total['label'],i,is_bold=True))
            elif column.get('numeric'): cells.append(cell(total['values'].get(column['key'],'0.00'),i,is_bold=True,numeric=True))
            else: cells.append('')
        data.append(cells)
        commands += [('LINEABOVE',(0,row_index),(-1,row_index),0.8,primary),
                     ('BACKGROUND',(0,row_index),(-1,row_index),secondary)]
    if report['kind']=='trial-balance':
        row_index=len(data)
        data.append([Paragraph('TRIAL BALANCE OK' if report.get('balanced') else 'TRIAL BALANCE REQUIRES REVIEW',bold)]+['']*(len(columns)-1))
        commands.append(('SPAN',(0,row_index),(-1,row_index)))
    # Keep totals with preceding account rows instead of producing a totals-only page.
    commands.append(('NOSPLIT',(0,max(1,len(data)-4)),(-1,len(data)-1)))
    for index,row in enumerate(report['rows'],1):
        if row.get('isSection') and index+1<len(data):
            commands.append(('NOSPLIT',(0,index),(-1,index+1)))
    table=LongTable(data,colWidths=widths,repeatRows=1,hAlign='LEFT')
    table.setStyle(TableStyle(commands))
    story=[]
    if report['kind']=='trial-balance':
        story += [Paragraph('Current month: net movement. Year to date: closing balance including brought-forward posted entries.',note),Spacer(1,6)]
    elif report['kind']=='profit-loss':
        story += [Paragraph('Credit income and profit appear in parentheses. Year to date starts '+escape(report['fiscalYearStart'])+'.',note),Spacer(1,6)]
    for warning in report.get('warnings',[]):
        story.append(Paragraph(escape(warning),note))
    if report.get('warnings'):story.append(Spacer(1,8))
    story.append(table)
    stamp=datetime.fromisoformat(report['generatedAt'].replace('Z','+00:00')).astimezone(timezone(timedelta(hours=1))).strftime('%d/%m/%Y %H:%M')
    def header_footer(canvas,document):
        canvas.saveState()
        y=height-30
        if logo:
            lw,lh=logo.getSize(); scale=min(110/lw,36/lh)
            canvas.drawImage(logo,(width-lw*scale)/2,y-lh*scale,width=lw*scale,height=lh*scale,mask='auto')
            y-=logo_height
        for paragraph,ph in header_blocks:
            paragraph.drawOn(canvas,32,y-ph);y-=ph+5
        canvas.setFont('Report',7)
        canvas.drawString(32,y-8,'Produced on: '+stamp+' (Africa/Lagos)')
        canvas.drawRightString(width-32,y-8,'Fiscal year start: '+report['fiscalYearStart'])
        canvas.setStrokeColor(primary);canvas.line(32,y-13,width-32,y-13)
        canvas.setFillColor(colors.HexColor('#58655c'));canvas.setFont('Report',7)
        canvas.drawString(32,24,'Based on posted journal entries')
        canvas.drawRightString(width-32,24,'Page '+str(document.page))
        canvas.restoreState()
    doc.build(story,onFirstPage=header_footer,onLaterPages=header_footer)
    return output.getvalue()

if __name__=='__main__':
    report=json.loads(sys.stdin.buffer.read().decode('utf-8'))
    sys.stdout.buffer.write(render(report))
