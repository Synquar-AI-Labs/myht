import { expect, it } from 'vitest';
import { routineSection, routineUrgency, routineBarText, mealSummary, showDailyFood, routinePlannedDetail } from '@/lib/routineToday';
import { buildDiaryEntries } from '@/components/history/diary';
import { elapsedMs, pauseTimer, resumeTimer, finishTimer, recoverTimer, readStoredTimer, timerKey, timerMinutes, timerProgress, type ExerciseTimer } from '@/lib/exerciseTimer';
import type { RoutineItem, RoutineLog } from '@/lib/routineSchedule';
const item: RoutineItem = { id: 'item', household_id: 'family', kind: 'meal', name: 'Breakfast', details: 'Food', drink: 'Water', target_minutes: null, area: '', move_type: '', schedule_time: '8:00 AM / 1:00 PM', start_date: '2026-01-01', end_date: null, previous_schedule_time: null, schedule_from: null, created_at: '2025-01-01T00:00:00Z' };
const log: RoutineLog = { id: 'log', household_id: 'family', item_id: 'item', caregiver_id: 'person', for_date: '2026-10-22', for_minute: 480, done_at: '2026-10-22T12:15:00Z', recorded_by: 'Sample caregiver', kind: 'meal', name: 'Breakfast', details: 'Copied food', drink: 'Water', target_minutes: null, amount: 'all', minutes: null, note: '' };
it('hides empty sections, folds done rows, counts and marks passed pending rows calmly', () => {
  expect(routineSection([], [], '2026-10-22', new Date()).hidden).toBe(true);
  const model = routineSection([item], [log], '2026-10-22', new Date(2026,9,22,14));
  expect(model.planned).toBe(2); expect(model.done).toBe(1); expect(model.folded).toBe('1 done · Breakfast');
  expect(model.pending[0].notDoneYet).toBe(true); expect(model.doneRows[0].log).toEqual(log);
  expect(routineSection([item], [log,{...log,id:'log2',for_minute:780}], '2026-10-22', new Date()).complete).toBe(true);
});
it('summarises passed pending rows first, then the next time, then all done', () => {
  const model = (logs: RoutineLog[], hour: number) => routineSection([item], logs, '2026-10-22', new Date(2026,9,22,hour));
  expect(routineBarText(model([], 14))).toBe('Breakfast · not done yet');
  expect(routineBarText(model([log], 12))).toBe('Next: Breakfast · 1:00 PM');
  expect(routineBarText(model([log,{...log,id:'log2',for_minute:780}], 14))).toBe('All 2 done');
});
it('suppresses only Food No when real meal records exist, retaining Food Yes', () => {
  expect(mealSummary([log])).toBe('Meals recorded: 1 · Breakfast all');
  expect(showDailyFood(false,[log])).toBe(false); expect(showDailyFood(true,[log])).toBe(true);
  expect(showDailyFood(false,[])).toBe(true); expect(mealSummary([])).toBeNull();
});
it.each([[-16,'scheduled'],[-15,'soon'],[0,'due'],[30,'due'],[31,'scheduled']] as const)('uses calm/soon/due boundaries at %i minutes from the planned time', (minutes,state) => {
  const at=new Date(2026,9,22,12), now=new Date(at.getTime()+minutes*60_000);
  expect(routineUrgency(at,now)).toBe(state);
  const model=routineSection([{...item,schedule_time:'12:00 PM'}],[],'2026-10-22',now);
  expect(model.state).toBe(state);expect(model.pending[0].state).toBe(state);
  expect(model.pending[0].notDoneYet).toBe(minutes>30);
});
it('names the most urgent pending item, not an older unfinished item or a completed one', () => {
  const now=new Date(2026,9,22,12);
  const due={...item,id:'due',name:'Lunch',schedule_time:'12:00 PM'};
  const soon={...item,id:'soon',name:'Snack',schedule_time:'12:10 PM'};
  const old={...item,id:'old',name:'Breakfast',schedule_time:'8:00 AM'};
  const both=routineSection([soon,due],[],'2026-10-22',now);
  expect(both.state).toBe('due');expect(routineBarText(both)).toBe('Lunch · 12:00 PM');
  const older=routineSection([old,soon],[],'2026-10-22',now);
  expect(older.state).toBe('soon');expect(routineBarText(older)).toBe('Next: Snack · 12:10 PM');
  const completed=routineSection([due],[{...log,item_id:'due',for_minute:720}],'2026-10-22',now);
  expect(completed.state).toBe('scheduled');expect(completed.pending).toEqual([]);expect(routineBarText(completed)).toBe('All 1 done');
});
it('puts after-midnight completion in History at the actual timestamp, retaining its planned detail', () => {
  const late = { ...log, for_date:'2026-10-22', for_minute:1410, done_at:new Date(2026,9,23,0,10).toISOString() };
  expect(routinePlannedDetail(late)).toBe('for Oct 22, 11:30 PM');
  const entries=buildDiaryEntries({date:'2026-10-23',medLogs:[],medicines:[],bpReadings:[],customActions:[],customLogs:[],notes:[],transcripts:[],routineLogs:[late]});
  expect(entries[0].at.toISOString()).toBe(late.done_at);expect(entries[0].detail).toContain('for Oct 22, 11:30 PM');expect(entries[0].untimed).toBe(false);
  const plannedItem={...item,schedule_time:'11:30 PM'};
  expect(routineSection([plannedItem],[late],'2026-10-22',new Date(2026,9,23)).done).toBe(1);
  expect(routineSection([plannedItem],[late],'2026-10-23',new Date(2026,9,23)).done).toBe(0);
});
it('shows the plan when more than five minutes off, but not for a near-on-time completion', () => {
  expect(routinePlannedDetail({...log,done_at:new Date(2026,9,22,8,5).toISOString()})).toBe('');
  expect(routinePlannedDetail({...log,done_at:new Date(2026,9,22,8,6).toISOString()})).toBe('planned 8:00 AM');
});
const timer: ExerciseTimer = { user_id:'user',household_id:'family',item:{...item,kind:'exercise',drink:'',target_minutes:10},elapsed_ms:0,running_since:1000,state:'running',for_date:'2026-10-22',for_minute:480,caregiver_id:'person',recorded_by:'Sample caregiver' };
it('pauses, resumes, recovers elapsed time and separates identities', () => {
  const paused=pauseTimer(timer,61000);expect(elapsedMs(paused,999999)).toBe(60000);
  const resumed=resumeTimer(paused,100000);expect(elapsedMs(resumed,130000)).toBe(90000);expect(timerMinutes(resumed,130000)).toBe(1.5);
  expect(recoverTimer(JSON.stringify(resumed),'user','family')).toEqual(resumed);
  expect(()=>recoverTimer(JSON.stringify(resumed),'other','family')).toThrow();
  expect(timerKey('user','family')).not.toBe(timerKey('other','family'));expect(recoverTimer(null,'user','family')).toBeNull();
});
it('clears on confirmed finish only, and keeps the entire timer after failed saves', async () => {
  expect(await finishTimer(timer,async minutes=>minutes===1,61000)).toBeNull();
  expect(await finishTimer(timer,async()=>false,61000)).toEqual(timer);
  expect(await finishTimer(timer,async()=>{throw new Error('offline');},61000)).toEqual(timer);
  const finishing = pauseTimer(timer,61000);
  const retained = await finishTimer(finishing,async()=>false,999999);
  expect(retained?.state).toBe('paused');expect(elapsedMs(retained!,999999)).toBe(60000);
});
it('removes only a corrupt identity slot, notifies once and allows a new valid timer to recover', () => {
  const key=timerKey('user','family'), other=timerKey('other','family');
  const values=new Map([[key,'broken JSON'],[other,JSON.stringify({...timer,user_id:'other'})]]);
  const storage={getItem:(k:string)=>values.get(k)??null,removeItem:(k:string)=>{values.delete(k);}};
  let notices=0;const cleared=()=>notices++;
  expect(readStoredTimer(storage,'user','family',cleared)).toBeNull();expect(values.has(key)).toBe(false);
  expect(readStoredTimer(storage,'user','family',cleared)).toBeNull();expect(notices).toBe(1);expect(values.has(other)).toBe(true);
  values.set(key,JSON.stringify(timer));expect(readStoredTimer(storage,'user','family',cleared)).toEqual(timer);expect(notices).toBe(1);
  values.set(key,JSON.stringify({...timer,for_minute:9999}));expect(readStoredTimer(storage,'user','family',cleared)).toBeNull();expect(values.has(key)).toBe(false);expect(notices).toBe(2);
});
it('fills the progress ring at the target without stopping elapsed time', () => {
  expect(timerProgress(timer,301000)).toBe(0.5);expect(timerProgress(timer,601000)).toBe(1);
  expect(timerProgress(timer,661000)).toBe(1);expect(timerMinutes(timer,661000)).toBe(11);
  expect(recoverTimer(JSON.stringify({...timer,caregiver_id:'',recorded_by:'',state:'paused',running_since:null,elapsed_ms:0}),'user','family')?.state).toBe('paused');
});
