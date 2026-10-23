import {start} from './server.mjs';import * as H from './h.mjs';
H.deploy();const srv=await start(8123);const b=await H.browser();
const S=H.suite('Magic : statuts cliquables');const T=S.T;
const r=await H.newPage(b);const page=r.page;
const errs=[];page.on('pageerror',e=>errs.push(e.message));
await page.goto(H.URL0);await H.sl(900);
await page.evaluate(async()=>{const s=await import('./store.js');
  const base={src:{from:'user',to:'user'},dom:'D',color:'Rouge',region:'Margaux',grape:'Merlot',price:20,created:1,updated:1,story:'x',pairings:['a'],check:false,conf:'',sources:[],note:'',loc:'',tastings:[]};
  await s.replaceAll([
    {...base,id:'p',name:'Vin Prêt',year:2018,qty:1,from:2020,to:2035},
    {...base,id:'g',name:'Vin Garde',year:2024,qty:1,from:2030,to:2040},
    {...base,id:'u',name:'Vin Urgence',year:2010,qty:1,from:2012,to:2026},
  ]);});
await page.reload();await H.sl(1200);
const texte=()=>page.evaluate(()=>document.body.innerText);
await H.tapText(page,'.tab','Magic');await H.sl(400);
T('Magic : les trois cases sont des boutons',await page.evaluate(()=>document.querySelectorAll('#vChiffres button.st[data-goto]').length===3));
await page.click('#vChiffres [data-goto="urgence"]');await H.sl(500);
let t=await texte();
T('case Urgence : seule la liste « Urgence » est affichée',t.includes('Vin Urgence')&&!t.includes('Vin Prêt')&&!t.includes('Vin Garde'));
T('case Urgence : pastille « ✕ Urgence » en haut de la liste',t.includes('✕ Urgence'));
await page.click('#chips [data-stat]');await H.sl(400);
t=await texte();
T('pastille : toute la cave revient',t.includes('Vin Prêt')&&t.includes('Vin Garde')&&t.includes('Vin Urgence'));
await H.tapText(page,'.tab','Magic');await H.sl(300);
await page.click('#vChiffres [data-goto="pret"]');await H.sl(500);
t=await texte();
T('case Prêt à boire : seule la liste correspondante',t.includes('Vin Prêt')&&!t.includes('Vin Urgence')&&!t.includes('Vin Garde'));
T('aucune erreur JavaScript',errs.length===0,errs.join(' | '));
await page.close();
console.log(S.out.join('\n'));await b.close();srv.close();
