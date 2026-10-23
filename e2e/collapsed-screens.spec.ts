import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, signIn, checked } from './helpers';
import { routineFamily } from './routine-fixtures';

const sizes=[[320,568],[360,800],[393,852],[800,1280],[1280,800]];
const names=['today-closed','today-open','more','meals','exercise'];
for(const [width,height] of sizes)test(`${width}x${height} collapsed Today and separate plans`,async({page,sessions})=>{
  void sessions;const f=await routineFamily();
  const medicine=await checked(f.admin.client.from('medicines').insert({household_id:f.id,name:'Synthetic due medicine',schedule_time:'12:30 PM',amount:'1 tablet'}).select('*').single());
  await checked(f.admin.client.from('medicine_logs').insert({household_id:f.id,medicine_id:medicine.id,date:f.date,hour:11,minute:0,caregiver_id:f.people[0].caregiver_id,recorded_by:f.people[0].display_name,is_extra:true}));
  await page.clock.setFixedTime(new Date(`${f.date}T12:30:00-04:00`));await page.setViewportSize({width,height});await signIn(page,f.admin);
  const folder=`test-results/collapsed/${width}x${height}`;mkdirSync(folder,{recursive:true});
  const capture=async(name:string)=>{
    await page.evaluate(()=>document.fonts.ready);
    await expect(page.locator('[data-sonner-toast]')).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await expect(async()=>{
      const issues=await page.evaluate(()=>Array.from(document.querySelectorAll<HTMLElement>('button,input:not([type=file]),textarea,select,a[href]')).filter(e=>e.getClientRects().length&&!e.closest('[aria-hidden=true]')).flatMap(e=>{
        const r=e.getBoundingClientRect();return r.width<43.9||r.height<43.9?[`${e.textContent}: ${r.width}x${r.height}`]:[];
      }));expect(issues).toEqual([]);
    }).toPass();
    await page.screenshot({path:`${folder}/${name}.png`,fullPage:true,animations:'disabled'});
  };
  const assertClosed=async()=>{
    await expect(page.locator('[data-routine-bar]')).toHaveCount(2);await expect(page.locator('.dose-time-header')).toHaveCount(2);
    for(const bar of await page.locator('.dose-time-header,[data-routine-bar]').all())await expect(bar).toHaveAttribute('aria-expanded','false');
    await expect(page.getByRole('button',{name:'Expand all',exact:true})).toBeVisible();
  };
  const openAll=async()=>{await page.getByRole('button',{name:'Expand all',exact:true}).click();await expect(page.getByRole('button',{name:'Collapse all',exact:true})).toBeVisible();};
  await assertClosed();await capture('today-closed');await openAll();await capture('today-open');
  await page.getByRole('button',{name:'More',exact:true}).click();await expect(page.getByRole('button',{name:/^Meals 3 meals a day/})).toBeVisible();await expect(page.getByRole('button',{name:/^Exercise 2 exercises/})).toBeVisible();await capture('more');
  await page.getByRole('button',{name:/^Meals /}).click();await expect(page.getByRole('button',{name:'Add meal',exact:true})).toBeVisible();await capture('meals');
  await page.getByRole('button',{name:'Back',exact:true}).click();await page.getByRole('button',{name:/^Exercise /}).click();await expect(page.getByRole('button',{name:'Add exercise',exact:true})).toBeVisible();await capture('exercise');
  if(width>=768){
    await page.getByRole('button',{name:'Back',exact:true}).click();await page.getByRole('button',{name:/^Presentation mode/}).click();await assertClosed();await capture('presentation-closed');await openAll();await capture('presentation-open');
  }
  writeFileSync('test-results/collapsed/index.html',`<!doctype html><title>Collapsed Today and separate plans</title><style>body{font:16px sans-serif}section{display:flex;gap:16px;flex-wrap:wrap}img{width:300px;border:1px solid #ddd}figure{margin:10px}</style><h1>Collapsed Today and separate plans</h1>${sizes.map(([w,h])=>`<h2>${w} × ${h}</h2><section>${[...names,...(w>=768?['presentation-closed','presentation-open']:[])].map(n=>`<figure><a href="${w}x${h}/${n}.png"><img src="${w}x${h}/${n}.png"></a><figcaption>${n}</figcaption></figure>`).join('')}</section>`).join('')}`);
});
