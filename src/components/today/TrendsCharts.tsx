import { useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import type { HealthRecord } from '@/types/health';
import type { CustomAction, CustomActionLog } from '@/hooks/useCustomActions';

interface TrendsChartsProps {
  records: HealthRecord[];
  customActions: CustomAction[];
  customLogs: CustomActionLog[];
}

function weekStartFor(offset: number): Date {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ...
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const thisMonday = subDays(today, mondayOffset);
  return subDays(thisMonday, offset * 7);
}

export function TrendsCharts({ records, customActions, customLogs }: TrendsChartsProps) {
  const [weekOffset, setWeekOffset] = useState(0);

  const chartData = useMemo(() => {
    const weekStart = weekStartFor(weekOffset);
    return Array.from({ length: 7 }, (_, i) => {
      const date = subDays(weekStart, -i);
      const d = format(date, 'yyyy-MM-dd');
      const r = records.find(rec => rec.date === d);
      return {
        label: `${format(date, 'EEE')}\n${format(date, 'd/M')}`,
        feeds: r?.feed_bags ?? 0,
        vomit: r?.vomit_count ?? 0,
        stool: r?.stool_count ?? 0,
        flush: r?.flush_ml || r?.flush_count || 0,
        bpSys: r?.bp_systolic || null,
        bpDia: r?.bp_diastolic || null,
        weight: r?.weight && Number(r.weight) > 0 ? Number(r.weight) : null,
      };
    });
  }, [records, weekOffset]);

  const weekRangeLabel = useMemo(() => {
    const weekStart = weekStartFor(weekOffset);
    const weekEnd = subDays(weekStart, -6);
    return `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d')}`;
  }, [weekOffset]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={() => setWeekOffset(w => w + 1)} className="p-1.5 rounded hover:bg-muted">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h3 className="text-xs font-medium text-[#8b8175]">{weekRangeLabel}</h3>
        <button
          onClick={() => setWeekOffset(w => Math.max(0, w - 1))}
          disabled={weekOffset === 0}
          className="p-1.5 rounded hover:bg-muted disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Main metrics chart */}
      <div className="rounded-xl border border-[#e9e2d6] bg-white p-3 h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <XAxis dataKey="label" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} interval={0} />
            <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} width={25} />
            <Tooltip contentStyle={{ fontSize: 11 }} />
            <Legend iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
            <Bar dataKey="feeds" name="Feeds" fill="hsl(200, 40%, 50%)" radius={[3, 3, 0, 0]} />
            <Bar dataKey="vomit" name="Vomit" fill="hsl(15, 70%, 55%)" radius={[3, 3, 0, 0]} />
            <Bar dataKey="stool" name="Stool" fill="hsl(145, 35%, 45%)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Flush chart */}
      <div className="rounded-xl border border-[#e9e2d6] bg-white p-3 h-36">
        <h4 className="text-[10px] font-medium text-[#8b8175] mb-1">Flush (ml)</h4>
        <ResponsiveContainer width="100%" height="85%">
          <BarChart data={chartData}>
            <XAxis dataKey="label" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} interval={0} />
            <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} width={30} />
            <Tooltip contentStyle={{ fontSize: 11 }} />
            <Bar dataKey="flush" name="Flush (ml)" fill="hsl(185, 50%, 45%)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* BP chart */}
      <div className="rounded-xl border border-[#e9e2d6] bg-white p-3 h-36">
        <h4 className="text-[10px] font-medium text-[#8b8175] mb-1">Blood Pressure (avg)</h4>
        <ResponsiveContainer width="100%" height="85%">
          <LineChart data={chartData}>
            <XAxis dataKey="label" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} interval={0} />
            <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} width={30} domain={[40, 200]} />
            <Tooltip contentStyle={{ fontSize: 11 }} />
            <Legend iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
            <Line type="monotone" dataKey="bpSys" name="Systolic" stroke="hsl(0, 70%, 55%)" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
            <Line type="monotone" dataKey="bpDia" name="Diastolic" stroke="hsl(220, 70%, 55%)" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Weight chart */}
      <div className="rounded-xl border border-[#e9e2d6] bg-white p-3 h-36">
        <h4 className="text-[10px] font-medium text-[#8b8175] mb-1">Weight (kg)</h4>
        <ResponsiveContainer width="100%" height="85%">
          <LineChart data={chartData}>
            <XAxis dataKey="label" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} interval={0} />
            <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} width={30} domain={['dataMin - 1', 'dataMax + 1']} />
            <Tooltip contentStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="weight" name="Weight" stroke="hsl(145, 50%, 45%)" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Custom action charts */}
      {customActions.filter(ca => ca.show_graph).map(ca => {
        const weekStart = weekStartFor(weekOffset);
        const caChartData = Array.from({ length: 7 }, (_, i) => {
          const date = subDays(weekStart, -i);
          const d = format(date, 'yyyy-MM-dd');
          const dayLogs = customLogs.filter(l => l.action_id === ca.id && l.date === d);
          const total = dayLogs.reduce((sum, l) => sum + Number(l.value), 0);
          return { label: `${format(date, 'EEE')}\n${format(date, 'd/M')}`, value: total };
        });
        return (
          <div key={ca.id} className="rounded-xl border border-[#e9e2d6] bg-white p-3 h-36">
            <h4 className="text-[10px] font-medium text-[#8b8175] mb-1">{ca.name}{ca.unit ? ` (${ca.unit})` : ''}</h4>
            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={caChartData}>
                <XAxis dataKey="label" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} width={30} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Bar dataKey="value" name={ca.name} fill="hsl(180, 50%, 45%)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      })}
    </div>
  );
}
