import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { test,expect,signIn,more,checked,reading,today } from './helpers';
import { reportVisitFamily } from './r5-fixtures';

test('custom readings appear in weekly and monthly PDFs, including custom-only days and long lists',async({page,sessions})=>{
  void sessions;const f=await reportVisitFamily();await signIn(page,f.admin);
  const drawer=await reading(page,'Blood sugars');await drawer.locator('input[type=number]').fill('6.4');await drawer.getByRole('button',{name:'Save',exact:true}).click();
  await expect(drawer).toHaveCount(0);
  await expect.poll(async()=> (await checked(f.admin.client.from('custom_action_logs').select('*').eq('action_id',f.action.id))).length).toBe(1);
  await more(page,'Reports & downloads');
  mkdirSync('test-results/r5',{recursive:true});
  const weekly=page.waitForEvent('download');await page.getByRole('button',{name:'Download Weekly PDF',exact:true}).click();
  await (await weekly).saveAs('test-results/r5/weekly-custom.pdf');
  const text=execFileSync('pdftotext',['-layout','test-results/r5/weekly-custom.pdf','-'],{encoding:'utf8'});
  expect(text).toContain('Other readings');expect(text).toContain('Blood sugars');expect(text).toContain('6.4 mmol/L');
  // Many entries must cross pages without truncating the last record.
  let release!:()=>void;const refreshing=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/rest/v1/custom_action_logs?**',async route=>{await refreshing;await route.continue();});
  try{
    await checked(f.admin.client.from('custom_action_logs').insert(Array.from({length:120},(_,i)=>({household_id:f.id,action_id:f.action.id,date:today(),hour:i===119?11:1,am_pm:'PM',value:i+2,recorded_by:i===119?'Tail marker':'Sample helper'}))));
    await expect(page.getByText('Updating other readings…',{exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Download Weekly PDF',exact:true})).toBeDisabled();
    release();await expect(page.getByText('121 other reading(s) for this month',{exact:true})).toBeVisible();
  }finally{release();await page.unroute('**/rest/v1/custom_action_logs?**');}
  const monthly=page.waitForEvent('download');await page.getByRole('button',{name:'Download Monthly PDF',exact:true}).click();
  await (await monthly).saveAs('test-results/r5/monthly-custom.pdf');
  const monthlyText=execFileSync('pdftotext',['-layout','test-results/r5/monthly-custom.pdf','-'],{encoding:'utf8'});
  expect(monthlyText).toContain('Other readings');expect(monthlyText).toContain('Tail marker');
  expect(monthlyText.trim()).toMatch(/Tail marker\s*$/);
  expect((monthlyText.match(/\f/g)||[]).length).toBeGreaterThan(1);
});

test('both appointment forms pick doctors and places; new contact prompts save only on Add',async({page,sessions})=>{
  void sessions;const f=await reportVisitFamily();await signIn(page,f.admin);
  await page.getByRole('button',{name:/^Appointments & notes/}).click();await page.getByRole('button',{name:'Appointment',exact:true}).click();
  let dialog=page.getByRole('dialog');await dialog.getByRole('combobox',{name:'Doctor Name',exact:true}).click();
  await page.getByRole('option',{name:'Dr. Sample · Family doctor',exact:true}).click();
  await expect(dialog.getByRole('combobox',{name:'Where',exact:true})).toHaveValue('123 Sample Street');
  await dialog.getByRole('combobox',{name:'Where',exact:true}).fill('');await page.getByRole('option',{name:'Sample Clinic · 456 Sample Road',exact:true}).click();
  await dialog.getByLabel('Reason',{exact:true}).fill('Synthetic check');await dialog.getByRole('button',{name:'Save Appointment',exact:true}).click();await expect(dialog).toHaveCount(0);
  const saved=await checked(f.admin.client.from('appointments').select('*').eq('doctor_name','Dr. Sample').single());expect(saved.address).toBe('456 Sample Road');
  await more(page,'Doctor visits');await page.getByRole('button',{name:'Add',exact:true}).click();
  dialog=page.getByRole('dialog');await dialog.getByRole('combobox',{name:'Doctor Name',exact:true}).fill('Dr. New');await page.getByRole('option',{name:"Use 'Dr. New'",exact:true}).click();
  await dialog.getByLabel('Reason',{exact:true}).fill('New synthetic check');await dialog.getByRole('button',{name:'Save Appointment',exact:true}).click();
  await expect(dialog.getByRole('heading')).toHaveText('Add Dr. New to Contacts?');
  expect(await checked(f.admin.client.from('appointments').select('id').eq('doctor_name','Dr. New'))).toHaveLength(1);
  await dialog.getByRole('button',{name:'Add',exact:true}).click();await expect(dialog.getByLabel('Name',{exact:true})).toHaveValue('Dr. New');await expect(dialog.getByLabel('Group')).toHaveValue('doctor');
  await dialog.getByRole('button',{name:'Save',exact:true}).click();await expect(dialog).toHaveCount(0);
  expect(await checked(f.admin.client.from('contacts').select('*').eq('name','Dr. New'))).toHaveLength(1);
  await page.getByRole('button',{name:'Add',exact:true}).click();await dialog.getByRole('combobox',{name:'Doctor Name',exact:true}).fill('Dr. Later');await dialog.getByLabel('Reason',{exact:true}).fill('Later check');
  await dialog.getByRole('button',{name:'Save Appointment',exact:true}).click();await dialog.getByRole('button',{name:'Not now',exact:true}).click();await expect(dialog).toHaveCount(0);
  expect(await checked(f.admin.client.from('contacts').select('id').eq('name','Dr. Later'))).toHaveLength(0);
  expect(await checked(f.admin.client.from('appointments').select('id').eq('doctor_name','Dr. Later'))).toHaveLength(1);
  await page.getByRole('button',{name:'Add',exact:true}).click();await dialog.getByRole('combobox',{name:'Where',exact:true}).fill('New Sample Clinic');
  await dialog.getByRole('combobox',{name:'Doctor Name',exact:true}).click();await page.getByRole('option',{name:'Dr. Sample · Family doctor',exact:true}).click();
  await expect(dialog.getByRole('combobox',{name:'Where',exact:true})).toHaveValue('New Sample Clinic');
  await dialog.getByLabel('Reason',{exact:true}).fill('Place check');await dialog.getByRole('button',{name:'Save Appointment',exact:true}).click();
  await expect(dialog.getByRole('heading')).toHaveText('Add New Sample Clinic to Contacts?');await dialog.getByRole('button',{name:'Add',exact:true}).click();
  await expect(dialog.getByLabel('Group')).toHaveValue('hospital');await dialog.getByRole('button',{name:'Save',exact:true}).click();await expect(dialog).toHaveCount(0);
  expect((await checked(f.admin.client.from('contacts').select('*').eq('name','New Sample Clinic').single())).kind).toBe('hospital');
  await page.getByRole('button',{name:'Add',exact:true}).click();await dialog.getByRole('combobox',{name:'Doctor Name',exact:true}).fill('Dr. Queue');
  await dialog.getByRole('combobox',{name:'Where',exact:true}).fill('Queue Clinic');await dialog.getByLabel('Reason',{exact:true}).fill('Queue check');
  await dialog.getByRole('button',{name:'Save Appointment',exact:true}).click();await expect(dialog.getByRole('heading')).toHaveText('Add Dr. Queue to Contacts?');
  await dialog.getByRole('button',{name:'Not now',exact:true}).click();await expect(dialog.getByRole('heading')).toHaveText('Add Queue Clinic to Contacts?');
  await dialog.getByRole('button',{name:'Not now',exact:true}).click();await expect(dialog).toHaveCount(0);
  expect(await checked(f.admin.client.from('contacts').select('id').in('name',['Dr. Queue','Queue Clinic']))).toHaveLength(0);
  expect(await checked(f.admin.client.from('appointments').select('id').eq('doctor_name','Dr. Queue'))).toHaveLength(1);
});

test('failed appointments keep typed values and never offer a new contact',async({page,sessions})=>{
  void sessions;const f=await reportVisitFamily();await signIn(page,f.admin);await more(page,'Doctor visits');await page.getByRole('button',{name:'Add',exact:true}).click();
  const dialog=page.getByRole('dialog');const doctor=dialog.getByRole('combobox',{name:'Doctor Name',exact:true});
  await doctor.fill('Sample');await doctor.press('ArrowDown');await doctor.press('Enter');
  await expect(doctor).toHaveValue('Dr. Sample');await expect(dialog.getByRole('combobox',{name:'Where',exact:true})).toHaveValue('123 Sample Street');
  await doctor.fill('Dr. Retry');await dialog.getByLabel('Reason',{exact:true}).fill('Synthetic check');
  await page.route('**/rest/v1/appointments*',route=>route.request().method()==='POST'?route.fulfill({status:503,contentType:'application/json',body:'{"message":"Synthetic failure"}'}):route.continue());
  await dialog.getByRole('button',{name:'Save Appointment',exact:true}).click();await expect(dialog.getByRole('combobox',{name:'Doctor Name',exact:true})).toHaveValue('Dr. Retry');
  await expect(page.getByRole('heading',{name:/to Contacts/})).toHaveCount(0);expect(await checked(f.admin.client.from('appointments').select('id').eq('doctor_name','Dr. Retry'))).toHaveLength(0);
});
