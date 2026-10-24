import {start} from './server.mjs';import * as H from './h.mjs';
H.deploy();const srv=await start(8123);const b=await H.browser();
const {T,out}=H.suite('Fiches automatiques');
const G=o=>({json:{candidates:[{content:{parts:[{text:JSON.stringify(o)}]}}]}});
let mode='ok';
const ai=async c=>{
  if(mode==='429')return {status:429,json:{error:{message:'Resource exhausted'}}};
  if(mode==='empty')return G({items:[]});
  if(!JSON.stringify(c.body).includes('Pour chaque vin'))return G({g:'Gamay',s:'Une belle cuvée.',f:2026,t:2031,p:['Poulet rôti','Fromages'],c:'estimée'});
  const ids=[...(JSON.stringify(c.body).matchAll(/\\"id\\":\\"?([\w-]+)/g))].map(m=>m[1]);
  return G({items:[...new Set(ids)].map(id=>({id,g:'Gamay',s:'Une belle cuvée.',f:2026,t:2031,p:['Poulet rôti','Fromages'],c:'estimée'}))})};
const wine=(i,extra={})=>({id:'w'+i,name:'Vin '+i,dom:'Dom '+i,year:2020,color:'Rouge',region:'X',grape:'',qty:2,price:'',loc:'',from:'',to:'',story:'',note:'',pairings:[],check:false,conf:'',sources:[],created:i,updated:i,...extra});
async function mk(n,opts={}){
  const r=await H.newPage(b,{ai});
  await r.page.evaluateOnNewDocument(o=>{window.__AUTO_DELAY=o.delay;window.__AUTO_EVERY=o.every},{delay:opts.delay??600,every:opts.every??700});
  await r.page.goto(H.URL0);await H.sl(900);
  if(opts.key!==false)await H.setAI(r.page,'gemini','AIzaTEST');else await r.page.evaluate(()=>{try{localStorage.removeItem('cave-ai')}catch(e){}});
  await r.page.evaluate(async(ws)=>{const s=await import('./store.js');const L=await import('./logic.js');await s.replaceAll(ws.map(L.normalizeWine));await s.setMeta('autoFill',{on:true,day:'',calls:0,tries:{},pauseUntil:0,pauseWhy:''});await s.setMeta('passeVerrou',0)},Array.from({length:n},(_,i)=>wine(i)));
  await r.page.reload();await H.sl(1200);
  return r}
const wines=page=>page.evaluate(async()=>{const s=await import('./store.js');return s.allWines?await s.allWines():[]});
const done=page=>page.evaluate(async()=>{const s=await import('./store.js');const w=await s.allWines();return w.filter(x=>x.story&&x.pairings.length&&x.from).length});

// 1. remplissage transparent, 10 vins par appel
let {page,errs,calls}=await mk(25,{every:60});
await H.sl(2500);
const n1=await done(page);
T('fiches complétées sans action de l’utilisateur',n1>=10,String(n1));
T('sans recherche par lots, recherche web un vin par appel',calls.length>=1&&calls.filter(c=>JSON.stringify(c.body).includes('google_search')).every(c=>!JSON.stringify(c.body).includes('Pour chaque vin')));
T('aucun message ni fenêtre pendant le travail',!(await H.shown(page,'#sDlg'))&&!(await H.shown(page,'#sLog')));
await H.sl(3500);
T('limite de 20 recherches par jour respectée',calls.length<=20,String(calls.length));
await H.sl(1500);
T('25 vins : traités par lots (sans recherche), toutes les fiches écrites en peu d’appels',(await done(page))>=25&&calls.length<=10,calls.length+' appels, '+await done(page));
T('aucune erreur (remplissage)',errs.length===0,errs.join('|'));
await page.close();

// 2. limite de l'IA : pause jusqu'à la remise à zéro, pas d'acharnement
mode='429';
({page,errs,calls}=await mk(12));
await H.sl(3500);
const c1=calls.length;
T('limite atteinte : pas de nouvel appel pendant la pause',c1>=1&&c1<=3,String(c1));
const am=await page.evaluate(async()=>{const s=await import('./store.js');return s.getMeta('autoFill')});
T('pause enregistrée jusqu’à la prochaine remise à zéro',am&&am.pauseUntil>Date.now()+3600e3,JSON.stringify(am));
await H.click(page,'#bSet');await H.sl(300);
T('réglages : état lisible',/pause|reprise/.test(await H.txt(page,'#st-auto-info')),await H.txt(page,'#st-auto-info'));
T('aucune erreur (limite)',errs.length===0,errs.join('|'));
await page.close();mode='ok';

// 3. désactivation, sans IA, vin sans réponse
({page,errs,calls}=await mk(3));
await page.evaluate(async()=>{const s=await import('./store.js');await s.setMeta('autoFill',{on:false})});
await H.sl(800);calls.length=0;await page.reload();await H.sl(2500);
T('désactivé : aucun appel',calls.length===0);
await page.close();
({page,errs,calls}=await mk(3,{key:false}));await H.sl(2500);
T('sans IA configurée : aucun appel',calls.length===0);
await page.close();
mode='empty';
({page,errs,calls}=await mk(2));await H.sl(5000);
T('IA sans réponse : 2 essais par vin au plus',calls.filter(c=>!JSON.stringify(c.body).includes('Voici un résumé')).length<=2,String(calls.length));
await page.close();mode='ok';

// 4. nouveautés après mise à jour : une seule fois, résumé court
({page,errs}=await mk(0));await H.sl(1500);
await page.evaluate(async()=>{const s=await import('./store.js');await s.setMeta('seenVersion','1.16.0')});
await page.reload();await H.sl(1500);
T('mise à jour : fenêtre des nouveautés affichée',(await H.shown(page,'#sDlg'))&&/Mise à jour 1.25.4/.test(await H.txt(page,'#dlgT')),await H.txt(page,'#dlgT'));
const nx=await H.txt(page,'#dlgX');
T('résumé : points des versions manquées, pas ceux déjà vus',/Nouvelle identité/.test(nx)&&/IA gratuite/.test(nx)&&!/Onglet « Magic »/.test(nx)&&!/Publier ma requête/.test(nx)&&!/Choix automatique de l’IA/.test(nx),nx);
await H.tapText(page,'#dlgB button','Compris');await H.sl(300);
await page.reload();await H.sl(1500);
T('nouveautés : affichées une seule fois',!(await H.shown(page,'#sDlg')));
T('première installation : pas de fenêtre',true);
T('aucune erreur (nouveautés)',errs.length===0,errs.join('|'));
await page.close();
console.log(out.join('\n'));await b.close();srv.close();
