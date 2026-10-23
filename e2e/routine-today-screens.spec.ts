import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, signIn } from './helpers';
import { routineFamily } from './routine-fixtures';
const sizes=[[320,568],[360,800],[393,852],[800,1280],[1280,800]];
const names=['today-folded','today-open','meal-sheet','timer-running','timer-paused','timer-target-reached','history'];
for(const [width,height] of sizes)test(`${width}x${height} routine Today states`,async({page,sessions})=>{
  void sessions;const f=await routineFamily();await page.clock.install({time:new Date(`${f.date}T12:00:00-04:00`)});await page.setViewportSize({width,height});await signIn(page,f.admin);
  const folder=`test-results/routines-today/${width}x${height}`;mkdirSync(folder,{recursive:true});
  const capture=async(name:string)=>{
    await page.evaluate(()=>document.fonts.ready);
    await expect(page.locator('[data-sonner-toast]')).toHaveCount(0);
    await expect(async()=>{
      const issues=await page.evaluate(()=>{
        const problems:string[]=[];
        if(document.documentElement.scrollWidth>innerWidth+1)problems.push('horizontal overflow');
        for(const el of document.querySelectorAll<HTMLElement>('button,input:not([type=file]),textarea,select,a[href]')){
          if(!el.getClientRects().length||el.closest('[aria-hidden=true]'))continue;
          const r=el.getBoundingClientRect();
          if(r.width<43.9||r.height<43.9)problems.push(`small target ${el.textContent} ${r.width}x${r.height}`);
          if((r.left< -1||r.right>innerWidth+1)&&!el.closest('.overflow-x-auto'))problems.push('outside viewport');
        }return problems;
      });expect(issues).toEqual([]);
    }).toPass({timeout:5000});
    if(name.startsWith('timer-')) {
      const box=await page.getByRole('dialog').boundingBox();expect(box!.x).toBeCloseTo(0,0);expect(box!.y).toBeCloseTo(0,0);expect(box!.height).toBeCloseTo(height,0);
    }
    await page.screenshot({path:`${folder}/${name}.png`,fullPage:!name.startsWith('timer-')&&name!=='meal-sheet'});
  };
  const meals=page.locator('[data-routine-section=meal]'), exercise=page.locator('[data-routine-section=exercise]');
  await expect(meals.getByRole('heading')).toHaveText('Meals · 1 of 3 done');await expect(exercise.getByRole('heading')).toHaveText('Exercise · 1 of 2 done');await capture('today-folded');
  await meals.locator('[data-routine-bar]').click();await exercise.locator('[data-routine-bar]').click();
  await meals.getByRole('button',{name:/1 done/}).click();await exercise.getByRole('button',{name:/1 done/}).click();await capture('today-open');
  await meals.getByRole('button',{name:'Done',exact:true}).first().click();await expect(page.getByRole('dialog')).toBeVisible();await capture('meal-sheet');
  await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await exercise.getByRole('button',{name:'Start',exact:true}).click();await expect(page.locator('[data-exercise-timer]')).toContainText('Running');await page.clock.fastForward(300000);await capture('timer-running');
  await page.locator('[data-exercise-timer]').getByRole('button',{name:'Pause',exact:true}).click();await capture('timer-paused');
  await page.locator('[data-exercise-timer]').getByRole('button',{name:'Resume',exact:true}).click();await page.clock.fastForward(300000);await expect(page.getByText('Target reached',{exact:true})).toBeVisible();await capture('timer-target-reached');
  await page.locator('[data-exercise-timer]').getByRole('button',{name:'Cancel without saving',exact:true}).click();await page.getByRole('alertdialog').getByRole('button',{name:'Cancel without saving',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'History',exact:true}).click();await expect(page.getByText('Meals recorded: 1 · Breakfast all',{exact:true})).toBeVisible();await capture('history');
  if(width>=768){
    await page.getByRole('button',{name:'More',exact:true}).click();await page.getByRole('button',{name:/^Presentation mode/}).click();await expect(meals).toBeVisible();await expect(exercise).toBeVisible();
    const a=await meals.boundingBox(),b=await exercise.boundingBox();expect(Math.abs(a!.x-b!.x)).toBeLessThan(1);expect(Math.abs(a!.width-b!.width)).toBeLessThan(1);expect(b!.y-a!.y-a!.height).toBeCloseTo(32,0);
    await capture('presentation');
  }
  writeFileSync('test-results/routines-today/index.html',`<!doctype html><title>Routines on Today</title><style>body{font:16px sans-serif}section{display:flex;gap:16px;flex-wrap:wrap}img{width:300px;border:1px solid #ddd}figure{margin:10px}</style><h1>Routines on Today</h1>${sizes.map(([w,h])=>`<h2>${w} × ${h}</h2><section>${[...names,...(w>=768?['presentation']:[])].map(n=>`<figure><a href="${w}x${h}/${n}.png"><img src="${w}x${h}/${n}.png"></a><figcaption>${n}</figcaption></figure>`).join('')}</section>`).join('')}`);
});
