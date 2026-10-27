// Deux utilisateurs : (A) première installation, (B) mise à jour depuis la version précédente avec une cave existante et une ancienne bible.
import {start} from './server.mjs';import * as H from './h.mjs';import fs from 'fs';
H.deploy();const srv=await start(8123);const b=await H.browser();
const S=H.suite('Installation et mise à jour');const T=S.T;
const Y=new Date().getFullYear();
const W=(id,o)=>({id,name:'Vin '+id,dom:'Domaine '+id,year:Y-5,color:'Rouge',region:'Chinon',grape:'',qty:1,price:'',loc:'',from:'',to:'',story:'',pairings:[],note:'',check:false,src:{},conf:'',sources:[],tastings:[],created:1,updated:1,...o});
const bibleTxt=fs.readFileSync(new URL('../bible/bible.json',import.meta.url),'utf8');
const carte=(page,n)=>page.evaluate(n=>{const w=[...document.querySelectorAll('#list .w')].find(e=>e.querySelector('h4').textContent.includes(n));return w?{t:w.textContent,cls:w.className,pill:(w.querySelector('.stl .tag.stp')||{}).textContent||'',open:w.querySelector('details')?.open}:null},n);
const chev=page=>page.evaluate(()=>{const s=document.querySelector('#list .w details > summary');if(!s)return null;const a=getComputedStyle(s,'::after');return {content:a.content,w:a.width,tr:a.transform}});
// ---------- (A) Première installation ----------
{
  const r=await H.newPage(b,{ai:async()=>({json:{}})});const page=r.page;
  await page.goto(H.URL0);await H.sl(1800);
  const st=await page.evaluate(async()=>{const s=await import('./store.js');return {n:(await s.allWines()).length,bible:!!(await s.getMeta('bible'))}});
  T('1re installation : cave vide, bible téléchargée et gardée en local',st.n===0&&st.bible,JSON.stringify(st));
  T('1re installation : pas de fenêtre « Mise à jour » (rien à raconter à un nouvel utilisateur)',!(await H.shown(page,'#sDlg'))||!/Mise à jour/.test(await H.txt(page,'#dlgT')),await H.txt(page,'#dlgT'));
  await page.evaluate(async w=>{const s=await import('./store.js');await s.putWines([w])},W('nouveau',{name:'Morgon neuf',year:2024,region:'Morgon',color:'Rouge'}));
  await page.reload();await H.sl(2500);
  const c=await carte(page,'Morgon neuf');
  T('1re installation : un vin ajouté a sa pastille de maturité et son liseré',!!c&&/Prêt à boire|À garder|À boire vite|Passé/.test(c.pill)&&/ph-/.test(c.cls),JSON.stringify(c));
  await page.evaluate(()=>{document.querySelector('#list .w details').open=true});await H.sl(200);
  const f=await page.evaluate(()=>({svg:!!document.querySelector('#list .w .mat2 svg'),fiab:(document.querySelector('#list .w .fiab')||{}).textContent||''}));
  T('1re installation : frise et fiabilité affichées, jamais « absent de la bible » pour Morgon',f.svg&&/Fiabilité/.test(f.fiab)&&!/absent/.test(f.fiab),JSON.stringify(f));
  const ch=await chev(page);
  T('chevron : présent sur « Fiche et accords » et tourné vers le bas quand la fiche est dépliée',!!ch&&ch.content!=='none'&&ch.tr!=='none',JSON.stringify(ch));
  await page.evaluate(()=>{document.querySelector('#list .w details').open=false});await H.sl(400);
  const ch2=await chev(page);
  T('chevron : change quand on replie',!!ch2&&ch2.tr!==ch.tr,JSON.stringify([ch,ch2]));
  T('1re installation : aucune erreur',r.errs.length===0,r.errs.join(' | '));
  await page.close();
}
// ---------- (B) Mise à jour depuis la version précédente ----------
{
  const r=await H.newPage(b,{ai:async()=>({json:{}})});const page=r.page;
  await page.goto(H.URL0);await H.sl(1500);
  // utilisateur qui avait la version précédente : cave existante, bible locale à jour
  const old=JSON.parse(bibleTxt); // la bible locale est déjà celle du site : rien n'est retéléchargé après la mise à jour
  await page.evaluate(async(oldTxt,ws)=>{const s=await import('./store.js');await s.replaceAll(ws);await s.setMeta('bible',oldTxt);await s.setMeta('bibleAt',Date.now());await s.setMeta('bibleV','1.33.1');await s.setMeta('seenVersion','1.33.1');await s.setMeta('lastBackup',Date.now())},JSON.stringify(old),[
    W('chass',{name:'Chassagne-Montrachet 2018',dom:'Domaine Jouard',year:2018,region:'Chassagne-Montrachet',grape:'Pinot Noir',from:2022,to:2029,src:{from:'bible',to:'bible'},qty:5}),
    W('morg',{name:'Morgon 2023',dom:'M. & C. Lapierre',year:2023,region:'Morgon',from:2027,to:2040,src:{from:'bible',to:'bible'}}),
    W('user',{name:'Garde à moi',year:Y-4,from:Y+1,to:Y+10,src:{from:'user',to:'user'}}),
    W('vide',{name:'Sancerre vide',dom:'D',year:Y-2,color:'Blanc',region:'Sancerre'}),
  ]);
  await page.reload();await H.sl(3500);
  T('mise à jour : la fenêtre des nouveautés s’affiche (et bloque la suite, comme chez l’utilisateur)',(await H.shown(page,'#sDlg'))&&/Mise à jour/.test(await H.txt(page,'#dlgT')),await H.txt(page,'#dlgT'));
  // la fenêtre est encore ouverte : la liste derrière doit déjà être juste
  const ch=await carte(page,'Chassagne-Montrachet 2018');
  T('mise à jour, fenêtre ouverte : Chassagne gardé « Prêt à boire · jusqu’en 2029 », liseré présent',!!ch&&/jusqu’en 2029/.test(ch.pill)&&/ph-/.test(ch.cls),JSON.stringify(ch));
  await page.evaluate(()=>{for(const w of document.querySelectorAll('#list .w'))w.querySelector('details').open=true});await H.sl(300);
  const fb0=await page.evaluate(()=>Object.fromEntries([...document.querySelectorAll('#list .w')].map(w=>[w.querySelector('h4').textContent,(w.querySelector('.fiab')||{}).textContent||''])));
  const fb=new Proxy(fb0,{get:(o,k)=>typeof k==='string'&&!(k in o)?(Object.entries(o).find(([n])=>n.startsWith(k))||[,undefined])[1]:o[k]});
  T('mise à jour, fenêtre ouverte : fiabilité « moyenne » (Chassagne, Morgon), « saisie par vous » pour la garde saisie',/moyenne/.test(fb['Chassagne-Montrachet 2018'])&&/moyenne/.test(fb['Morgon 2023'])&&Object.entries(fb0).filter(([k])=>/^Garde à moi/.test(k)).every(([,v])=>/saisie par vous/.test(v)),JSON.stringify(fb0));
  T('mise à jour : jamais « absent de la bible » pour un vin dont la garde vient de la bible',!/absent/.test(fb['Chassagne-Montrachet 2018']+fb['Morgon 2023']),JSON.stringify(fb0));
  const ap=(await carte(page,'Morgon 2023')).t;
  T('mise à jour : apogée de Morgon 2023 calculée avec la bible (note du millésime neutre : +8 ans)',/Apogée estimée/.test(ap)&&/\+8 ans/.test(ap),ap.slice(0,200));
  // fermer la fenêtre : la bible plus récente est reprise, rien ne se casse
  await page.evaluate(()=>{const b=[...document.querySelectorAll('#sDlg button')][0];b&&b.click()});await H.sl(2500);
  const apres=await page.evaluate(async()=>{const s=await import('./store.js');const a=await s.allWines();const m=await s.getMeta('bible');return {n:a.length,date:JSON.parse(m).date,sancerre:a.find(w=>w.id==='vide')}});
  T('mise à jour : toutes les fiches conservées, bible locale intacte',apres.n===4&&!!apres.date,JSON.stringify([apres.n,apres.date]));
  T('mise à jour : le Sancerre sans cépage ni accords est complété par les repères (origine bible), sans IA',!!apres.sancerre&&/Sauvignon/.test(apres.sancerre.grape)&&apres.sancerre.src.grape==='bible',JSON.stringify(apres.sancerre&&[apres.sancerre.grape,apres.sancerre.src]));
  const us=await page.evaluate(async()=>{const s=await import('./store.js');return (await s.allWines()).find(w=>w.id==='user')});
  T('mise à jour : la garde saisie n’est jamais modifiée',us.from===Y+1&&us.to===Y+10&&us.src.from==='user',JSON.stringify([us.from,us.to,us.src]));
  T('mise à jour : aucune erreur',r.errs.length===0,r.errs.join(' | '));
  await page.close();
}
// ---------- (C) Bible locale ancienne avec la MÊME date que celle du site (cas réel : Rully 1er cru « absent de la bible ») ----------
{
  const r=await H.newPage(b,{ai:async()=>({json:{}})});const page=r.page;
  await page.goto(H.URL0);await H.sl(1500);
  const vieille=JSON.parse(bibleTxt);vieille.rows=vieille.rows.filter(x=>!/^Rully/.test(x.a)); // même date, contenu plus ancien
  await page.evaluate(async(txt,ws)=>{const s=await import('./store.js');await s.replaceAll(ws);await s.setMeta('bible',txt);await s.setMeta('bibleAt',0);await s.setMeta('bibleV','1.0.0')},JSON.stringify(vieille),[
    W('rully',{name:'Rully 1er Cru',dom:'Leflaive & Associés',year:2017,color:'Blanc',region:'Rully 1er Cru',qty:2}),
  ]);
  await page.reload();await H.sl(3500);
  await page.evaluate(()=>{const d=document.querySelector('#sDlg button');d&&d.click()});await H.sl(1500);
  const rows=await page.evaluate(async()=>{const s=await import('./store.js');return JSON.parse(await s.getMeta('bible')).rows.filter(x=>/^Rully/.test(x.a)).length});
  T('bible locale de même date mais de contenu plus ancien : remplacée par celle du site (Rully présent)',rows===4,String(rows));
  await page.evaluate(()=>{const d=document.querySelector('#list .w details');if(d)d.open=true});await H.sl(300);
  const f=await page.evaluate(()=>(document.querySelector('#list .w .fiab')||{}).textContent||'');
  T('Rully 1er cru : plus de « absent de la bible »',!/absent/.test(f),f);
  await page.close();
}
// ---------- (C) Bible locale ancienne avec la MÊME date que celle du site (cas réel : Rully 1er cru « absent de la bible ») ----------
{
  const r=await H.newPage(b,{ai:async()=>({json:{}})});const page=r.page;
  await page.goto(H.URL0);await H.sl(1500);
  const vieille=JSON.parse(bibleTxt);vieille.rows=vieille.rows.filter(x=>!/^Rully/.test(x.a)); // même date, contenu plus ancien
  await page.evaluate(async(txt,ws)=>{const s=await import('./store.js');await s.replaceAll(ws);await s.setMeta('bible',txt);await s.setMeta('bibleAt',0);await s.setMeta('bibleV','1.0.0')},JSON.stringify(vieille),[
    W('rully',{name:'Rully 1er Cru',dom:'Leflaive & Associés',year:2017,color:'Blanc',region:'Rully 1er Cru',qty:2}),
  ]);
  await page.reload();await H.sl(3500);
  await page.evaluate(()=>{const d=document.querySelector('#sDlg button');d&&d.click()});await H.sl(1500);
  const rows=await page.evaluate(async()=>{const s=await import('./store.js');return JSON.parse(await s.getMeta('bible')).rows.filter(x=>/^Rully/.test(x.a)).length});
  T('bible locale de même date mais de contenu plus ancien : remplacée par celle du site (Rully présent)',rows===4,String(rows));
  await page.evaluate(()=>{const d=document.querySelector('#list .w details');if(d)d.open=true});await H.sl(300);
  const f=await page.evaluate(()=>(document.querySelector('#list .w .fiab')||{}).textContent||'');
  T('Rully 1er cru : plus de « absent de la bible »',!/absent/.test(f),f);
  await page.close();
}
S.out.forEach(l=>console.log(l));
await b.close();srv.close&&srv.close();process.exit(0);
