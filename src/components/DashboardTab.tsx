import { useState, useMemo } from 'react';
import { eachDayOfInterval } from 'date-fns';
import { HealthRecord } from '@/types/health';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Download } from 'lucide-react';
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, addMonths } from 'date-fns';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface DashboardTabProps {
  records: HealthRecord[];
  bpReadings?: { date: string; systolic: number; diastolic: number }[];
}

function getMonthOptions() {
  const now = new Date();
  const start = subMonths(now, 12);
  const end = addMonths(now, 1);
  return eachMonthOfInterval({ start, end }).reverse().map(d => ({
    value: format(d, 'yyyy-MM'),
    label: format(d, 'MMM yyyy'),
  }));
}

function buildRows(
  records: HealthRecord[],
  bpReadings: { date: string; systolic: number; diastolic: number }[],
  from: string,
  to: string
) {
  const recordsByDate: Record<string, HealthRecord> = {};
  records.forEach(r => { if (r.date >= from && r.date <= to) recordsByDate[r.date] = r; });

  // Generate all days in the range
  const allDays = eachDayOfInterval({ start: parseISO(from), end: parseISO(to) })
    .map(d => format(d, 'yyyy-MM-dd'));

  const bpByDate: Record<string, { sys: number[]; dia: number[] }> = {};
  bpReadings.forEach(bp => {
    if (bp.date < from || bp.date > to) return;
    if (!bpByDate[bp.date]) bpByDate[bp.date] = { sys: [], dia: [] };
    bpByDate[bp.date].sys.push(bp.systolic);
    bpByDate[bp.date].dia.push(bp.diastolic);
  });

  const rows = allDays.map(day => {
    const r = recordsByDate[day];
    const bpData = bpByDate[day];
    let avgSys = r?.bp_systolic ?? 0;
    let avgDia = r?.bp_diastolic ?? 0;
    if (bpData && bpData.sys.length > 0) {
      avgSys = Math.round(bpData.sys.reduce((a, b) => a + b, 0) / bpData.sys.length);
      avgDia = Math.round(bpData.dia.reduce((a, b) => a + b, 0) / bpData.dia.length);
    }
    return {
      date: format(parseISO(day), 'MMM d'),
      feed: r?.feed_bags ?? 0,
      bile: (r as any)?.bile_bags ?? 0,
      bp: avgSys > 0 ? `${avgSys}/${avgDia}` : '—',
      bpSys: avgSys,
      bpDia: avgDia,
      vomit: (r as any)?.vomit_count ?? 0,
      stool: r?.stool_count ?? 0,
      urine: (r as any)?.urine_count ?? 0,
      flushes: (r as any)?.flush_count ?? 0,
      weight: Number(r?.weight ?? 0),
      hasRecord: !!r,
    };
  });

  const count = rows.length || 1;
  const totals = {
    feed: rows.reduce((s, r) => s + r.feed, 0),
    bile: rows.reduce((s, r) => s + r.bile, 0),
    bpSys: Math.round(rows.filter(r => r.bpSys > 0).reduce((s, r) => s + r.bpSys, 0) / (rows.filter(r => r.bpSys > 0).length || 1)),
    bpDia: Math.round(rows.filter(r => r.bpDia > 0).reduce((s, r) => s + r.bpDia, 0) / (rows.filter(r => r.bpDia > 0).length || 1)),
    vomit: rows.reduce((s, r) => s + r.vomit, 0),
    stool: rows.reduce((s, r) => s + r.stool, 0),
    urine: rows.reduce((s, r) => s + r.urine, 0),
    flushes: rows.reduce((s, r) => s + r.flushes, 0),
    weight: rows.filter(r => r.weight > 0).length > 0
      ? +(rows.filter(r => r.weight > 0).reduce((s, r) => s + r.weight, 0) / rows.filter(r => r.weight > 0).length).toFixed(1)
      : 0,
  };

  return { rows, totals };
}

