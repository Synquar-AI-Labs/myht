import { checked, family, today } from './helpers';
export async function routineFamily() {
  const f = await family();
  const date = today();
  const items = await checked(f.admin.client.from('routine_items').insert([
    { household_id:f.id,kind:'meal',name:'Breakfast',schedule_time:'8:00 AM',details:'Oatmeal with fruit',drink:'Water',start_date:date,created_at:new Date(`${date}T00:00:00-04:00`).toISOString() },
    { household_id:f.id,kind:'meal',name:'Lunch',schedule_time:'12:00 PM',details:'Rice and vegetables',drink:'Tea',start_date:date,created_at:new Date(`${date}T00:00:00-04:00`).toISOString() },
    { household_id:f.id,kind:'meal',name:'Dinner',schedule_time:'6:00 PM',details:'Fish and vegetables',drink:'Water',start_date:date,created_at:new Date(`${date}T00:00:00-04:00`).toISOString() },
    { household_id:f.id,kind:'exercise',name:'Gentle stretch',schedule_time:'9:00 AM',target_minutes:10,area:'Legs',details:'Synthetic how-to note',start_date:date,created_at:new Date(`${date}T00:00:00-04:00`).toISOString() },
    { household_id:f.id,kind:'exercise',name:'Ankle pumps',schedule_time:'5:00 PM',target_minutes:10,area:'Calves',details:'Move gently while seated',start_date:date,created_at:new Date(`${date}T00:00:00-04:00`).toISOString() },
  ], {defaultToNull:false}).select('*'));
  const breakfast=items.find(i=>i.name==='Breakfast')!, stretch=items.find(i=>i.name==='Gentle stretch')!;
  const caregiver=f.people.find(p=>p.user_id===f.admin.id)!;
  await checked(f.admin.client.from('routine_logs').insert([
    {household_id:f.id,item_id:breakfast.id,for_date:date,for_minute:480,done_at:new Date(`${date}T08:10:00-04:00`).toISOString(),caregiver_id:caregiver.caregiver_id,recorded_by:caregiver.display_name,kind:'meal',name:breakfast.name,details:breakfast.details,drink:breakfast.drink,amount:'all'},
    {household_id:f.id,item_id:stretch.id,for_date:date,for_minute:540,done_at:new Date(`${date}T09:10:00-04:00`).toISOString(),caregiver_id:caregiver.caregiver_id,recorded_by:caregiver.display_name,kind:'exercise',name:stretch.name,details:stretch.details,minutes:9.8,target_minutes:10},
  ], {defaultToNull:false}));
  await checked(f.admin.client.from('health_records').insert({household_id:f.id,date,food_taken:false}));
  await checked(f.admin.client.from('care_alerts').insert([{household_id:f.id,kind:'allergy',text:'No peanuts'},{household_id:f.id,kind:'diet',text:'Low sodium'}]));
  return {...f,items,date};
}
