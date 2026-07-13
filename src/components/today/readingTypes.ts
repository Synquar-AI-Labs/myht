import type { HealthField } from '@/components/QuickLogSheet';
import type { HealthRecord } from '@/types/health';
import { formatBp } from '@/lib/utils';

/**
 * The eight built-in reading types shown in the "Record a reading" grid.
 * `dot` is the tile's color dot; `fields`/`dbFields` drive the existing
 * QuickLogSheet drawer exactly as the old quick-action buttons did.
 */
export interface ReadingType {
  key: string;
  label: string;
  metric: string;
  dot: string;
  fields: HealthField[];
  dbFields: string[];
  /** Short "today so far" summary for the tile subtitle. */
  todaySoFar: (r: HealthRecord | null) => string;
}

export const READING_TYPES: ReadingType[] = [
  {
    key: 'bp', label: 'BP', metric: 'Blood Pressure', dot: 'bg-red-500',
    fields: [
      { key: 'bpSystolic', label: 'Systolic', defaultValue: 120, min: 50, max: 250 },
      { key: 'bpDiastolic', label: 'Diastolic', defaultValue: 80, min: 30, max: 150 },
    ],
    dbFields: ['bpSystolic', 'bpDiastolic'],
    todaySoFar: r => formatBp(r?.bp_systolic, r?.bp_diastolic),
  },
  {
    key: 'feed', label: 'Feed', metric: 'Feed Bags', dot: 'bg-blue-500',
    fields: [{ key: 'feedBags', label: 'Bag count', defaultValue: 1, min: 0 }],
    dbFields: ['feedBags'],
    todaySoFar: r => `${r?.feed_bags ?? 0} today`,
  },
  {
    key: 'bile', label: 'Bile', metric: 'Bile Bags', dot: 'bg-yellow-600',
    fields: [{ key: 'bileBags', label: 'Bag count', defaultValue: 1, min: 0 }],
    dbFields: ['bileBags'],
    todaySoFar: r => `${r?.bile_bags ?? 0} today`,
  },
  {
    key: 'vomit', label: 'Vomit', metric: 'Vomiting', dot: 'bg-orange-500',
    fields: [{ key: 'vomitCount', label: 'Count', defaultValue: 1, min: 0 }],
    dbFields: ['vomitCount', 'vomiting'],
    todaySoFar: r => `${r?.vomit_count ?? 0} today`,
  },
  {
    key: 'stool', label: 'Stool', metric: 'Stool', dot: 'bg-amber-700',
    fields: [{ key: 'stoolCount', label: 'Count', defaultValue: 1, min: 0 }],
    dbFields: ['stoolCount', 'stoolPassed'],
    todaySoFar: r => `${r?.stool_count ?? 0} today`,
  },
  {
    key: 'urine', label: 'Urine', metric: 'Urine', dot: 'bg-yellow-500',
    fields: [{ key: 'urineCount', label: 'Count', defaultValue: 1, min: 0 }],
    dbFields: ['urineCount'],
    todaySoFar: r => `${r?.urine_count ?? 0} today`,
  },
  {
    key: 'weight', label: 'Weight', metric: 'Weight', dot: 'bg-green-500',
    fields: [{ key: 'weight', label: 'Weight (kg)', defaultValue: 0, min: 0 }],
    dbFields: ['weight'],
    todaySoFar: r => (r?.weight && Number(r.weight) > 0 ? `${r.weight} kg` : '—'),
  },
  {
    key: 'flush', label: 'Flush', metric: 'Flush', dot: 'bg-cyan-500',
    fields: [{ key: 'flushMl', label: 'Water (ml)', defaultValue: 500, min: 0 }],
    dbFields: ['flushMl'],
    todaySoFar: r => `${r?.flush_ml ?? 0} ml today`,
  },
];
