import { test, expect, signIn, checked } from './helpers';
import { routineFamily } from './routine-fixtures';

test('meals sync live; concurrent sheets keep the first record; edits preserve attribution and undo works',async({page,sessions})=>{
  const f=await routineFamily();await signIn(page,f.admin);
  const other=await sessions();await signIn(other,f.member);
  const meals=page.locator('[data-routine-section=meal]'), second=other.locator('[data-routine-section=meal]');
  await expect(meals.getByRole('heading')).toHaveText('Meals · 1 of 3 done');
  await meals.getByRole('button',{name:'Done',exact:true}).first().click();
  await second.getByRole('button',{name:'Done',exact:true}).first().click();
  const dialog=page.getByRole('dialog'), theirs=other.getByRole('dialog');
  await expect(dialog.getByText('Allergy: Peanuts',{exact:true})).toBeVisible();
  expect((await dialog.getByText('Allergy: Peanuts',{exact:true}).boundingBox())!.y).toBeLessThan((await dialog.getByText('How much was eaten?',{exact:true}).boundingBox())!.y);
  await dialog.getByRole('button',{name:'Most',exact:true}).click();
  await dialog.getByRole('combobox').click();await page.getByRole('option',{name:'Member person',exact:true}).click();
  await dialog.getByRole('button',{name:'Save',exact:true}).click();await expect(dialog).toHaveCount(0);
  await expect(second.locator('h2')).toHaveText('Meals · 2 of 3 done');
  await theirs.getByRole('button',{name:'Save',exact:true}).click();
  await expect(theirs.getByRole('status')).toContainText('Done by Member person');
  const lunch=f.items.find(i=>i.name==='Lunch')!;
  let saved=await checked(f.admin.client.from('routine_logs').select('*').eq('item_id',lunch.id));expect(saved).toHaveLength(1);expect(saved[0].amount).toBe('most');
  await theirs.getByRole('button',{name:'Done',exact:true}).click();
  await meals.getByRole('button',{name:/2 done/}).click();await meals.getByRole('button',{name:/12:00 PM · Lunch/}).click();
  await dialog.getByLabel('Note (optional)').fill('Synthetic correction');await dialog.getByRole('button',{name:'Save',exact:true}).click();await expect(dialog).toHaveCount(0);
  saved=await checked(f.admin.client.from('routine_logs').select('*').eq('item_id',lunch.id));expect(saved[0].recorded_by).toBe('Member person');
  await meals.getByRole('button',{name:/12:00 PM · Lunch/}).click();await dialog.getByRole('button',{name:'Undo record'}).click();await page.getByRole('alertdialog').getByRole('button',{name:'Undo',exact:true}).click();
  await expect(dialog).toHaveCount(0);await expect(meals.getByRole('heading')).toHaveText('Meals · 1 of 3 done');
});

