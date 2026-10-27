// Vin hors de la bible (1.38.0) : encart sur la fiche, proposition de l'IA à valider, annulation, sans IA, réponse invalide.
import {start} from './server.mjs';import * as H from './h.mjs';
H.deploy();const srv=await start(8123);const b=await H.browser();
const S=H.suite('Hors bible');const T=S.T;
const G=o=>({json:{candidates:[{content:{parts:[{text:JSON.stringify(o)}]}}]}});
let rep={region:'Península de Setúbal (Portugal)',from:2026,to:2030};
let mode='ok';
const ai=async c=>{
  if(c.url.includes('googleapis')){
    if(mode==='limite')return {status:429,json:{error:{message:'quota'}}};
    if(mode==='invalide')return G({region:'x',from:1850,to:2900});
    return G(rep);}
  return G(rep);};
const r=await H.newPage(b,{ai});const page=r.page,errs=r.errs,calls=r.calls;
const W=(o)=>({id:'s',name:'BSE Branco Seco Especial',dom:'José Maria da Fonseca',year:2025,qty:2,from:2026,to:2029,src:{from:'user',to:'user'},color:'Blanc',region:'',grape:'',price:9,created:1,updated:1,story:'',pairings:[],check:false,conf:'',sources:[],note:'',loc:'',tastings:[],...o});
const FR={id:'f',name:'Cornas',dom:'Domaine X',year:2015,qty:1,from:2020,to:2035,src:{from:'bible',to:'bible'},color:'Rouge',region:'Cornas',grape:'Syrah',price:30,created:1,updated:1,story:'',pairings:[],check:false,conf:'',sources:[],note:'',loc:'',tastings:[]};
const reset=async(o={})=>{await page.evaluate(async(o)=>{
  localStorage.setItem('cave-gratuit','off');localStorage.removeItem('cave-ai-cool');
  if(o.key)localStorage.setItem('cave-ai',JSON.stringify({provider:'gemini',key:o.key}));else localStorage.removeItem('cave-ai');
  const s=await import('./store.js');await s.replaceAll(o.wines);
},o);await page.reload();await H.sl(1600);};
const ouvre=id=>page.evaluate(id=>{const d=document.querySelector(`[data-id="${id}"] details`);if(d)d.open=true;},id);
const hbBtn=id=>page.evaluate(id=>!!document.querySelector(`[data-id="${id}"] button[data-a="hb"]`),id);
const clickHb=id=>page.evaluate(id=>document.querySelector(`[data-id="${id}"] button[data-a="hb"]`).click(),id);
const dlg=()=>page.evaluate(()=>({t:document.querySelector('#dlgT').innerText,x:document.querySelector('#dlgX').innerText,b:[...document.querySelectorAll('#dlgB button')].map(e=>e.innerText)}));
const tapDlg=t=>H.tapText(page,'#dlgB button',t);
const wine=id=>page.evaluate(async id=>{const s=await import('./store.js');return (await s.allWines()).find(w=>w.id===id)},id);

await page.goto(H.URL0);await H.sl(1000);
await reset({key:'AIzaTEST_0123456789abcdefghij',wines:[W(),FR]});
await ouvre('s');await ouvre('f');
T('vin hors bible : encart « Vin hors de la bible » avec bouton « Chercher avec l’IA »',await hbBtn('s')&&(await page.evaluate(()=>document.querySelector('[data-id="s"] .enc.hb').innerText)).includes('La bible ne couvre que la France'));
T('vin français de la bible : aucun encart',!(await hbBtn('f')));
const hH=await page.evaluate(()=>document.querySelector('[data-id="s"] button[data-a="hb"]').getBoundingClientRect().height);
T('bouton de l’encart : au moins 44 px',hH>=44,hH);

