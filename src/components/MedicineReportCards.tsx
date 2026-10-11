import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { medicineKeys, fetchMedicinesList } from '@/hooks/useMedicines';
import { useHousehold } from '@/hooks/HouseholdProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Download, Pill } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchAllRows } from '@/lib/fetchAll';
import { getMonthOptions } from '@/lib/reportHelpers';
import {
  format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  eachDayOfInterval,
} from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface MedicineInfo {
  id: string;
  name: string;
  potency: string;
  amount: string;
  category: string;
}

interface MedLog {
  id: string;
  date: string;
  medicine_id: string;
}

function useMedicineLogsForRange(from: string, to: string) {
  const { householdId } = useHousehold();
  return useQuery({
    queryKey: [...medicineKeys.reports(householdId), from, to],
    enabled: !!householdId,
    queryFn: () => fetchAllRows<MedLog>((start, end) => supabase
      .from('medicine_logs')
      .select('id, date, medicine_id', { count: 'exact' })
      .eq('household_id', householdId!)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true })
      .order('id', { ascending: true })
      .range(start, end)),
  });
}

function buildMedRows(medicines: MedicineInfo[], logs: MedLog[], from: string, to: string) {
  const days = eachDayOfInterval({ start: parseISO(from), end: parseISO(to) })
    .map(d => format(d, 'yyyy-MM-dd'));

  // Only medicine category
  const meds = medicines.filter(m => m.category === 'medicine');
  const medMap = new Map(meds.map(m => [m.id, m]));

  // Count per day per medicine
  const counts: Record<string, Record<string, number>> = {};
  logs.forEach(l => {
    if (l.date < from || l.date > to) return;
    if (!medMap.has(l.medicine_id)) return;
    if (!counts[l.date]) counts[l.date] = {};
    counts[l.date][l.medicine_id] = (counts[l.date][l.medicine_id] || 0) + 1;
  });

  // Build rows: each day → list of meds taken with count × amount/potency
  const rows = days.map(day => {
    const dayCounts = counts[day] || {};
    const items: string[] = [];
    meds.forEach(m => {
      const c = dayCounts[m.id];
      if (!c) return;
      const label = m.potency ? `${m.name} ${m.potency}` : m.name;
      const amountStr = m.amount ? ` (${m.amount})` : '';
      items.push(`${c}× ${label}${amountStr}`);
    });
    return {
      date: day,
      dateLabel: format(parseISO(day), 'MMM d, EEE'),
      items,
      totalDoses: Object.values(dayCounts).reduce((s, v) => s + v, 0),
    };
  });

  // Totals per medicine across period
  const totals: Record<string, number> = {};
  Object.values(counts).forEach(dc => {
    Object.entries(dc).forEach(([mid, c]) => { totals[mid] = (totals[mid] || 0) + c; });
  });

  const totalSummary = meds
    .filter(m => totals[m.id])
    .map(m => {
      const label = m.potency ? `${m.name} ${m.potency}` : m.name;
      return `${totals[m.id]}× ${label}`;
    });

  return { rows, totalSummary, totalDoses: Object.values(totals).reduce((s, v) => s + v, 0) };
}

