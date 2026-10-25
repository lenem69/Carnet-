import {start} from './server.mjs';import * as H from './h.mjs';
H.deploy();const srv=await start(8123);const b=await H.browser();
const {T,out}=H.suite('Bible des vins');
const r=await H.newPage(b);const page=r.page;
const errs=[];page.on('pageerror',e=>errs.push(e.message));
await page.goto(H.URL0);await H.sl(900);
await page.evaluate(async()=>{const s=await import('./store.js');
  await s.replaceAll([
    {id:'a',name:'Chablis Premier',dom:'Domaine A',year:2015,color:'Blanc',region:'Chablis',grape:'Chardonnay',qty:2,price:20,from:2018,to:2030,src:{from:'bible',to:'bible'},created:1,updated:1},
    {id:'b',name:'Vin manuel',dom:'Domaine B',year:2016,color:'Rouge',region:'Margaux',grape:'Merlot',qty:1,price:30,from:2020,to:2026,src:{from:'user',to:'user'},created:2,updated:2}]);});
await page.reload();await H.sl(1500);
const bib=await page.evaluate(async()=>{const s=await import('./store.js');return (await s.getMeta('bible'))||null;});
T('bible copiée sur le téléphone au premier démarrage',!!bib&&JSON.parse(bib).v===1,String(bib).slice(0,80));
const t=await page.$eval('#vCave',e=>e.innerHTML);
T('fiche remplie par la bible : mot « bible » en italique',t.includes('<i>bible</i>'),t.slice(0,300));
T('saisie manuelle : pas d’étiquette bible',(t.split('<i>bible</i>').length-1)===1,t.slice(0,300));
// Après une nouvelle version, l'ancienne copie de la bible est remplacée tout de suite (sans attendre 24 h) ; dans la même version, la limite d'une fois par jour reste.
const ancienne=JSON.stringify({v:1,date:'2000-01-01',rows:[{a:'Margaux',c:'R',y:{'2016':[3,2030,2040,'A']}}]});
await page.evaluate(async a=>{const s=await import('./store.js');await s.setMeta('bible',a);await s.setMeta('bibleAt',Date.now());await s.setMeta('bibleV','1.0.0');},ancienne);
await page.reload();await H.sl(1800);
const apres=await page.evaluate(async()=>{const s=await import('./store.js');return JSON.parse((await s.getMeta('bible'))||'null');});
T('nouvelle version : bible rechargée tout de suite malgré la limite de 24 h',!!apres&&apres.date!=='2000-01-01'&&apres.rows.length>100,String(apres&&apres.date));
const vue=await page.evaluate(async()=>{const s=await import('./store.js');return [await s.getMeta('bibleV')];});
const ver=await page.evaluate(()=>self.APP_VERSION);
T('la version de la bible reçue est mémorisée',vue[0]===ver,String(vue[0])+' / '+ver);
const ancienne2=JSON.stringify({v:1,date:'2000-01-02',rows:[{a:'Margaux',c:'R',y:{'2016':[3,2030,2040,'A']}}]});
await page.evaluate(async a=>{const s=await import('./store.js');await s.setMeta('bible',a);await s.setMeta('bibleAt',Date.now());await s.setMeta('bibleV',self.APP_VERSION);},ancienne2);
await page.reload();await H.sl(1800);
const meme=await page.evaluate(async()=>{const s=await import('./store.js');return JSON.parse((await s.getMeta('bible'))||'null');});
T('même version, moins de 24 h : pas de nouveau téléchargement',!!meme&&meme.date==='2000-01-02',String(meme&&meme.date));
// Cas réel (téléphone après mise à jour) : ancienne fenêtre 2028-2046 pour un Chassagne-Montrachet rouge 2018, ancienne bible, version précédente.
await page.evaluate(async a=>{const s=await import('./store.js');
  await s.replaceAll([{id:'c',name:'Chassagne-Montrachet 2018',dom:'Domaine Jouard',year:2018,color:'Rouge',region:'Chassagne-Montrachet',grape:'Pinot Noir',qty:5,price:40,from:2028,to:2046,src:{from:'bible',to:'bible'},created:3,updated:3}]);
  await s.setMeta('bible',a);await s.setMeta('bibleAt',Date.now());await s.setMeta('bibleV','1.29.2');},ancienne);
await page.reload();await H.sl(2200);
const att=await page.evaluate(async()=>{const j=await (await fetch('bible/bible.json')).json();const r=j.rows.find(x=>x.a==='Chassagne-Montrachet'&&x.c==='R');return r&&r.y['2018'];});
const carte=await page.$eval('#vCave',e=>e.textContent);
T('Chassagne-Montrachet rouge 2018 : la fenêtre de la nouvelle bible remplace 2028-2046',!!att&&carte.includes(att[1]+'–'+att[2])&&!carte.includes('2046'),JSON.stringify(att)+' '+carte.slice(0,220));
T('plus de « Ramenée dans la fenêtre de garde » sur cette fiche',!carte.includes('Ramenée dans la fenêtre'),carte.slice(0,400));
T('aucune erreur JavaScript',errs.length===0,errs.join('|'));
await page.close();
console.log(out.join('\n'));await b.close();srv.close();
