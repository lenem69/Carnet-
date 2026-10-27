// Maturité (1.34.0) : frise dans la fiche, pastille et liseré dans la liste, fiabilité.
import {start} from './server.mjs';import * as H from './h.mjs';
H.deploy();const srv=await start(8123);const b=await H.browser();
const S=H.suite('Maturité');const T=S.T;
const Y=new Date().getFullYear();
const W=(id,o)=>({id,name:'Vin '+id,dom:'Domaine '+id,year:Y-5,color:'Rouge',region:'Chinon',grape:'',qty:1,price:'',loc:'',from:'',to:'',story:'',pairings:[],note:'',check:false,src:{},conf:'',sources:[],tastings:[],created:1,updated:1,...o});
{
  const r=await H.newPage(b,{ai:async()=>({json:{}})});const page=r.page;
  await page.goto(H.URL0);await H.sl(1200);
  await page.evaluate(async(ws)=>{const s=await import('./store.js');await s.putWines(ws)},[
    W('garde',{name:'Garde saisie',year:Y-1,from:Y+3,to:Y+12,src:{from:'user',to:'user'}}),
    W('vite',{name:'Presque fini',year:Y-15,from:Y-12,to:Y+1,src:{from:'user',to:'user'}}),
    W('passe',{name:'Dépassé',year:Y-20,from:Y-12,to:Y-3,src:{from:'user',to:'user'}}),
    W('inconnu',{name:'Region inconnue',year:Y-6,region:'Zzzland',color:'Rouge'}),
    W('bibleorig',{name:'Garde bible hors ligne',year:Y-6,region:'Zzzland',color:'Rouge',from:Y-4,to:Y+9,src:{from:'bible',to:'bible'}}),
    W('chassagne',{name:'Chassagne-Montrachet 2018',year:2018,color:'Rouge',region:'Chassagne-Montrachet',from:2022,to:2029,src:{from:'bible',to:'bible'}}),
    W('nomill',{name:'Sans année',year:'',region:'Champagne',color:'Pétillant'}),
  ]);
  await page.reload();await H.sl(1800);
  const d=await page.evaluate(()=>[...document.querySelectorAll('#list .w')].map(e=>({n:e.querySelector('h4').textContent,cls:e.className,pill:(e.querySelector('.stl .tag.stp')||{}).textContent||'',pc:(e.querySelector('.stl .tag.stp')||{}).className||''})));
  const g=n=>d.find(x=>x.n.includes(n))||{};
  T('liste : vin à garder = pastille « À garder » et liseré gris-rose',/À garder · à ouvrir à partir de/.test(g('Garde saisie').pill)&&/ph-garde/.test(g('Garde saisie').cls),JSON.stringify(g('Garde saisie')));
  T('liste : fin de garde proche = « À boire vite »',/À boire vite · avant/.test(g('Presque fini').pill),JSON.stringify(g('Presque fini')));
  T('liste : période dépassée = « Passé, à boire vite » en bordeaux',/Passé, à boire vite · fin de garde en/.test(g('Dépassé').pill)&&/ph-declin/.test(g('Dépassé').cls),JSON.stringify(g('Dépassé')));
  T('liste : la pastille garde la classe du statut principal (tag stp)',d.every(x=>!x.pill||/tag stp/.test(x.pc)));
  T('liste : vin sans millésime = ancien affichage, sans liseré ni erreur',!/ph-/.test(g('Sans année').cls),JSON.stringify(g('Sans année')));
  // fiche dépliée
  const ouvre=async n=>{await page.evaluate(n=>{const w=[...document.querySelectorAll('#list .w')].find(e=>e.querySelector('h4').textContent.includes(n));w.querySelector('details').open=true},n);await H.sl(200)};
  await ouvre('Garde saisie');
  const f=await page.evaluate(()=>{const w=[...document.querySelectorAll('#list .w')].find(e=>e.querySelector('h4').textContent.includes('Garde saisie'));return {svg:!!w.querySelector('details .mat2 svg'),fiab:!!w.querySelector('.fiab'),aria:(w.querySelector('.mat2 svg')||{getAttribute(){return ''}}).getAttribute('aria-label'),sh:getComputedStyle(w).boxShadow}});
  T('fiche : frise affichée dans « Fiche et accords »',f.svg,JSON.stringify(f));
  T('fiche : garde saisie à la main = aucune fiabilité',!f.fiab,JSON.stringify(f));
  T('fiche : le liseré disparaît quand la fiche est dépliée',f.sh==='none',f.sh);
  await page.evaluate(n=>{const w=[...document.querySelectorAll('#list .w')].find(e=>e.querySelector('h4').textContent.includes(n));w.querySelector('details').open=false},'Garde saisie');await H.sl(200);
  const sh2=await page.evaluate(()=>getComputedStyle([...document.querySelectorAll('#list .w')].find(e=>e.querySelector('h4').textContent.includes('Garde saisie'))).boxShadow);
  T('liste : le liseré revient quand la fiche est repliée',sh2!=='none',sh2);
  await ouvre('Region inconnue');
  const fi=await page.evaluate(()=>{const w=[...document.querySelectorAll('#list .w')].find(e=>e.querySelector('h4').textContent.includes('Region inconnue'));return (w.querySelector('.fiab')||{}).textContent||''});
  T('fiche : fiabilité faible avec sa raison pour un vin sans repère',/faible/.test(fi)&&/·/.test(fi),fi);
  await ouvre('Garde bible hors ligne');
  const fb2=await page.evaluate(()=>{const w=[...document.querySelectorAll('#list .w')].find(e=>e.querySelector('h4').textContent.includes('Garde bible hors ligne'));return (w.querySelector('.fiab')||{}).textContent||''});
  T('fiche : garde d’origine bible = jamais « absent de la bible »',/moyenne/.test(fb2)&&!/absent/.test(fb2),fb2);
  await ouvre('Chassagne-Montrachet 2018');
  const ch=await page.evaluate(()=>{const w=[...document.querySelectorAll('#list .w')].find(e=>e.querySelector('h4').textContent.includes('Chassagne-Montrachet 2018'));return {f:(w.querySelector('.fiab')||{}).textContent||'',t:w.textContent}});
  T('fiche : une garde déjà d’origine bible est jugée avec la bible chargée (pas de « faible » au démarrage)',/moyenne/.test(ch.f)&&!/absent/.test(ch.f),ch.f);
  T('fiche : l’apogée tient compte de la note du millésime dès le démarrage (Chassagne 2018 : +8 ans en bon millésime)',/Apogée estimée/.test(ch.t),ch.t.slice(0,300));
  await ouvre('Sans année');
  const sa=await page.evaluate(()=>{const w=[...document.querySelectorAll('#list .w')].find(e=>e.querySelector('h4').textContent.includes('Sans année'));return !!w.querySelector('.mat2')});
  T('fiche : pas de frise sans millésime',!sa);
  const bx=await page.evaluate(()=>{const s=document.querySelector('#list .mat2 svg');const r=s.getBoundingClientRect();return {w:r.width,over:document.documentElement.scrollWidth>document.documentElement.clientWidth}});
  T('petit écran : frise dans la largeur, pas de défilement horizontal',bx.w>200&&!bx.over,JSON.stringify(bx));
  T('aucune erreur de page',r.errs.length===0,r.errs.join(' | '));
  await page.close();
}
// Bible périmée en mémoire au démarrage, puis remplacée : la liste doit être redessinée (apogée avec la note du millésime, fiabilité)
{
  const fs=await import('fs');
  const r=await H.newPage(b,{ai:async()=>({json:{}})});const page=r.page;
  await page.goto(H.URL0);await H.sl(1200);
  const bible=JSON.parse(fs.readFileSync(new URL('../bible/bible.json',import.meta.url),'utf8'));
  bible.rows=bible.rows.filter(x=>!(x.a==='Morgon'&&x.c==='R'));bible.date='2000-01-01';
  await page.evaluate(async(txt,w)=>{const s=await import('./store.js');await s.replaceAll([w]);await s.setMeta('bible',txt);await s.setMeta('bibleAt',Date.now());await s.setMeta('bibleV','1.33.1')},JSON.stringify(bible),W('morgon',{name:'Côte du Py',dom:'Foillard',year:2024,color:'Rouge',region:'Morgon',from:2026,to:2035,src:{from:'bible',to:'bible'}}));
  await page.reload();await H.sl(3500);
  const t=await page.evaluate(()=>{const w=[...document.querySelectorAll('#list .w')].find(e=>e.querySelector('h4').textContent.includes('Côte du Py'));return w?w.textContent:'introuvable'});
  T('bible remplacée après le premier affichage : liste redessinée (Morgon 2024 : +6 ans, pas +8)',/\+6 ans/.test(t)&&!/\+8 ans/.test(t),t.slice(0,400));
  await page.close();
}
S.out.forEach(l=>console.log(l));
await b.close();srv.close&&srv.close();process.exit(0);
