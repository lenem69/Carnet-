// Fiche dépliée plus lisible (1.38.0) : blocs Repères / L'histoire / Accords / Journal, textes conservés, petit écran.
import {start} from './server.mjs';import * as H from './h.mjs';
H.deploy();const srv=await start(8123);const b=await H.browser();
const S=H.suite('Fiche lisible');const T=S.T;
const STORY='Le Laventureux est une cuvée de prestige du domaine Laventureux, situé au cœur de la région de Chablis. Le millésime 2024 bénéficie d\'une météo favorable, offrant une belle concentration aromatique et une minéralité typique du terroir calcaire. Ce vin blanc se distingue par sa fraîcheur, ses notes d\'agrumes, de pomme verte et une pointe de beurre, reflétant le style élégant et précis du domaine.';
const r=await H.newPage(b,{ai:async()=>({status:500,json:{}})});const page=r.page,errs=r.errs;
const W=o=>({id:'c',name:'Chablis',dom:'Laventureux',year:2024,qty:14,from:2027,to:2030,src:{from:'bible',to:'bible'},color:'Blanc',region:'Chablis',grape:'Chardonnay',price:20,created:1,updated:1,story:STORY,pairings:['Huîtres fraîches avec vinaigrette à l\'échalote','Coquilles Saint-Jacques poêlées','beurre blanc citronné'],check:false,conf:'estimée',sources:[],note:'',loc:'',tastings:[],...o});
const seed=async w=>{await page.evaluate(async w=>{localStorage.setItem('cave-gratuit','off');const s=await import('./store.js');await s.replaceAll(w)},w);await page.reload();await H.sl(1600);await page.evaluate(()=>{const d=document.querySelector('#list .w details');if(d)d.open=true})};
await page.goto(H.URL0);await H.sl(1000);
await seed([W()]);
const D=await page.evaluate(()=>{const w=document.querySelector('#list .w');const t=[...w.querySelectorAll('h5')].map(e=>e.textContent);
  const kv=[...w.querySelectorAll('.kv dt')].map(e=>e.textContent);const vals=[...w.querySelectorAll('.kv dd')].map(e=>e.innerText);
  return {t,kv,vals,hist:[...w.querySelectorAll('p.hist')].map(e=>e.textContent),lead:w.querySelectorAll('p.hist.lead').length,jr:!!w.querySelector('.jr'),pc:w.querySelectorAll('.pc').length,ov:document.documentElement.scrollWidth<=innerWidth}});
T('blocs titrés : Repères, L’histoire, Accords',D.t.join('|')==='Repères|L’histoire|Accords',D.t.join('|'));
T('Repères : Apogée et Service en deux lignes alignées',D.kv.join('|')==='Apogée|Service',D.kv.join('|'));
T('Apogée : année en tête, fenêtre, règle en petit',/^20\d\d/.test(D.vals[0])&&/Règle : Chablis, \+\d+ ans après le millésime/.test(D.vals[0]),D.vals[0]);
T('Service : « 11 à 12 °C » puis le conseil de carafage',/^\d+( à \d+)? °C/.test(D.vals[1])&&/carafer|carafe/i.test(D.vals[1]),D.vals[1]);
T('histoire : une accroche puis des paragraphes, aucune phrase perdue',D.lead===1&&D.hist.join(' ').replace(/\s+/g,' ')===STORY,D.hist.join(' / ').slice(0,300));
T('histoire : 3 phrases → accroche + un paragraphe de 2 phrases',D.hist.length===2,D.hist.length);
T('accords : 3 pastilles conservées',D.pc===3,D.pc);
T('journal : présent, sous son titre',D.jr);
T('aucun débordement horizontal à 390 px',D.ov);
// Fiche sans histoire ni accords : pas de bloc vide
await seed([W({story:'',pairings:[]})]);
const D2=await page.evaluate(()=>[...document.querySelectorAll('#list .w h5')].map(e=>e.textContent));
T('sans histoire : pas de bloc « L’histoire » vide',D2[0]==='Repères'&&!D2.includes('L’histoire'),D2.join('|'));
// Histoire d'une seule phrase / texte sans majuscule après le point
await seed([W({story:'Une seule phrase très courte.'})]);
const D3=await page.evaluate(()=>[...document.querySelectorAll('#list .w p.hist')].map(e=>e.textContent));
T('histoire d’une phrase : accroche seule',D3.length===1&&D3[0]==='Une seule phrase très courte.',D3.join('|'));
const XSS='Phrase <img src=x onerror=window.__x=1>. Autre phrase <b>gras</b>.';
await seed([W({story:XSS})]);
const D4=await page.evaluate(()=>({x:!!window.__x,img:document.querySelectorAll('#list .w p.hist img,#list .w p.hist b').length}));
T('contenu malveillant dans l’histoire : affiché en texte, jamais exécuté',!D4.x&&D4.img===0,JSON.stringify(D4));
// Petit écran 320 px
await seed([W()]);
await page.setViewport({width:320,height:700,isMobile:true,hasTouch:true,deviceScaleFactor:2});await H.sl(400);
T('320 px : aucun débordement',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
await (await page.$('#list .w')).screenshot({path:process.env.SHOT||'/tmp/fiche320.png'});
T('aucune erreur de page',errs.length===0,errs.join(' | '));
await b.close();srv.close();
console.log(S.out.join('\n'));
