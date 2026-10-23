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
const t=await H.txt(page,'#vCave');
T('fiche remplie par la bible : étiquette « apogée d’après la bible »',t.includes('apogée d’après la bible'),t.slice(0,300));
T('saisie manuelle : pas d’étiquette bible',(t.split('apogée d’après la bible').length-1)===1,t.slice(0,300));
T('aucune erreur JavaScript',errs.length===0,errs.join('|'));
await page.close();
console.log(out.join('\n'));await b.close();srv.close();
