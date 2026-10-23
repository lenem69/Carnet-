// Clé gratuite partagée : passe par le proxy avec l’identifiant d’appareil, limite de 5 vins par jour, clé personnelle prioritaire, fenêtre de limite.
import {start} from './server.mjs';import * as H from './h.mjs';
H.deploy();const srv=await start(8123);const b=await H.browser();
const S=H.suite('Clé gratuite');const T=S.T;
const PROXY='cave-ia.m-jeanfrancois-morin.workers.dev';
const G=o=>({json:{candidates:[{content:{parts:[{text:JSON.stringify(o)}]}}]}});
let mode='ok';
const ai=async()=>mode==='403'?{status:403,json:{error:'origine_refusee'}}:G({items:[]});
const r=await H.newPage(b,{ai});const page=r.page;const calls=r.calls;
const errs=[];page.on('pageerror',e=>errs.push(e.message));
const lancer=async()=>{await H.click(page,'#fab');await H.sl(300);await H.tapText(page,'#sMenu button','Mettre à jour les fiches');await H.sl(500);const d=await page.evaluate(()=>(document.querySelector('#dlgT')?.textContent||'')+' '+(document.querySelector('#dlgX')?.textContent||'')+' || '+(document.querySelector('#toast,.toast')?.textContent||''));if(!d.includes('Limite du jour')&&!d.includes('Lancer')&&!(await page.evaluate(()=>[...document.querySelectorAll('#dlgB button')].some(b=>b.textContent.includes('Lancer')))))throw new Error('pas de confirmation : '+d);if(!d.includes('Limite du jour'))await page.evaluate(()=>[...document.querySelectorAll('#dlgB button')].find(b=>b.textContent.includes('Lancer')).click());await H.sl(2500);};
const aujourdhui=()=>new Date().toISOString().slice(0,10);

await page.goto(H.URL0);await H.sl(900);
await page.evaluate(async()=>{localStorage.setItem('cave-gratuit','on');localStorage.removeItem('cave-ai');
  const s=await import('./store.js');await s.replaceAll([{id:'a',name:'Vin A',year:2018,qty:2,from:2020,to:2035,src:{from:'user',to:'user'},dom:'D',color:'Rouge',region:'M',grape:'',price:20,created:1,updated:1,story:'',pairings:[],check:false,conf:'',sources:[],note:'',loc:'',tastings:[]}]);});
await page.reload();await H.sl(1500);
await page.evaluate(()=>document.querySelectorAll('.modal.show').forEach(m=>m.classList.remove('show')));
const appareil=await page.evaluate(async()=>{const s=await import('./store.js');return s.getMeta('appareil');});
T('identifiant d’appareil créé',typeof appareil==='string'&&appareil.length>=16,appareil);

await lancer();
const c1=calls.find(c=>c.url.includes(PROXY));
T('sans clé personnelle : appel vers le proxy',!!c1,calls.map(c=>c.url).join(' | '));
T('appel proxy : identifiant d’appareil et nombre de vins, sans clé Google',c1&&c1.headers['x-appareil']===appareil&&c1.headers['x-unites']==='1'&&!c1.headers['x-goog-api-key'],JSON.stringify(c1&&c1.headers));
const cpt=await page.evaluate(async()=>{const s=await import('./store.js');return s.getMeta('gratuit');});
T('compteur du jour : 1 vin compté',cpt&&cpt.vins===1&&cpt.jour===aujourdhui(),JSON.stringify(cpt));

// Le service gratuit refuse (403) : message clair, qui n'accuse pas une clé que l'utilisateur n'a pas.
mode='403';
await page.evaluate(async()=>{const s=await import('./store.js');await s.setMeta('gratuit',{jour:new Date().toISOString().slice(0,10),vins:0});
  await s.replaceAll([{id:'q',name:'Vin Q',year:2017,qty:1,from:2020,to:2035,src:{from:'user',to:'user'},dom:'D',color:'Rouge',region:'M',grape:'',price:20,created:1,updated:1,story:'',pairings:[],check:false,conf:'',sources:[],note:'',loc:'',tastings:[]}]);});
await page.reload();await H.sl(1500);
await page.evaluate(()=>document.querySelectorAll('.modal.show').forEach(m=>m.classList.remove('show')));
await lancer();
const logT=await page.evaluate(()=>document.querySelector('#sLog')?.innerText||'');
T('service gratuit refusé : message clair, sans « Clé IA refusée »',/service gratuit est momentanément indisponible/.test(logT)&&!/Clé IA refusée/.test(logT),logT.slice(0,300));
T('service gratuit refusé : le motif du service est affiché',logT.includes('origine_refusee'),logT.slice(0,300));
mode='ok';

// Clé personnelle : elle passe avant la clé gratuite.
await page.evaluate(()=>localStorage.setItem('cave-ai',JSON.stringify({provider:'gemini',key:'AIzaPERSO',model:'gemini-3.5-flash-lite'})));
await page.reload();await H.sl(1500);
await page.evaluate(()=>document.querySelectorAll('.modal.show').forEach(m=>m.classList.remove('show')));
const n0=calls.length;
await page.evaluate(async()=>{const s=await import('./store.js');await s.replaceAll([{id:'b',name:'Vin B',year:2019,qty:1,from:2020,to:2035,src:{from:'user',to:'user'},dom:'D',color:'Rouge',region:'M',grape:'',price:20,created:1,updated:1,story:'',pairings:[],check:false,conf:'',sources:[],note:'',loc:'',tastings:[]}]);});
await page.reload();await H.sl(1500);
await page.evaluate(()=>document.querySelectorAll('.modal.show').forEach(m=>m.classList.remove('show')));
await lancer();
const c2=calls.slice(n0).find(c=>c.url.includes('googleapis'));
T('clé personnelle : appel direct, prioritaire',!!c2&&c2.headers['x-goog-api-key']==='AIzaPERSO',calls.slice(n0).map(c=>c.url).join(' | '));
T('clé personnelle : aucun appel au proxy',!calls.slice(n0).some(c=>c.url.includes(PROXY)));

// Limite atteinte sans clé personnelle : fenêtre explicative, pas d’appel.
await page.evaluate(async()=>{localStorage.removeItem('cave-ai');const s=await import('./store.js');await s.setMeta('gratuit',{jour:new Date().toISOString().slice(0,10),vins:5});});
await page.reload();await H.sl(1500);
await page.evaluate(()=>document.querySelectorAll('.modal.show').forEach(m=>m.classList.remove('show')));
const n1=calls.length;
await lancer();
T('limite atteinte : aucun appel',calls.slice(n1).length===0,calls.slice(n1).length);
const titre=await page.evaluate(()=>document.querySelector('#dlgT')?.textContent||'');
T('limite atteinte : fenêtre « Limite du jour atteinte »',titre.includes('Limite du jour atteinte'),titre);

// Désactivée : aucune clé gratuite, comportement d’avant.
await page.evaluate(()=>localStorage.setItem('cave-gratuit','off'));
await page.reload();await H.sl(1200);
T('aucune erreur de script',errs.length===0,errs.join(' / '));
S.out.forEach(l=>console.log(l));
console.log(`\n${S.out.filter(l=>l.startsWith('PASS')).length} réussis, ${S.out.filter(l=>l.startsWith('FAIL')).length} échec(s)`);
await b.close();srv.close?.();process.exit(S.out.some(l=>l.startsWith('FAIL'))?1:0);
