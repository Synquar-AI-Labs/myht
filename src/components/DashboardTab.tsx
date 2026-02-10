import { useMemo, useState } from 'react';
import { HealthRecord, DateRange } from '@/types/health';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { format, subDays, parseISO } from 'date-fns';
import { Activity, Droplets, Weight, Heart, Utensils, CircleDot, AlertTriangle, Ban } from 'lucide-react';

interface DashboardTabProps {
  records: HealthRecord[];
}

const rangeOptions: { label: string; value: DateRange }[] = [
  { label: '7 Days', value: '7' },
  { label: '30 Days', value: '30' },
];

export function DashboardTab({ records }: DashboardTabProps) {
  const [range, setRange] = useState<DateRange>('7');
  const latest = records[0] || null;

  const filteredRecords = useMemo(() => {
    const days = range === '7' ? 7 : 30;
    const cutoff = format(subDays(new Date(), days), 'yyyy-MM-dd');
    return records.filter(r => r.date >= cutoff).sort((a, b) => a.date.localeCompare(b.date));
  }, [records, range]);

  const chartData = useMemo(() => {
    return filteredRecords.map(r => ({
      date: format(parseISO(r.date), 'MMM d'),
      feedBags: r.feed_bags,
      weight: Number(r.weight),
      systolic: r.bp_systolic,
      diastolic: r.bp_diastolic,
      stoolCount: r.stool_passed ? r.stool_count : 0,
      food: r.food_taken ? 1 : 0,
      vomit: r.vomiting ? 1 : 0,
      constipation: r.constipation ? 1 : 0,
    }));
  }, [filteredRecords]);

  return (
    <div className="space-y-4 pb-4">
      {latest && (
        <div className="grid grid-cols-2 gap-3">
          <SummaryCard icon={<Droplets className="h-4 w-4" />} label="Feed Bags" value={String(latest.feed_bags)} />
          <SummaryCard icon={<Weight className="h-4 w-4" />} label="Weight" value={`${latest.weight} kg`} />
          <SummaryCard icon={<Heart className="h-4 w-4" />} label="BP" value={`${latest.bp_systolic}/${latest.bp_diastolic}`} />
          <SummaryCard icon={<CircleDot className="h-4 w-4" />} label="Stool" value={latest.stool_passed ? String(latest.stool_count) : 'No'} />
          <SummaryCard icon={<Utensils className="h-4 w-4" />} label="Food" value={latest.food_taken ? 'Yes' : 'No'} />
          <SummaryCard icon={<AlertTriangle className="h-4 w-4" />} label="Vomiting" value={latest.vomiting ? 'Yes' : 'No'} />
          <SummaryCard icon={<Ban className="h-4 w-4" />} label="Constipation" value={latest.constipation ? 'Yes' : 'No'} />
          <SummaryCard icon={<Activity className="h-4 w-4" />} label="Last Entry" value={format(parseISO(latest.date), 'MMM d')} />
        </div>
      )}

      <div className="flex gap-2">
        {rangeOptions.map(opt => (
          <button
            key={opt.value}
            onClick={() => setRange(opt.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              range === opt.value ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {chartData.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No data yet. Start by adding a daily record.</CardContent></Card>
      ) : (
        <div className="space-y-4">
          <ChartCard title="Weight (kg)">
            <ChartContainer config={{ weight: { label: 'Weight', color: 'hsl(var(--chart-weight))' } }} className="h-[180px] w-full">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="weight" stroke="hsl(var(--chart-weight))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ChartContainer>
          </ChartCard>

          <ChartCard title="Feed Bags / Day">
            <ChartContainer config={{ feedBags: { label: 'Bags', color: 'hsl(var(--chart-feed))' } }} className="h-[180px] w-full">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="feedBags" fill="hsl(var(--chart-feed))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </ChartCard>

          <ChartCard title="Blood Pressure">
            <ChartContainer config={{ systolic: { label: 'Systolic', color: 'hsl(var(--chart-bp-sys))' }, diastolic: { label: 'Diastolic', color: 'hsl(var(--chart-bp-dia))' } }} className="h-[180px] w-full">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="systolic" stroke="hsl(var(--chart-bp-sys))" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="diastolic" stroke="hsl(var(--chart-bp-dia))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ChartContainer>
          </ChartCard>

          <ChartCard title="Stool Count / Day">
            <ChartContainer config={{ stoolCount: { label: 'Count', color: 'hsl(var(--chart-stool))' } }} className="h-[180px] w-full">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="stoolCount" fill="hsl(var(--chart-stool))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </ChartCard>

          <ChartCard title="Food / Vomiting / Constipation">
            <ChartContainer config={{
              food: { label: 'Food', color: 'hsl(var(--chart-food))' },
              vomit: { label: 'Vomit', color: 'hsl(var(--chart-vomit))' },
              constipation: { label: 'Constipation', color: 'hsl(var(--chart-constipation))' },
            }} className="h-[180px] w-full">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={[0, 1]} ticks={[0, 1]} tickFormatter={(v) => v === 1 ? 'Yes' : 'No'} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="food" fill="hsl(var(--chart-food))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="vomit" fill="hsl(var(--chart-vomit))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="constipation" fill="hsl(var(--chart-constipation))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </ChartCard>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="border-none shadow-sm">
      <CardContent className="flex items-center gap-3 p-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-sm font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="border-none shadow-sm">
      <CardHeader className="px-4 pb-2 pt-4">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-4">{children}</CardContent>
    </Card>
  );
}
