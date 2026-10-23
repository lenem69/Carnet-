// Réglages : autorisation des notifications de nouvelle version.
import {start} from './server.mjs';import * as H from './h.mjs';
H.deploy();const srv=await start(8123);const b=await H.browser();
const S=H.suite('Notifications de version');const T=S.T;
const r=await H.newPage(b);const page=r.page;
const errs=[];page.on('pageerror',e=>errs.push(e.message));
await page.goto(H.URL0);await H.sl(900);
await page.evaluate(()=>{const s=document.querySelector('#sBienv');if(s)s.classList.remove('show');});
await H.click(page,'#bSet');await H.sl(450);
T('réglages : section « Nouvelles versions » présente',(await page.$eval('#sSet',e=>e.textContent)).includes('Nouvelles versions'));
T('réglages : bouton d’autorisation affiché tant que non accordé',await page.$eval('#st-notif',e=>!e.hidden).catch(()=>false)||(await page.evaluate(()=>Notification.permission))==='granted');
T('réglages : état lisible',(await H.txt(page,'#st-notif-info')).length>5);
T('aucune erreur JavaScript',errs.length===0,errs.join(' | '));
await page.close();
console.log(S.out.join('\n'));await b.close();srv.close();
