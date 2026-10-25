// Question « Appréciez-vous l'application ? » : une fois, réponse obligatoire (ni croix, ni toucher à côté, ni Retour), envoi anonyme annoncé, nouvel essai hors connexion.
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
await page.evaluateOnNewDocument(()=>{window.__AVIS=true;window.__posts=[];window.__fail=false;const of=window.fetch;
  window.fetch=async(i,init={})=>{const u=typeof i==='string'?i:i.url;
    if(/forms\/d\/e\/TESTFORM\/formResponse/.test(u)){if(window.__fail)throw new TypeError('offline');window.__posts.push({body:decodeURIComponent(String(init.body).replace(/\+/g,' ')),cred:init.credentials,mode:init.mode});return new Response('',{status:200})}
    return of(i,init)}});
const meta=k=>page.evaluate(async k=>{const s=await import('./store.js');return s.getMeta(k)},k);
const setmeta=(k,v)=>page.evaluate(async(k,v)=>{const s=await import('./store.js');await s.setMeta(k,v)},k,v);
const posts=()=>page.evaluate(()=>window.__posts);
const dlg=()=>page.evaluate(()=>({show:document.querySelector('#sDlg').classList.contains('show'),t:document.querySelector('#dlgT').textContent,x:document.querySelector('#dlgX').textContent,force:document.querySelector('#sDlg').classList.contains('force'),xVisible:getComputedStyle(document.querySelector('#sDlg .sx')).display!=='none'}));

// 1. nouvel utilisateur : 1re ouverture = question des statistiques, pas de question de satisfaction
await page.goto(H.URL0);await H.sl(1500);
T('première ouverture : la question des statistiques passe d’abord',(await dlg()).show&&/Aider/.test((await dlg()).t));
await H.tapText(page,'#dlgB button','Non merci');await H.sl(1200);
T('1re ouverture : pas de question de satisfaction',!(await dlg()).show&&(await meta('ouverturesAvis'))===1);
// 2. 2e ouverture : la question apparaît
await page.reload();await H.sl(1800);
const d=await dlg();
T('la question « Appréciez-vous l’application ? » s’affiche',d.show&&d.t==='Appréciez-vous l’application ?',JSON.stringify(d));
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
T('rien n’est envoyé avant la réponse',(await posts()).length===0);
// 4. réponse : Oui
await H.tapText(page,'#dlgB button','Oui');await H.sl(800);
const p=await posts();
T('« Oui » : fenêtre fermée',!(await dlg()).show);
T('« Oui » : une seule ligne envoyée, anonyme (sat|oui|version|semaine d’installation)',p.length===1&&/^entry\.42=sat\|oui\|1\.32\.0\|\d{4}-\d\d-\d\d$/.test(p[0].body),JSON.stringify(p));
T('envoi sans identifiant ni cookie',p.length===1&&p[0].cred==='omit'&&!/[0-9a-f]{10}/.test(p[0].body.replace(/\d{4}-\d\d-\d\d/,'')),JSON.stringify(p));
const m=await meta('satisfaction');
T('réponse mémorisée et marquée envoyée',m&&m.rep==='oui'&&m.sent===true,JSON.stringify(m));
// 5. une seule fois
await page.reload();await H.sl(1800);
T('une seule fois : plus de question à l’ouverture suivante',!(await dlg()).show&&(await posts()).length===0);
// 5 bis. utilisateur qui avait déjà l'appli (installée avant cette version) : question dès la mise à jour
await setmeta('satisfaction',null);await setmeta('ouverturesAvis',null);await setmeta('installAt',Date.now()-5*864e5);
await page.reload();await H.sl(1800);
T('appli déjà installée : la question apparaît dès cette mise à jour',(await dlg()).show&&(await meta('ouverturesAvis'))===2);
await H.tapText(page,'#dlgB button','Non');await H.sl(800);
await page.evaluate(()=>{window.__posts.length=0});
// 6. hors connexion : la réponse est gardée puis envoyée à l'ouverture suivante, une seule fois
await setmeta('satisfaction',null);
const off=await page.evaluate(async()=>{window.__fail=true;const S=await import('./stats.js');const ok=await S.avisRepondre('non');return ok});
const m2=await meta('satisfaction');
T('hors connexion : réponse gardée, pas encore envoyée',off===false&&m2&&m2.rep==='non'&&m2.sent===false,JSON.stringify(m2));
await page.reload();await H.sl(1800);
const p2=await posts();const m3=await meta('satisfaction');
T('connexion revenue : envoyée une fois, sans reposer la question',!(await dlg()).show&&p2.length===1&&/sat\|non\|1\.32\.0/.test(p2[0].body)&&m3.sent===true,JSON.stringify(p2));
await page.reload();await H.sl(1500);
T('puis plus rien à renvoyer',(await posts()).length===0);
// 7. valeur invalide refusée
const bad=await page.evaluate(async()=>{const S=await import('./stats.js');return S.avisRepondre('peut-être')});
T('réponse autre que oui/non refusée',bad===false);
T('aucune erreur JavaScript',errs.length===0,errs.join('|'));
await page.close();
console.log(out.join('\n'));await b.close();srv.close();