function generateMedPdf(
  title: string,
  medicines: MedicineInfo[],
  data: ReturnType<typeof buildMedRows>,
  filename: string,
  careRecipientName: string
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setFontSize(18);
  doc.text(careRecipientName, 14, 15);
  doc.setFontSize(13);
  doc.text(title, 14, 23);
  doc.setFontSize(9);
  doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy h:mm a')}`, 14, 29);

  const head = [['Date', 'Medicines Taken', 'Doses']];
  const body = data.rows.map(r => [
    r.dateLabel,
    r.items.length > 0 ? r.items.join('\n') : '—',
    r.totalDoses > 0 ? String(r.totalDoses) : '—',
  ]);

  body.push(['TOTAL', data.totalSummary.join('\n') || '—', String(data.totalDoses)]);

  autoTable(doc, {
    startY: 33,
    head,
    body,
    theme: 'grid',
    headStyles: { fillColor: [80, 80, 80], fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    styles: { cellPadding: 2 },
    columnStyles: { 0: { cellWidth: 35 }, 2: { halign: 'center', cellWidth: 20 } },
    didParseCell: (cellData) => {
      if (cellData.row.index === body.length - 1 && cellData.section === 'body') {
        cellData.cell.styles.fontStyle = 'bold';
        cellData.cell.styles.fillColor = [240, 240, 240];
      }
    },
  });

  doc.save(filename);
}

export function MedicineReportCards() {
  const { householdId, careRecipientName } = useHousehold();
  const monthOptions = useMemo(() => getMonthOptions(), []);
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0]?.value ?? format(new Date(), 'yyyy-MM'));
  const [weekDate, setWeekDate] = useState<Date>(new Date());

  const { data: medicines = [], isLoading: medsLoading } = useQuery({
    queryKey: medicineKeys.list(householdId),
    queryFn: () => fetchMedicinesList(householdId!),
    enabled: !!householdId,
  });

  const weekStart = startOfWeek(weekDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(weekDate, { weekStartsOn: 1 });
  const weekLabel = `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d, yyyy')}`;
  const weekFrom = format(weekStart, 'yyyy-MM-dd');
  const weekTo = format(weekEnd, 'yyyy-MM-dd');
  const monthStart = startOfMonth(parseISO(selectedMonth + '-01'));
  const monthFrom = format(monthStart, 'yyyy-MM-dd');
  const monthTo = format(endOfMonth(monthStart), 'yyyy-MM-dd');
  const { data: weeklyLogs = [], isLoading: weeklyLoading } = useMedicineLogsForRange(weekFrom, weekTo);
  const { data: monthlyLogs = [], isLoading: monthlyLoading } = useMedicineLogsForRange(monthFrom, monthTo);
  const loading = medsLoading || weeklyLoading || monthlyLoading;

  const weeklyData = useMemo(
    () => buildMedRows(medicines, weeklyLogs, weekFrom, weekTo),
    [medicines, weeklyLogs, weekFrom, weekTo]
  );

  const monthlyData = useMemo(
    () => buildMedRows(medicines, monthlyLogs, monthFrom, monthTo),
    [medicines, monthlyLogs, monthFrom, monthTo]
  );

  const monthLabel = monthOptions.find(m => m.value === selectedMonth)?.label ?? selectedMonth;

  if (loading) return <p className="text-sm text-muted-foreground px-4">Loading medicine data…</p>;

  return (
    <>
      {/* Weekly Medicine Report */}
      <Card className="border-none shadow-sm">
        <CardHeader className="px-4 pb-2 pt-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Pill className="h-4 w-4" /> Weekly Medicine Report
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 space-y-3">
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

          {/* Inline preview */}
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {weeklyData.rows.filter(r => r.totalDoses > 0).map(r => (
              <div key={r.date} className="flex justify-between text-xs border-b border-border/50 py-1">
                <span className="font-medium text-muted-foreground w-20 shrink-0">{format(parseISO(r.date), 'EEE d')}</span>
                <span className="flex-1 text-foreground">{r.items.join(', ')}</span>
                <span className="text-muted-foreground ml-2">{r.totalDoses}</span>
              </div>
            ))}
            {weeklyData.totalDoses === 0 && <p className="text-xs text-muted-foreground">No medicine logs this week.</p>}
          </div>

          <Button
            onClick={() => generateMedPdf(
              `Weekly Medicine Report — ${weekLabel}`,
              medicines,
              weeklyData,
              `weekly-medicine-${format(weekStart, 'yyyy-MM-dd')}.pdf`, careRecipientName
            )}
            disabled={weeklyData.totalDoses === 0}
            className="w-full"
          >
            <Download className="mr-2 h-4 w-4" />
            Download Weekly Medicine PDF
          </Button>
        </CardContent>
      </Card>

      {/* Monthly Medicine Report */}
      <Card className="border-none shadow-sm">
        <CardHeader className="px-4 pb-2 pt-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Pill className="h-4 w-4" /> Monthly Medicine Report
          </CardTitle>
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

          {/* Summary */}
          {monthlyData.totalDoses > 0 && (
            <div className="text-xs space-y-0.5">
              <p className="font-medium text-muted-foreground">Period totals:</p>
              {monthlyData.totalSummary.map((s, i) => (
                <p key={i} className="text-foreground pl-2">• {s}</p>
              ))}
              <p className="text-muted-foreground pt-1">Total doses: {monthlyData.totalDoses}</p>
            </div>
          )}
          {monthlyData.totalDoses === 0 && <p className="text-xs text-muted-foreground">No medicine logs for {monthLabel}.</p>}

          <Button
            onClick={() => generateMedPdf(
              `Monthly Medicine Report — ${monthLabel}`,
              medicines,
              monthlyData,
              `monthly-medicine-${selectedMonth}.pdf`, careRecipientName
            )}
            disabled={monthlyData.totalDoses === 0}
            className="w-full"
          >
            <Download className="mr-2 h-4 w-4" />
            Download Monthly Medicine PDF
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
