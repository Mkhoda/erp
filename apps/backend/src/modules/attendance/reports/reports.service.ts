import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { formatJalali, jMonthName, minutesOfDay, minutesToHHMM } from '../engine/jalali.util';
import { fa, findPersianFont } from './persian-pdf.util';

export const STATUS_FA: Record<string, string> = {
  PRESENT: 'حاضر',
  LATE: 'تاخیر',
  EARLY_LEAVE: 'تعجیل',
  ABSENT: 'غیبت',
  INCOMPLETE: 'ناقص',
  LEAVE: 'مرخصی',
  MISSION: 'ماموریت',
  REMOTE_WORK: 'دورکاری',
  HOLIDAY: 'تعطیل رسمی',
  COMPANY_HOLIDAY: 'تعطیل شرکت',
  WEEKEND: 'آخر هفته',
};

const timeOf = (d: Date | null) => (d ? minutesToHHMM(minutesOfDay(d)) : '—');

export interface ReportRow {
  user?: { firstName: string; lastName: string; attendanceCardNo?: string | null; department?: { name: string } | null } | null;
  gregDate: Date;
  firstCheckIn: Date | null;
  lastCheckOut: Date | null;
  workedMinutes: number;
  overtimeMinutes: number;
  delayMinutes: number;
  earlyLeaveMinutes: number;
  nightMinutes: number;
  status: string;
}

export interface ReportMeta {
  title: string;
  jYear?: number;
  jMonth?: number;
  departmentName?: string;
  personName?: string;
}

@Injectable()
export class ReportsService {
  // ── Excel (Persian renders natively) ──────────────────────────────────────
  async buildExcel(rows: ReportRow[], meta: ReportMeta): Promise<ExcelJS.Workbook> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('گزارش حضور و غیاب');
    ws.views = [{ rightToLeft: true }];

    ws.columns = [
      { header: 'ردیف', key: 'i', width: 6 },
      { header: 'نام و نام خانوادگی', key: 'name', width: 24 },
      { header: 'کد کارت', key: 'card', width: 12 },
      { header: 'دپارتمان', key: 'dept', width: 18 },
      { header: 'تاریخ', key: 'date', width: 13 },
      { header: 'ورود', key: 'in', width: 9 },
      { header: 'خروج', key: 'out', width: 9 },
      { header: 'کارکرد', key: 'worked', width: 10 },
      { header: 'اضافه‌کار', key: 'ot', width: 10 },
      { header: 'تاخیر', key: 'delay', width: 9 },
      { header: 'تعجیل', key: 'early', width: 9 },
      { header: 'شب‌کاری', key: 'night', width: 9 },
      { header: 'وضعیت', key: 'status', width: 12 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).alignment = { horizontal: 'center' };

    rows.forEach((r, idx) => {
      ws.addRow({
        i: idx + 1,
        name: r.user ? `${r.user.firstName} ${r.user.lastName}` : '—',
        card: r.user?.attendanceCardNo || '—',
        dept: r.user?.department?.name || '—',
        date: formatJalali(r.gregDate),
        in: timeOf(r.firstCheckIn),
        out: timeOf(r.lastCheckOut),
        worked: minutesToHHMM(r.workedMinutes),
        ot: minutesToHHMM(r.overtimeMinutes),
        delay: minutesToHHMM(r.delayMinutes),
        early: minutesToHHMM(r.earlyLeaveMinutes),
        night: minutesToHHMM(r.nightMinutes),
        status: STATUS_FA[r.status] || r.status,
      });
    });

    // Totals row
    const sum = (k: keyof ReportRow) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
    const total = ws.addRow({
      name: 'جمع کل',
      worked: minutesToHHMM(sum('workedMinutes')),
      ot: minutesToHHMM(sum('overtimeMinutes')),
      delay: minutesToHHMM(sum('delayMinutes')),
      early: minutesToHHMM(sum('earlyLeaveMinutes')),
      night: minutesToHHMM(sum('nightMinutes')),
    });
    total.font = { bold: true };
    ws.eachRow((row) => (row.alignment = { ...row.alignment, vertical: 'middle', horizontal: 'center' }));
    return wb;
  }

  // ── PDF (RTL, IRANSans font, reshaped glyphs) ─────────────────────────────
  buildPdf(rows: ReportRow[], meta: ReportMeta): PDFKit.PDFDocument {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
    const fontPath = findPersianFont();
    if (fontPath) {
      doc.registerFont('fa', fontPath);
      doc.font('fa');
    }

    const pageW = doc.page.width - 60;
    const right = doc.page.width - 30;

    // Title
    let sub = meta.jYear && meta.jMonth ? `${jMonthName(meta.jMonth)} ${meta.jYear}` : '';
    if (meta.departmentName) sub += `  -  ${meta.departmentName}`;
    if (meta.personName) sub += `  -  ${meta.personName}`;
    doc.fontSize(15).text(fa(meta.title), 30, 30, { width: pageW, align: 'center' });
    if (sub) doc.fontSize(10).fillColor('#555').text(fa(sub), 30, 52, { width: pageW, align: 'center' });
    doc.fillColor('#000');

    // Table — columns laid out right-to-left
    const cols = [
      { key: 'status', w: 60, label: 'وضعیت' },
      { key: 'night', w: 50, label: 'شب‌کاری' },
      { key: 'early', w: 50, label: 'تعجیل' },
      { key: 'delay', w: 50, label: 'تاخیر' },
      { key: 'ot', w: 55, label: 'اضافه‌کار' },
      { key: 'worked', w: 55, label: 'کارکرد' },
      { key: 'out', w: 50, label: 'خروج' },
      { key: 'in', w: 50, label: 'ورود' },
      { key: 'date', w: 70, label: 'تاریخ' },
      { key: 'dept', w: 90, label: 'دپارتمان' },
      { key: 'name', w: 130, label: 'نام' },
    ];
    const rowH = 18;
    let y = 78;

    const drawRow = (cells: Record<string, string>, opts: { header?: boolean } = {}) => {
      let x = right;
      doc.fontSize(opts.header ? 9 : 8);
      for (const c of cols) {
        x -= c.w;
        if (opts.header) doc.rect(x, y, c.w, rowH).fill('#eef2ff').fillColor('#000');
        doc.fillColor(opts.header ? '#1e3a8a' : '#000')
          .text(fa(cells[c.key] ?? ''), x + 2, y + 4, { width: c.w - 4, align: 'center', lineBreak: false });
      }
      doc.fillColor('#000');
      y += rowH;
    };

    drawRow(Object.fromEntries(cols.map((c) => [c.key, c.label])), { header: true });

    for (const r of rows) {
      if (y > doc.page.height - 40) {
        doc.addPage();
        y = 30;
        drawRow(Object.fromEntries(cols.map((c) => [c.key, c.label])), { header: true });
      }
      drawRow({
        name: r.user ? `${r.user.firstName} ${r.user.lastName}` : '—',
        dept: r.user?.department?.name || '—',
        date: formatJalali(r.gregDate),
        in: timeOf(r.firstCheckIn),
        out: timeOf(r.lastCheckOut),
        worked: minutesToHHMM(r.workedMinutes),
        ot: minutesToHHMM(r.overtimeMinutes),
        delay: minutesToHHMM(r.delayMinutes),
        early: minutesToHHMM(r.earlyLeaveMinutes),
        night: minutesToHHMM(r.nightMinutes),
        status: STATUS_FA[r.status] || r.status,
      });
    }

    // Caller pipes to the response and invokes doc.end().
    return doc;
  }
}
