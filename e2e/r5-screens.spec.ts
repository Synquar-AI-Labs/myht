import { mkdirSync,writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { test,expect,signIn,more,checked } from './helpers';
import { reportVisitFamily } from './r5-fixtures';

const sizes=[[393,852],[1280,800]];
const names=['appointment-form','doctor-picker','where-picker','contact-prompt','contact-prefill','contacts','other-readings'];
for(const [width,height] of sizes)test(`${width}x${height} report and appointment contact screens`,async({page,sessions})=>{
  void sessions;const f=await reportVisitFamily();await page.setViewportSize({width,height});
  await checked(f.admin.client.from('custom_action_logs').insert([6.4,7.2].map((value,i)=>({household_id:f.id,action_id:f.action.id,date:f.date,value,hour:i?1:8,am_pm:i?'PM':'AM',recorded_by:'Sample helper'}))));
  const folder=`test-results/r5/${width}x${height}`;mkdirSync(folder,{recursive:true});
  const capture=async(name:string)=>{
    await page.evaluate(()=>document.fonts.ready);await expect(page.locator('[data-sonner-toast]')).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await expect(async()=>{
      const issues=await page.evaluate(()=>Array.from(document.querySelectorAll<HTMLElement>('button,input:not([type=file]),textarea,select,a[href]')).filter(e=>e.getClientRects().length&&!e.closest('[aria-hidden=true]')).flatMap(e=>{
        const r=e.getBoundingClientRect();return r.width<43.9||r.height<43.9?[`${e.textContent}: ${r.width}x${r.height}`]:[];
      }));expect(issues).toEqual([]);
    }).toPass({timeout:5000});
    await page.screenshot({path:`${folder}/${name}.png`,fullPage:!(await page.getByRole('dialog').count()),animations:'disabled'});
  };
  await signIn(page,f.admin);await page.getByRole('button',{name:/^Appointments & notes/}).click();await page.getByRole('button',{name:'Appointment',exact:true}).click();
  const dialog=page.getByRole('dialog');await dialog.getByRole('combobox',{name:'Doctor Name',exact:true}).click();await page.getByRole('option',{name:'Dr. Sample · Family doctor',exact:true}).click();
  await dialog.getByLabel('Reason',{exact:true}).fill('Routine check');await capture('appointment-form');
  await dialog.getByRole('combobox',{name:'Doctor Name',exact:true}).fill('Dr.');await capture('doctor-picker');
  await dialog.getByRole('combobox',{name:'Where',exact:true}).fill('');await capture('where-picker');
  await page.getByRole('option',{name:'Sample Clinic · 456 Sample Road',exact:true}).click();
  await dialog.getByRole('combobox',{name:'Doctor Name',exact:true}).fill('Dr. New');await page.getByRole('option',{name:"Use 'Dr. New'",exact:true}).click();
  await dialog.getByRole('button',{name:'Save Appointment',exact:true}).click();await expect(dialog.getByRole('heading')).toHaveText('Add Dr. New to Contacts?');await capture('contact-prompt');
  await dialog.getByRole('button',{name:'Add',exact:true}).click();await expect(dialog.getByLabel('Name',{exact:true})).toHaveValue('Dr. New');await capture('contact-prefill');
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await expect(dialog).toHaveCount(0);
  await more(page,'Contacts');await expect(page.getByRole('heading',{name:'Hospitals & clinics',exact:true})).toBeVisible();await capture('contacts');
  await page.getByRole('button',{name:'Back',exact:true}).click();await page.getByRole('button',{name:/^Reports & downloads/}).click();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download Weekly PDF',exact:true}).click();await (await download).saveAs(`${folder}/weekly-custom.pdf`);
  const text=execFileSync('pdftotext',['-layout',`${folder}/weekly-custom.pdf`,'-'],{encoding:'utf8'});expect(text).toContain('Other readings');expect(text).toContain('6.4 mmol/L');
  execFileSync('pdftoppm',['-f','1','-singlefile','-scale-to-x',String(width),'-scale-to-y','-1','-png',`${folder}/weekly-custom.pdf`,`${folder}/other-readings`]);
  writeFileSync('test-results/r5/index.html',`<!doctype html><title>R5 reports and appointments</title><style>body{font:16px sans-serif}section{display:flex;gap:16px;flex-wrap:wrap}img{width:300px;border:1px solid #ddd}figure{margin:10px}</style><h1>Reports and appointment contacts</h1>${sizes.map(([w,h])=>`<h2>${w} × ${h}</h2><section>${names.map(n=>`<figure><a href="${w}x${h}/${n}.png"><img src="${w}x${h}/${n}.png"></a><figcaption>${n}</figcaption></figure>`).join('')}</section>`).join('')}`);
});
