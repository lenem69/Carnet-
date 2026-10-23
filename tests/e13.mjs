import {start} from './server.mjs';import * as H from './h.mjs';
H.deploy();const srv=await start(8123);const b=await H.browser();
const S=H.suite('Journal de dégustation');const T=S.T;
const r=await H.newPage(b);const page=r.page;
const errs=[];page.on('pageerror',e=>errs.push(e.message));
await page.goto(H.URL0);await H.sl(900);
await page.evaluate(async()=>{const s=await import('./store.js');
  await s.replaceAll([{id:'a',name:'Château A',dom:'A',year:2015,color:'Rouge',region:'Margaux',grape:'Merlot',qty:2,price:30,from:2020,to:2026,created:1,updated:1}]);});
await page.reload();await H.sl(1200);
const texte=()=>page.evaluate(()=>document.body.innerText);
// 1. ouvrir la fiche, puis noter une dégustation
await H.tapText(page,'summary','Fiche et accords');await H.sl(300);
T('journal : fiche affiche « Aucune dégustation notée »',(await texte()).includes('Aucune dégustation notée'));
await H.tapText(page,'.jr button','+ Noter une dégustation');await H.sl(400);
T('journal : fenêtre de saisie ouverte',await H.shown(page,'#sTasting'));
await H.tapText(page,'#tg-save','Enregistrer');await H.sl(300);
T('journal : pas d’enregistrement sans étoiles',(await texte()).includes('Choisissez une note'));
await page.click('#tg-stars [data-n="4"]');await page.type('#tg-c','Très belle bouteille');
await H.tapText(page,'#tg-save','Enregistrer');await H.sl(700);
let t=await texte();
T('journal : carte affiche « Dégusté 1 fois · moyenne 4/5 »',t.includes('Dégusté 1 fois · moyenne 4/5'));
await H.tapText(page,'summary','Fiche et accords');await H.sl(200);
T('journal : commentaire visible dans la fiche',(await texte()).includes('Très belle bouteille'));
// 2. deuxième dégustation : moyenne
await H.tapText(page,'summary','Fiche et accords');await H.sl(200);
await H.tapText(page,'.jr button','+ Noter une dégustation');await H.sl(400);
await page.click('#tg-stars [data-n="2"]');await H.tapText(page,'#tg-save','Enregistrer');await H.sl(700);
t=await texte();
T('journal : moyenne recalculée (4 et 2 étoiles = 3/5)',t.includes('Dégusté 2 fois · moyenne 3/5'));
// 3. persistance après rechargement
await page.reload();await H.sl(1200);
T('journal : dégustations conservées après rechargement',(await texte()).includes('Dégusté 2 fois · moyenne 3/5'));
// 4. suppression d'une dégustation
await H.tapText(page,'summary','Fiche et accords');await H.sl(200);
await H.tapText(page,'.jr li button','Supprimer');await H.sl(300);
await H.tapText(page,'#dlgB button','Supprimer');await H.sl(700);
T('journal : suppression retire une dégustation',(await texte()).includes('Dégusté 1 fois'));
T('aucune erreur JavaScript',errs.length===0,errs.join(' | '));
await page.close();
console.log(S.out.join('\n'));await b.close();srv.close();
