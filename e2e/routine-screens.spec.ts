import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, family, signIn, more, checked } from './helpers';

const sizes = [[320,568],[360,800],[393,852],[800,1280],[1280,800]];
const names = ['plan-empty','plan','add-meal','add-exercise','exercise-picked','edit-meal','stop'];
for (const [width,height] of sizes) test(`${width}x${height} routine plan screens`, async ({ page, sessions }) => {
  void sessions;
  const f=await family(); await page.setViewportSize({width,height});
  await checked(f.admin.client.from('care_alerts').insert({household_id:f.id,kind:'diet',text:'Cut food into small pieces'}));
  await signIn(page,f.admin); await more(page,'Meals');
  const folder=`test-results/routines/${width}x${height}`; mkdirSync(folder,{recursive:true});
  const capture=async(name:string)=>{
    if(name==='edit-meal'||name==='stop')await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
    await page.evaluate(()=>document.fonts.ready);
    await expect(page.locator('[data-sonner-toast]')).toHaveCount(0);
    await expect(async()=>{
      const problems=await page.evaluate(()=>{
        const errors:string[]=[];
        if(document.documentElement.scrollWidth>innerWidth+1)errors.push('page overflow');
        for(const element of document.querySelectorAll<HTMLElement>('button,input:not([type=file]),textarea,select,a[href]')){
          if(!element.getClientRects().length||element.closest('[aria-hidden=true]'))continue;
          const r=element.getBoundingClientRect();
          if(r.width<43.9||r.height<43.9)errors.push(`small target: ${element.textContent} ${r.width}x${r.height}`);
          if(r.left< -1||r.right>innerWidth+1)errors.push('control outside viewport');
        }
        return errors;
      });expect(problems).toEqual([]);
    }).toPass({timeout:5000});
    await page.screenshot({path:`${folder}/${name}.png`,fullPage:true});
  };
  await expect(page.getByRole('button',{name:'Start from a typical day'})).toBeVisible();await capture('plan-empty');
  await page.getByRole('button',{name:'Start from a typical day'}).click();
  await expect(page.getByRole('status')).toContainText('6 meals filled in');await capture('plan');
  await page.getByRole('button',{name:'Add meal',exact:true}).click();await capture('add-meal');
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.getByRole('button',{name:'Back',exact:true}).click();await page.getByRole('button',{name:/^Exercise /}).click();
  await page.getByRole('button',{name:'Add exercise',exact:true}).click();await capture('add-exercise');
  await page.getByRole('button',{name:'Knees',exact:true}).click();await page.getByRole('button',{name:'Straight leg raises',exact:true}).click();
  await page.getByRole('button',{name:'+ Add a time',exact:true}).click();await capture('exercise-picked');
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.getByRole('button',{name:'Back',exact:true}).click();await page.getByRole('button',{name:/^Meals /}).click();
  await page.getByRole('button',{name:/8:00 AM Breakfast/}).click();
  await expect(page.getByRole('button',{name:'Back',exact:true})).toHaveCount(0);
  const stop=await page.getByRole('button',{name:'Stop from a date'}).boundingBox(),remove=await page.getByRole('button',{name:'Delete',exact:true}).boundingBox();
  expect(Math.abs(stop!.y-remove!.y)).toBeLessThanOrEqual(1);expect(stop!.height).toBe(remove!.height);
  await capture('edit-meal');
  await page.getByRole('button',{name:'Stop from a date'}).click();await capture('stop');
  writeFileSync('test-results/routines/index.html',`<!doctype html><title>Routine plans</title><style>body{font:16px sans-serif}section{display:flex;flex-wrap:wrap;gap:16px}img{width:300px;border:1px solid #ddd}figure{margin:10px}</style><h1>Meals & exercise</h1>${sizes.map(([w,h])=>`<h2>${w} × ${h}</h2><section>${names.map(n=>`<figure><a href="${w}x${h}/${n}.png"><img src="${w}x${h}/${n}.png"></a><figcaption>${n}</figcaption></figure>`).join('')}</section>`).join('')}`);
});