function generatePdf(title: string, rows: ReturnType<typeof buildRows>['rows'], totals: ReturnType<typeof buildRows>['totals'], filename: string) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  doc.setFontSize(18);
  doc.text('Muhammad Idrees', 14, 15);
  doc.setFontSize(13);
  doc.text(title, 14, 23);
  doc.setFontSize(9);
  doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy h:mm a')}`, 14, 29);

  const startY = 33;
  const body = rows.map(r => [
    r.date,
    String(r.feed),
    String(r.bile),
    r.bp,
    String(r.vomit),
    String(r.stool),
    String(r.urine),
    String(r.flushes),
    r.weight > 0 ? String(r.weight) : '—',
  ]);

  // Add totals row
  body.push([
    'Total/Avg',
    String(totals.feed),
    String(totals.bile),
    totals.bpSys > 0 ? `${totals.bpSys}/${totals.bpDia}` : '—',
    String(totals.vomit),
    String(totals.stool),
    String(totals.urine),
    String(totals.flushes),
    totals.weight > 0 ? String(totals.weight) : '—',
  ]);

  autoTable(doc, {
    startY: 25,
    head,
    body,
    theme: 'grid',
    headStyles: { fillColor: [80, 80, 80], fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    styles: { cellPadding: 2, halign: 'center' },
    columnStyles: { 0: { halign: 'left' } },
    didParseCell: (data) => {
      // Style the totals row
      if (data.row.index === body.length - 1 && data.section === 'body') {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [240, 240, 240];
      }
    },
  });

  doc.save(filename);
}

export function DashboardTab({ records, bpReadings = [] }: DashboardTabProps) {
  const monthOptions = useMemo(() => getMonthOptions(), []);
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0]?.value ?? format(new Date(), 'yyyy-MM'));
  const [weekDate, setWeekDate] = useState<Date>(new Date());

  // Monthly data
  const monthlyData = useMemo(() => {
    const monthStart = format(startOfMonth(parseISO(selectedMonth + '-01')), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(parseISO(selectedMonth + '-01')), 'yyyy-MM-dd');
    return buildRows(records, bpReadings, monthStart, monthEnd);
  }, [records, bpReadings, selectedMonth]);

  // Weekly data
  const weekStart = startOfWeek(weekDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(weekDate, { weekStartsOn: 1 });
  const weeklyData = useMemo(() => {
    return buildRows(records, bpReadings, format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd'));
  }, [records, bpReadings, weekStart, weekEnd]);

  const monthLabel = monthOptions.find(m => m.value === selectedMonth)?.label ?? selectedMonth;
  const weekLabel = `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d, yyyy')}`;

  return (
    <div className="space-y-6 pb-4">
      {/* Weekly PDF */}
      <Card className="border-none shadow-sm">
        <CardHeader className="px-4 pb-2 pt-4">
          <CardTitle className="text-sm font-medium">Weekly Report</CardTitle>
        </CardHeader>
        <CardContent className="px-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-left font-normal text-sm">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {weekLabel}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={weekDate}
                  onSelect={(d) => d && setWeekDate(d)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          <p className="text-xs text-muted-foreground">
            {weeklyData.rows.length} record(s) found for this week
          </p>
          <Button
            onClick={() => generatePdf(
              `Weekly Health Report — ${weekLabel}`,
              weeklyData.rows,
              weeklyData.totals,
              `weekly-report-${format(weekStart, 'yyyy-MM-dd')}.pdf`
            )}
            disabled={weeklyData.rows.length === 0}
            className="w-full"
          >
            <Download className="mr-2 h-4 w-4" />
            Download Weekly PDF
          </Button>
        </CardContent>
      </Card>

      {/* Monthly PDF */}
      <Card className="border-none shadow-sm">
        <CardHeader className="px-4 pb-2 pt-4">
          <CardTitle className="text-sm font-medium">Monthly Report</CardTitle>
        </CardHeader>
        <CardContent className="px-4 space-y-3">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {monthlyData.rows.length} record(s) found for {monthLabel}
          </p>
          <Button
            onClick={() => generatePdf(
              `Monthly Health Report — ${monthLabel}`,
              monthlyData.rows,
              monthlyData.totals,
              `monthly-report-${selectedMonth}.pdf`
            )}
            disabled={monthlyData.rows.length === 0}
            className="w-full"
          >
            <Download className="mr-2 h-4 w-4" />
            Download Monthly PDF
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
