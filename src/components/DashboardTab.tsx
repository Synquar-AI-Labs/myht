import { useMemo, useState } from 'react';
import { HealthRecord } from '@/types/health';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Slider } from '@/components/ui/slider';
import { format, subDays, parseISO } from 'date-fns';

interface DashboardTabProps {
  records: HealthRecord[];
  bpReadings?: { date: string; systolic: number; diastolic: number }[];
}

function buildTableData(
  records: HealthRecord[],
  bpReadings: { date: string; systolic: number; diastolic: number }[],
  days: number
) {
  const cutoff = format(subDays(new Date(), days - 1), 'yyyy-MM-dd');
  const today = format(new Date(), 'yyyy-MM-dd');

  const filtered = records
    .filter(r => r.date >= cutoff && r.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Group BP readings by date for averaging
  const bpByDate: Record<string, { sys: number[]; dia: number[] }> = {};
  bpReadings.forEach(bp => {
    if (bp.date < cutoff || bp.date > today) return;
    if (!bpByDate[bp.date]) bpByDate[bp.date] = { sys: [], dia: [] };
    bpByDate[bp.date].sys.push(bp.systolic);
    bpByDate[bp.date].dia.push(bp.diastolic);
  });

  const rows = filtered.map(r => {
    // Use individual BP readings average if available, otherwise fall back to record values
    const bpData = bpByDate[r.date];
    let avgSys = r.bp_systolic;
    let avgDia = r.bp_diastolic;
    if (bpData && bpData.sys.length > 0) {
      avgSys = Math.round(bpData.sys.reduce((a, b) => a + b, 0) / bpData.sys.length);
      avgDia = Math.round(bpData.dia.reduce((a, b) => a + b, 0) / bpData.dia.length);
    }

    return {
      date: r.date,
      label: format(parseISO(r.date), 'MMM d'),
      feed: r.feed_bags,
      bile: (r as any).bile_bags ?? 0,
      bpSys: avgSys,
      bpDia: avgDia,
      vomit: (r as any).vomit_count ?? 0,
      stool: r.stool_count,
      urine: (r as any).urine_count ?? 0,
      flushes: (r as any).flush_count ?? 0,
      weight: Number(r.weight),
    };
  });

  // Totals: sum for counts, average for BP and weight
  const count = rows.length || 1;
  const totals = {
    feed: rows.reduce((s, r) => s + r.feed, 0),
    bile: rows.reduce((s, r) => s + r.bile, 0),
    bpSys: Math.round(rows.reduce((s, r) => s + r.bpSys, 0) / count),
    bpDia: Math.round(rows.reduce((s, r) => s + r.bpDia, 0) / count),
    vomit: rows.reduce((s, r) => s + r.vomit, 0),
    stool: rows.reduce((s, r) => s + r.stool, 0),
    urine: rows.reduce((s, r) => s + r.urine, 0),
    flushes: rows.reduce((s, r) => s + r.flushes, 0),
    weight: rows.length > 0 ? +(rows.reduce((s, r) => s + r.weight, 0) / count).toFixed(1) : 0,
  };

  return { rows, totals };
}

function MetricTable({ title, days, onDaysChange, records, bpReadings, min, max }: {
  title: string;
  days: number;
  onDaysChange: (v: number) => void;
  records: HealthRecord[];
  bpReadings: { date: string; systolic: number; diastolic: number }[];
  min: number;
  max: number;
}) {
  const { rows, totals } = useMemo(() => buildTableData(records, bpReadings, days), [records, bpReadings, days]);

  return (
    <Card className="border-none shadow-sm">
      <CardHeader className="px-4 pb-2 pt-4">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="flex items-center gap-3 pt-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">{days} days</span>
          <Slider
            value={[days]}
            onValueChange={v => onDaysChange(v[0])}
            min={min}
            max={max}
            step={1}
            className="flex-1"
          />
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-4 overflow-x-auto">
        {rows.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">No data for this period</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs px-2 sticky left-0 bg-card z-10">Date</TableHead>
                <TableHead className="text-xs px-2 text-center">Feed</TableHead>
                <TableHead className="text-xs px-2 text-center">Bile</TableHead>
                <TableHead className="text-xs px-2 text-center">BP</TableHead>
                <TableHead className="text-xs px-2 text-center">Vomit</TableHead>
                <TableHead className="text-xs px-2 text-center">Stool</TableHead>
                <TableHead className="text-xs px-2 text-center">Urine</TableHead>
                <TableHead className="text-xs px-2 text-center">Flush</TableHead>
                <TableHead className="text-xs px-2 text-center">Wt(kg)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.date}>
                  <TableCell className="text-xs px-2 font-medium sticky left-0 bg-card z-10 whitespace-nowrap">{r.label}</TableCell>
                  <TableCell className="text-xs px-2 text-center">{r.feed}</TableCell>
                  <TableCell className="text-xs px-2 text-center">{r.bile}</TableCell>
                  <TableCell className="text-xs px-2 text-center whitespace-nowrap">
                    {r.bpSys > 0 ? `${r.bpSys}/${r.bpDia}` : '—'}
                  </TableCell>
                  <TableCell className="text-xs px-2 text-center">{r.vomit}</TableCell>
                  <TableCell className="text-xs px-2 text-center">{r.stool}</TableCell>
                  <TableCell className="text-xs px-2 text-center">{r.urine}</TableCell>
                  <TableCell className="text-xs px-2 text-center">{r.flushes}</TableCell>
                  <TableCell className="text-xs px-2 text-center">{r.weight > 0 ? r.weight : '—'}</TableCell>
                </TableRow>
              ))}
              {/* Totals row */}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell className="text-xs px-2 sticky left-0 bg-muted/50 z-10">Total/Avg</TableCell>
                <TableCell className="text-xs px-2 text-center">{totals.feed}</TableCell>
                <TableCell className="text-xs px-2 text-center">{totals.bile}</TableCell>
                <TableCell className="text-xs px-2 text-center whitespace-nowrap">
                  {totals.bpSys > 0 ? `${totals.bpSys}/${totals.bpDia}` : '—'}
                </TableCell>
                <TableCell className="text-xs px-2 text-center">{totals.vomit}</TableCell>
                <TableCell className="text-xs px-2 text-center">{totals.stool}</TableCell>
                <TableCell className="text-xs px-2 text-center">{totals.urine}</TableCell>
                <TableCell className="text-xs px-2 text-center">{totals.flushes}</TableCell>
                <TableCell className="text-xs px-2 text-center">{totals.weight > 0 ? totals.weight : '—'}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardTab({ records, bpReadings = [] }: DashboardTabProps) {
  const [weeklyDays, setWeeklyDays] = useState(7);
  const [monthlyDays, setMonthlyDays] = useState(30);

  return (
    <div className="space-y-6 pb-4">
      <MetricTable
        title="Weekly Overview"
        days={weeklyDays}
        onDaysChange={setWeeklyDays}
        records={records}
        bpReadings={bpReadings}
        min={3}
        max={14}
      />
      <MetricTable
        title="Monthly Overview"
        days={monthlyDays}
        onDaysChange={setMonthlyDays}
        records={records}
        bpReadings={bpReadings}
        min={14}
        max={90}
      />
    </div>
  );
}
