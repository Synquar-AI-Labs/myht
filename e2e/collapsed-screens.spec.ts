import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, signIn, checked } from './helpers';
import { routineFamily } from './routine-fixtures';

const sizes=[[320,568],[360,800],[393,852],[800,1280],[1280,800]];
const names=['today-closed','today-open','today-soon-closed','today-soon-open','meal-due-bar','meal-soon-bar','more','meals','exercise'];
for(const [width,height] of sizes)test(`${width}x${height} collapsed Today and separate plans`,async({page,sessions})=>{
  void sessions;const f=await routineFamily();
  const medicine=await checked(f.admin.client.from('medicines').insert({household_id:f.id,name:'Synthetic due medicine',schedule_time:'12:30 PM',amount:'1 tablet'}).select('*').single());
  await checked(f.admin.client.from('medicine_logs').insert({household_id:f.id,medicine_id:medicine.id,date:f.date,hour:11,minute:0,caregiver_id:f.people[0].caregiver_id,recorded_by:f.people[0].display_name,is_extra:true}));
  await page.clock.setFixedTime(new Date(`${f.date}T12:30:00-04:00`));await page.setViewportSize({width,height});await signIn(page,f.admin);
  const folder=`test-results/collapsed/${width}x${height}`;mkdirSync(folder,{recursive:true});
  const capture=async(name:string)=>{
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.evaluate(()=>document.fonts.ready);
    await expect(page.locator('[data-sonner-toast]')).toHaveCount(0);
    if(width>=768&&(name.startsWith('today-')||name.startsWith('presentation-')))await expect(async()=>{
      const layout=await page.evaluate(()=>{
        const upcoming=document.querySelector('.dose-upcoming-header')!.closest('section')!.getBoundingClientRect();
        const given=document.querySelector('.dose-given-header')!.closest('section')!.getBoundingClientRect();
        const meal=document.querySelector('[data-routine-section=meal]')!.getBoundingClientRect();
        const exercise=document.querySelector('[data-routine-section=exercise]')!.getBoundingClientRect();
        const record=document.querySelector('[data-record-bar]')!.getBoundingClientRect();
        return {lefts:[upcoming.x,given.x,meal.x,exercise.x],widths:[upcoming.width,given.width,meal.width,exercise.width],gaps:[given.top-upcoming.bottom,meal.top-given.bottom,exercise.top-meal.bottom],recordLeft:record.left,leftRight:meal.right};
      });
      expect(Math.max(...layout.lefts)-Math.min(...layout.lefts)).toBeLessThan(1);
      expect(Math.max(...layout.widths)-Math.min(...layout.widths)).toBeLessThan(1);
      for(const gap of layout.gaps)expect(gap).toBeCloseTo(32,0);
      expect(layout.recordLeft).toBeGreaterThan(layout.leftRight);
    }).toPass();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await expect(async()=>{
      const issues=await page.evaluate(()=>Array.from(document.querySelectorAll<HTMLElement>('button,input:not([type=file]),textarea,select,a[href]')).filter(e=>e.getClientRects().length&&!e.closest('[aria-hidden=true]')).flatMap(e=>{
        const r=e.getBoundingClientRect();return r.width<43.9||r.height<43.9?[`${e.textContent}: ${r.width}x${r.height}`]:[];
      }));expect(issues).toEqual([]);
    }).toPass();
    await page.screenshot({path:`${folder}/${name}.png`,fullPage:true,animations:'disabled'});
  };
  const captureMealBar=async(name:string)=>{
    const bar=page.locator('[data-routine-section=meal] [data-routine-bar]');
    await bar.evaluate(element=>element.scrollIntoView({block:'center'}));
    await bar.screenshot({path:`${folder}/${name}.png`,animations:'disabled'});
    await page.evaluate(()=>window.scrollTo(0,0));
  };
  const assertClosed=async()=>{
    await expect(page.locator('[data-routine-bar]')).toHaveCount(2);await expect(page.locator('.dose-time-header')).toHaveCount(2);
    await expect(page.locator('[data-record-bar]')).toHaveCount(5);
    for(const bar of await page.locator('.dose-time-header,[data-routine-bar],[data-record-bar]').all())await expect(bar).toHaveAttribute('aria-expanded','false');
    await expect(page.getByRole('button',{name:'Expand all',exact:true})).toBeVisible();
  };
  const openAll=async()=>{await page.getByRole('button',{name:'Expand all',exact:true}).click();await expect(page.getByRole('button',{name:'Collapse all',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Record',exact:true})).toBeVisible();};
  await assertClosed();await capture('today-closed');await captureMealBar('meal-due-bar');await openAll();await capture('today-open');
  await page.clock.setFixedTime(new Date(`${f.date}T11:45:00-04:00`));await page.reload();
  await expect(page.locator('[data-routine-section=meal] [data-routine-bar]')).toContainText('SOON');
  await assertClosed();await capture('today-soon-closed');await captureMealBar('meal-soon-bar');await openAll();await capture('today-soon-open');
  await page.getByRole('button',{name:'More',exact:true}).click();await expect(page.getByRole('button',{name:/^Meals 3 meals a day/})).toBeVisible();await expect(page.getByRole('button',{name:/^Exercise 2 exercises/})).toBeVisible();await capture('more');
  await page.getByRole('button',{name:/^Meals /}).click();await expect(page.getByRole('button',{name:'Add meal',exact:true})).toBeVisible();await capture('meals');
  await page.getByRole('button',{name:'Back',exact:true}).click();await page.getByRole('button',{name:/^Exercise /}).click();await expect(page.getByRole('button',{name:'Add exercise',exact:true})).toBeVisible();await capture('exercise');
  if(width>=768){
    await page.clock.setFixedTime(new Date(`${f.date}T12:30:00-04:00`));
    await page.getByRole('button',{name:'Back',exact:true}).click();await page.getByRole('button',{name:/^Presentation mode/}).click();await assertClosed();await capture('presentation-closed');await openAll();await capture('presentation-open');
    await page.clock.setFixedTime(new Date(`${f.date}T11:45:00-04:00`));await page.reload();
    await page.getByRole('button',{name:'More',exact:true}).click();await page.getByRole('button',{name:/^Presentation mode/}).click();
    await expect(page.locator('[data-routine-section=meal] [data-routine-bar]')).toContainText('SOON');
    await assertClosed();await capture('presentation-soon-closed');await openAll();await capture('presentation-soon-open');
  }
  writeFileSync('test-results/collapsed/index.html',`<!doctype html><title>Collapsed Today and separate plans</title><style>body{font:16px sans-serif}section{display:flex;gap:16px;flex-wrap:wrap}img{width:300px;border:1px solid #ddd}figure{margin:10px}</style><h1>Collapsed Today and separate plans</h1>${sizes.map(([w,h])=>`<h2>${w} × ${h}</h2><section>${[...names,...(w>=768?['presentation-closed','presentation-open','presentation-soon-closed','presentation-soon-open']:[])].map(n=>`<figure><a href="${w}x${h}/${n}.png"><img src="${w}x${h}/${n}.png"></a><figcaption>${n}</figcaption></figure>`).join('')}</section>`).join('')}`);
});
