import { expect,it } from 'vitest';
import { otherReadings } from '@/lib/otherReadings';
import type { CustomAction,CustomActionLog } from '@/hooks/useCustomActions';
const action:CustomAction={id:'sugar',name:'Blood sugars',unit:'mmol/L',default_value:1,color:'',show_graph:false,created_at:''};
const log=(value:number,overrides:Partial<CustomActionLog>={}):CustomActionLog=>({id:String(value),action_id:'sugar',value,date:'2026-10-25',hour:8,am_pm:'AM',recorded_by:'Sample helper',created_at:'2026-10-25T12:00:00Z',...overrides});
it('reports measure maths and units without dropping zero values',()=>{
  const result=otherReadings([action],[log(0),log(6),log(9)],'2026-10-25','2026-10-25');
  expect(result.summaries).toEqual(['Blood sugars: 3 entries · lowest 0 · highest 9 · average 5 mmol/L']);
  expect(result.rows[0][3]).toBe('0 mmol/L');
});
it('distinguishes counters from measures and rounds averages without trailing zeros',()=>{
  expect(otherReadings([action],[log(1),log(1,{id:'second'})],'2026-10-01','2026-10-31').summaries).toEqual(['Blood sugars: 2 times']);
  expect(otherReadings([{...action,unit:''}],[log(1),log(2),log(2,{id:'third'})],'2026-10-01','2026-10-31').summaries[0]).toContain('average 1.67');
});
it('omits empty periods, keeps orphaned logs, and orders by recorded day and 12-hour time',()=>{
  expect(otherReadings([action],[],'2026-10-01','2026-10-31')).toEqual({summaries:[],rows:[]});
  const result=otherReadings([],[log(5,{hour:1,am_pm:'PM'}),log(4,{hour:12,am_pm:'AM'}),log(3,{date:'2026-09-30'})],'2026-10-01','2026-10-31');
  expect(result.rows.map(row=>row[1])).toEqual(['12:00 AM','1:00 PM']);
  expect(result.rows[0][2]).toBe('Unknown reading');expect(result.summaries[0]).toContain('2 entries');
});
it('rejects invalid numbers instead of rendering them as a zero reading',()=>{
  expect(()=>otherReadings([action],[log(NaN)],'2026-10-01','2026-10-31')).toThrow('Invalid custom reading');
});
it('keeps precise extrema and never rounds a small nonzero average down to zero',()=>{
  expect(otherReadings([action],[log(0.001),log(0.003)],'2026-10-01','2026-10-31').summaries[0]).toContain('lowest 0.001 · highest 0.003 · average 0.002');
});
