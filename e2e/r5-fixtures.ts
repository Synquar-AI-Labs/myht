import { family, checked, today } from './helpers';
export async function reportVisitFamily() {
  const f=await family();
  await checked(f.admin.client.from('contacts').insert([
    {household_id:f.id,kind:'doctor',name:'Dr. Sample',role:'Family doctor',address:'123 Sample Street',phone:'+15550102345'},
    {household_id:f.id,kind:'hospital',name:'Sample Clinic',address:'456 Sample Road',phone:'+15550102346'},
  ],{defaultToNull:false}));
  await checked(f.admin.client.from('appointments').insert({household_id:f.id,date:'2020-01-01',time:'09:00',doctor_name:'Previous doctor',address:'Old clinic',reason:'Synthetic visit'}));
  const action=await checked(f.admin.client.from('custom_actions').insert({household_id:f.id,name:'Blood sugars',unit:'mmol/L',default_value:1}).select('*').single());
  return {...f,action,date:today()};
}