test('exercise timer survives reload and failed finish, saves real minutes, and can cancel without a record',async({page,sessions})=>{
  void sessions;const f=await routineFamily();await page.clock.install({time:new Date(`${f.date}T12:00:00-04:00`)});await signIn(page,f.admin);
  const exercises=page.locator('[data-routine-section=exercise]');await exercises.getByRole('button',{name:'Start',exact:true}).click();
  await expect(page.locator('[data-exercise-timer]')).toContainText('Running');await page.clock.fastForward(125000);await page.reload();
  const timer=page.locator('[data-exercise-timer]');await expect(timer).toContainText('Running');await expect(timer.getByLabel('Elapsed time')).toHaveText('02:05');
  await timer.getByRole('button',{name:'Pause',exact:true}).click();await expect(timer.getByText('Paused',{exact:true})).toBeVisible();
  await timer.getByRole('button',{name:'Change',exact:true}).click();await timer.getByRole('combobox').click();await page.getByRole('option',{name:'Member person',exact:true}).click();
  await expect(timer.getByText(/Done by Member person/)).toBeVisible();
  await page.route('**/rest/v1/routine_logs?**',route=>route.request().method()==='POST'?route.fulfill({status:503,contentType:'application/json',body:'{"message":"Synthetic offline"}'}):route.continue());
  await timer.getByRole('button',{name:'Finish',exact:true}).click();await expect(timer.getByRole('button',{name:'Finish',exact:true})).toBeEnabled();
  expect(await page.evaluate(()=>Object.keys(localStorage).some(k=>k.startsWith('myht-exercise:')))).toBe(true);
  await page.unroute('**/rest/v1/routine_logs?**');await timer.getByRole('button',{name:'Finish',exact:true}).click();await expect(timer).toHaveCount(0);
  const item=f.items.find(i=>i.name==='Ankle pumps')!;const logs=await checked(f.admin.client.from('routine_logs').select('*').eq('item_id',item.id));expect(logs).toHaveLength(1);expect(logs[0].minutes).toBe(2.1);expect(logs[0].recorded_by).toBe('Member person');
  expect(await page.evaluate(()=>Object.keys(localStorage).some(k=>k.startsWith('myht-exercise:')))).toBe(false);
  await exercises.getByRole('button',{name:/All 2 done/}).click();await exercises.getByRole('button',{name:/5:00 PM · Ankle pumps/}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Undo record'}).click();await page.getByRole('alertdialog').getByRole('button',{name:'Undo',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await exercises.getByRole('button',{name:'Start',exact:true}).click();await timer.getByRole('button',{name:'Cancel without saving',exact:true}).click();await page.getByRole('alertdialog').getByRole('button',{name:'Cancel without saving',exact:true}).click();
  await expect(timer).toHaveCount(0);expect(await checked(f.admin.client.from('routine_logs').select('*').eq('item_id',item.id))).toHaveLength(0);
});

test('an unattributed timer asks first, the target arc fills, and time keeps counting',async({page,sessions})=>{
  void sessions;const f=await routineFamily();await page.clock.install({time:new Date(`${f.date}T12:00:00-04:00`)});await signIn(page,f.admin);
  const exercise=page.locator('[data-routine-section=exercise]');await expect(exercise.getByRole('heading')).toBeVisible();await expect(exercise.getByRole('combobox')).toHaveCount(0);
  const item=f.items.find(i=>i.name==='Ankle pumps')!;
  await page.evaluate(({user,household,item,date})=>localStorage.setItem(`myht-exercise:${user}:${household}`,JSON.stringify({user_id:user,household_id:household,item:{...item,target_minutes:1},for_date:date,for_minute:1020,caregiver_id:'',recorded_by:'',state:'paused',elapsed_ms:0,running_since:null})),{user:f.admin.id,household:f.id,item,date:f.date});
  await page.reload();const timer=page.locator('[data-exercise-timer]');await expect(timer.getByText('Choose who is doing it first',{exact:true})).toBeVisible();await expect(timer.getByRole('button',{name:'Finish',exact:true})).toBeDisabled();
  await timer.getByRole('combobox').click();await page.getByRole('option',{name:'Member person',exact:true}).click();await expect(timer.getByText('Running',{exact:true})).toBeVisible();
  await page.clock.fastForward(61000);await expect(timer.getByRole('progressbar')).toHaveAttribute('aria-valuenow','100');await expect(timer.getByText('Target reached',{exact:true})).toBeVisible();
  await page.clock.fastForward(60000);await expect(timer.getByLabel('Elapsed time')).toHaveText('02:01');await expect(timer.locator('[data-progress-arc]')).toHaveAttribute('stroke-dashoffset','0');
  await timer.getByRole('button',{name:'Cancel without saving',exact:true}).click();await page.getByRole('alertdialog').getByRole('button',{name:'Cancel without saving',exact:true}).click();await expect(timer).toHaveCount(0);
});

test('History uses done time and copied fields, keeps Food Yes, and the day editor counts meals',async({page,sessions})=>{
  void sessions;const f=await routineFamily();await signIn(page,f.admin);await page.getByRole('button',{name:'History',exact:true}).click();
  await expect(page.getByText('Meals recorded: 1 · Breakfast all',{exact:true})).toBeVisible();await expect(page.getByText('Food',{exact:true})).toHaveCount(0);
  await expect(page.getByText('Oatmeal with fruit',{exact:false})).toBeVisible();
  await checked(f.admin.client.from('health_records').update({food_taken:true,food_description:'Extra food'}).eq('household_id',f.id));
  await expect(page.getByText('Yes — Extra food',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Edit this day'}).click();await expect(page.getByText('Meals recorded today: 1',{exact:true})).toBeVisible();
});

test('an after-midnight meal belongs to its completion day in History and names the prior planned time',async({page,sessions})=>{
  void sessions;const f=await routineFamily();
  const previous=new Date(`${f.date}T12:00:00`);previous.setDate(previous.getDate()-1);
  const date=[previous.getFullYear(),String(previous.getMonth()+1).padStart(2,'0'),String(previous.getDate()).padStart(2,'0')].join('-');
  const item=await checked(f.admin.client.from('routine_items').insert({household_id:f.id,kind:'meal',name:'Late snack',schedule_time:'11:30 PM',start_date:date,created_at:new Date(`${date}T00:00:00`).toISOString()}).select('*').single());
  const caregiver=f.people.find(p=>p.user_id===f.admin.id)!;
  await checked(f.admin.client.from('routine_logs').insert({household_id:f.id,item_id:item.id,for_date:date,for_minute:1410,done_at:new Date(`${f.date}T00:10:00`).toISOString(),caregiver_id:caregiver.caregiver_id,recorded_by:caregiver.display_name,kind:'meal',name:item.name,amount:'most'}));
  await signIn(page,f.admin);await page.getByRole('button',{name:'History',exact:true}).click();
  await expect(page.getByText(/^Meals recorded: 2 ·/)).toBeVisible();await expect(page.getByText('Late snack',{exact:true})).toBeVisible();
  const expected=new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric'}).format(previous);
  await expect(page.getByText(new RegExp(`for ${expected}, 11:30 PM`))).toBeVisible();
  await page.getByRole('button',{name:'Edit this day'}).click();await expect(page.getByText('Meals recorded today: 2',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Back to the diary'}).click();await page.getByRole('button',{name:/Yesterday/}).click();
  await expect(page.getByText('Late snack',{exact:true})).toHaveCount(0);await expect(page.getByText(/^Meals recorded:/)).toHaveCount(0);
});

test('a meal load error leaves exercise and medicines visible and retries independently',async({page,sessions})=>{
  void sessions;const f=await routineFamily();
  await page.route('**/rest/v1/routine_items?**',route=>new URL(route.request().url()).searchParams.get('kind')==='eq.meal'?route.fulfill({status:503,contentType:'application/json',body:'{"message":"Synthetic meal failure"}'}):route.continue());
  await signIn(page,f.admin);
  const meals=page.locator('[data-routine-section=meal]');await expect(meals).toContainText('Meals could not load');
  await expect(page.locator('[data-routine-section=exercise]').getByRole('heading')).toHaveText('Exercise · 1 of 2 done');
  await expect(page.getByText('Coming up · next 12 hours',{exact:true})).toBeVisible();
  await page.unroute('**/rest/v1/routine_items?**');await meals.getByRole('button',{name:'Try again'}).click();await expect(meals.getByRole('heading')).toHaveText('Meals · 1 of 3 done');
});
