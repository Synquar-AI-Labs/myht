import type { CustomAction, CustomActionLog } from '@/hooks/useCustomActions';
import { format, parseISO } from 'date-fns';

const displayNumber = (value: number) => {
  const rounded=Number(value.toFixed(2));
  return String(rounded===0&&value!==0?Number(value.toPrecision(3)):rounded);
};
const hour24 = (log: CustomActionLog) => log.hour % 12 + (log.am_pm.toUpperCase() === 'PM' ? 12 : 0);
export function otherReadings(actions: CustomAction[], logs: CustomActionLog[], from: string, to: string) {
  const ordered = logs.filter(log => log.date >= from && log.date <= to)
    .sort((a,b) => a.date.localeCompare(b.date) || hour24(a)-hour24(b) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  const groups = new Map<string, CustomActionLog[]>();
  for (const log of ordered) {
    if (!Number.isFinite(Number(log.value))) throw new Error('Invalid custom reading');
    const entries=groups.get(log.action_id);
    if(entries)entries.push(log);else groups.set(log.action_id,[log]);
  }
  const summaries = [...groups].map(([id, entries]) => {
    const action = actions.find(a => a.id === id);
    const name = action?.name ?? 'Unknown reading';
    const values = entries.map(log => Number(log.value));
    if (action && values.every(value => value === Number(action.default_value))) return `${name}: ${entries.length} times`;
    const unit = action?.unit ? ` ${action.unit}` : '';
    const lowest=values.reduce((min,value)=>Math.min(min,value),Infinity), highest=values.reduce((max,value)=>Math.max(max,value),-Infinity);
    const average=values.reduce((sum,value) => sum+value,0)/values.length;
    if(!Number.isFinite(average))throw new Error('Invalid custom reading average');
    return `${name}: ${entries.length} entries · lowest ${lowest} · highest ${highest} · average ${displayNumber(average)}${unit}`;
  });
  const rows = ordered.map(log => {
    const action = actions.find(a => a.id === log.action_id);
    return [format(parseISO(log.date),'MMM d, yyyy'), `${log.hour}:00 ${log.am_pm.toUpperCase()}`, action?.name ?? 'Unknown reading', `${log.value}${action?.unit ? ` ${action.unit}` : ''}`, log.recorded_by || 'Not recorded'];
  });
  return { summaries, rows };
}
