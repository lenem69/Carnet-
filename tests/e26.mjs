// Question « Appréciez-vous l'application ? » : une fois (2e ouverture d'un nouvel utilisateur, tout de suite pour une appli déjà installée),
// réponse obligatoire (ni croix, ni toucher à côté, ni Retour), envoi anonyme annoncé par un vrai formulaire, nouvel essai hors connexion.
import fs from 'fs';import path from 'path';
import {start} from './server.mjs';import * as H from './h.mjs';
H.deploy();
const ap=path.join(path.dirname(new URL(import.meta.url).pathname),'.site','www','cave','app.js');
let src=fs.readFileSync(ap,'utf8');
src=src.replace(/const STATS_POST = '[^']*';/,"const STATS_POST = 'https://docs.google.com/forms/d/e/TESTFORM/formResponse';").replace(/const STATS_ENTRY = '[^']*';/,"const STATS_ENTRY = 'entry.42';");
fs.writeFileSync(ap,src);
const srv=await start(8123);const b=await H.browser();
const {T,out}=H.suite('Question de satisfaction');
const r=await H.newPage(b);const page=r.page;const errs=r.errs;
// Les envois vers le formulaire sont interceptés (aucun appel réel) : on note chaque envoi reçu.
const posts=[];
await page.setRequestInterception(true);
page.on('request',q=>{
  if(/forms\/d\/e\/TESTFORM\/formResponse/.test(q.url())){posts.push({m:q.method(),body:decodeURIComponent((q.postData()||'').replace(/\+/g,' '))});return q.respond({status:200,contentType:'text/html',body:'<p>ok</p>'})}
  q.continue()});
await page.evaluateOnNewDocument(()=>{window.__AVIS=true});
const meta=k=>page.evaluate(async k=>{const s=await import('./store.js');return s.getMeta(k)},k);
const setmeta=(k,v)=>page.evaluate(async(k,v)=>{const s=await import('./store.js');await s.setMeta(k,v)},k,v);
const dlg=()=>page.evaluate(()=>({show:document.querySelector('#sDlg').classList.contains('show'),t:document.querySelector('#dlgT').textContent,x:document.querySelector('#dlgX').textContent,force:document.querySelector('#sDlg').classList.contains('force'),xVisible:getComputedStyle(document.querySelector('#sDlg .sx')).display!=='none'}));