// Proposition, refus
await clickHb('s');await H.sl(800);
let d=await dlg();
T('proposition : région, garde, dates actuelles et fiabilité faible',d.t==='Proposition de l’IA'&&d.x.includes('Península de Setúbal (Portugal)')&&d.x.includes('Garde : 2026–2030')&&d.x.includes('Vos dates actuelles : 2026–2029')&&d.x.includes('Fiabilité faible'),JSON.stringify(d));
T('proposition : deux boutons « Appliquer cette proposition » / « Garder mes dates »',d.b.join('|')==='Appliquer cette proposition|Garder mes dates',d.b.join('|'));
T('avec clé Gemini : la mention indique la recherche web',d.x.includes('avec recherche web (Gemini)'),JSON.stringify(d.x));
await tapDlg('Garder mes dates');await H.sl(300);
let w=await wine('s');
T('« Garder mes dates » : rien n’est changé',w.from===2026&&w.to===2029&&w.src.from==='user'&&!w.region);

// Accord, puis annulation
await ouvre('s');await clickHb('s');await H.sl(800);await tapDlg('Appliquer cette proposition');await H.sl(600);
w=await wine('s');
T('accord : garde 2026–2030 d’origine IA, région remplie, fiche « estimée »',w.from===2026&&w.to===2030&&w.src.from==='ai'&&w.src.to==='ai'&&w.region==='Península de Setúbal (Portugal)'&&w.conf==='estimée',JSON.stringify(w));
T('accord : message avec action « Annuler »',await page.evaluate(()=>/Garde proposée par l’IA : 2026–2030/.test(document.body.innerText)));
await H.tapText(page,'button','Annuler');await H.sl(600);
w=await wine('s');
T('annulation : dates et origine précédentes rétablies, région vide',w.from===2026&&w.to===2029&&w.src.from==='user'&&w.src.to==='user'&&!w.region,JSON.stringify(w));

// Région saisie jamais écrasée
await reset({key:'AIzaTEST_0123456789abcdefghij',wines:[W({region:'Setúbal'})]});
await ouvre('s');await clickHb('s');await H.sl(800);await tapDlg('Appliquer cette proposition');await H.sl(600);
w=await wine('s');
T('région déjà saisie : conservée',w.region==='Setúbal'&&w.to===2030,w.region);

// Via « Recalculer cette garde » (garde saisie par l'utilisateur)
await reset({key:'AIzaTEST_0123456789abcdefghij',wines:[W()]});
await ouvre('s');
await page.evaluate(()=>document.querySelector('[data-id="s"] button[data-a="recalc"]').click());await H.sl(400);
await H.tapText(page,'#dlgB button','Recalculer');await H.sl(900);
d=await dlg();
T('« Recalculer » sur un vin hors bible : plus d’impasse, proposition de l’IA',d.t==='Proposition de l’IA',JSON.stringify(d));
await tapDlg('Garder mes dates');await H.sl(300);

// Réponse invalide
mode='invalide';
await ouvre('s');await clickHb('s');await H.sl(1000);
w=await wine('s');
T('réponse invalide : rien n’est écrit et un message s’affiche',w.from===2026&&w.to===2029&&await page.evaluate(()=>document.body.innerText.includes('format illisible')));
mode='ok';

// Limite de la clé perso : message de Google, pas de « IA offerte »
mode='limite';
await ouvre('s');await clickHb('s');await H.sl(1500);
d=await dlg().catch(()=>({t:''}));
T('clé perso saturée : pas de message sur « l’IA offerte »',!(d.x||'').includes('IA offerte'),JSON.stringify(d));
mode='ok';

// Sans aucune IA
await reset({wines:[W()]});
await ouvre('s');await clickHb('s');await H.sl(1000);
d=await dlg();
T('sans IA : « Recherche impossible », dates conservées, bouton « Activer ma clé gratuite »',d.t==='Recherche impossible pour le moment'&&d.x.includes('Vos dates sont conservées')&&d.b.includes('Activer ma clé gratuite')&&d.b.includes('Garder mes dates'),JSON.stringify(d));
await tapDlg('Activer ma clé gratuite');await H.sl(400);
T('sans IA → « Activer ma clé gratuite » ouvre la feuille d’activation',await H.shown(page,'#sCle'));
w=await wine('s');
T('sans IA : dates intactes',w.from===2026&&w.to===2029&&w.src.from==='user');

T('aucune erreur de page ni fenêtre native',errs.length===0,errs.join(' | '));
await b.close();srv.close();
console.log(S.out.join('\n'));