// 1. nouvel utilisateur : 1re ouverture = question des statistiques, pas de question de satisfaction
await page.goto(H.URL0);await H.sl(1500);
T('première ouverture : la question des statistiques passe d’abord',(await dlg()).show&&/Aider/.test((await dlg()).t));
await H.tapText(page,'#dlgB button','Non merci');await H.sl(1200);
T('1re ouverture : pas de question de satisfaction',!(await dlg()).show&&(await meta('ouverturesAvis'))===1);
// 2. 2e ouverture : la question apparaît
await page.reload();await H.sl(1800);
const d=await dlg();
T('la question « Appréciez-vous l’application ? » s’affiche à la 2e ouverture',d.show&&d.t==='Appréciez-vous l’application ?',JSON.stringify(d));
T('elle dit honnêtement que la réponse est envoyée, anonymement',/envoyée anonymement/.test(d.x)&&/rien d’autre/.test(d.x),d.x);
T('deux boutons : Oui et Non',await page.evaluate(()=>[...document.querySelectorAll('#dlgB button')].map(x=>x.textContent).join('|'))==='Oui|Non');
T('réponse obligatoire : pas de croix visible',d.force&&!d.xVisible,JSON.stringify(d));
// 3. impossible de la fermer sans répondre
await page.evaluate(()=>document.querySelector('#sDlg .sx').click());await H.sl(300);
T('croix : la fenêtre reste ouverte',(await dlg()).show);
await page.evaluate(()=>document.querySelector('#sDlg').click());await H.sl(300);
T('toucher à côté : la fenêtre reste ouverte',(await dlg()).show);
await page.evaluate(()=>history.back());await H.sl(500);
T('bouton Retour : la fenêtre reste ouverte',(await dlg()).show);
await page.evaluate(()=>history.back());await H.sl(500);
T('Retour répété : toujours ouverte',(await dlg()).show);
T('rien n’est envoyé avant la réponse',posts.length===0);
// 4. réponse : Oui
await H.tapText(page,'#dlgB button','Oui');await H.sl(1500);
T('« Oui » : fenêtre fermée',!(await dlg()).show);
T('« Oui » : un seul envoi, par formulaire POST, anonyme (sat|oui|version|semaine d’installation)',posts.length===1&&posts[0].m==='POST'&&/^entry\.42=sat\|oui\|1\.34\.2\|\d{4}-\d\d-\d\d$/.test(posts[0].body),JSON.stringify(posts));
T('envoi sans identifiant d’appareil',posts.length===1&&!/[0-9a-f]{10}/.test(posts[0].body.replace(/\d{4}-\d\d-\d\d/,'').replace('1.34.2','')),JSON.stringify(posts));
let m=await meta('satisfaction');
T('réponse mémorisée, marquée envoyée par formulaire',m&&m.rep==='oui'&&m.sent===true&&m.via==='form',JSON.stringify(m));
T('aucun cadre ni formulaire laissé dans la page',await page.evaluate(()=>new Promise(r=>setTimeout(()=>r(!document.querySelector('iframe[name^="cave-envoi"]')&&!document.querySelector('form[target^="cave-envoi"]')),900))));
// 5. une seule fois
posts.length=0;
await page.reload();await H.sl(1800);
T('une seule fois : plus de question à l’ouverture suivante, rien de renvoyé',!(await dlg()).show&&posts.length===0);
// 6. utilisateur qui avait déjà l'appli : question dès la mise à jour
await setmeta('satisfaction',null);await setmeta('ouverturesAvis',null);await setmeta('installAt',Date.now()-5*864e5);
await page.reload();await H.sl(1800);
T('appli déjà installée : la question apparaît dès cette mise à jour',(await dlg()).show&&(await meta('ouverturesAvis'))===2);
// 7. hors connexion : réponse gardée, puis envoyée à l'ouverture suivante, une seule fois
posts.length=0;
await page.setOfflineMode(true);
await H.tapText(page,'#dlgB button','Non');await H.sl(1000);
m=await meta('satisfaction');
T('hors connexion : réponse gardée, pas envoyée',m&&m.rep==='non'&&m.sent===false&&posts.length===0,JSON.stringify(m));
await page.setOfflineMode(false);
await page.reload();await H.sl(2200);
m=await meta('satisfaction');
T('connexion revenue : envoyée une fois, sans reposer la question',!(await dlg()).show&&posts.length===1&&/sat\|non\|1\.34\.2/.test(posts[0].body)&&m.sent===true&&m.via==='form',JSON.stringify([posts,m]));
posts.length=0;await page.reload();await H.sl(1500);
T('puis plus rien à renvoyer',posts.length===0);
// 8. réponse donnée avec la 1.32.0 (envoi non confirmé) : renvoyée une fois par la nouvelle méthode
await setmeta('satisfaction',{rep:'oui',date:Date.now()-36e5,sent:true});
posts.length=0;await page.reload();await H.sl(2200);
m=await meta('satisfaction');
T('ancienne réponse « envoyée » sans confirmation : renvoyée une fois par formulaire',posts.length===1&&/sat\|oui\|1\.34\.2/.test(posts[0].body)&&m.via==='form',JSON.stringify([posts,m]));
// 9. valeur invalide refusée
const bad=await page.evaluate(async()=>{const S=await import('./stats.js');return S.avisRepondre('peut-être')});
T('réponse autre que oui/non refusée',bad===false);
T('aucune erreur JavaScript',errs.length===0,errs.join('|'));
await page.close();
console.log(out.join('\n'));await b.close();srv.close();
