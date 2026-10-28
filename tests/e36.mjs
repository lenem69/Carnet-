// 1.40.0 : une seule génération par vin, mention « À relire, <prénom> », « J'ai relu », et recours « Pas satisfait ? Chercher sur le web » (une fois par vin).
import {start} from './server.mjs';import * as H from './h.mjs';
H.deploy();const srv=await start(8123);const b=await H.browser();
const S=H.suite('Relecture histoire');const T=S.T;
const G=o=>({json:{candidates:[{content:{parts:[{text:JSON.stringify(o)}]}}]}});
const ai=async c=>{
  if(!c.url.includes('googleapis'))return G({});
  const t=c.body.contents[0].parts[0].text;
  if(t.includes('omplète la fiche'))return G({grape:'Gamay',story:'Cuvée TESTHIST, histoire de l’assistant.',from:2025,to:2031,pairings:['Poulet rôti','Andouillette'],conf:'estimée'});
  return G({});
};
const wine=(id,o={})=>({id,name:'Vin '+id,dom:'Dom '+id,year:2018,qty:2,from:2020,to:2035,src:{},color:'Rouge',region:'Cahors',grape:'Malbec',price:20,created:1,updated:1,story:'',pairings:[],check:false,conf:'',sources:[],tastings:[],...o});

async function ouvre(vins,prenom='Jeff'){
  const r=await H.newPage(b,{ai});
  // Fenêtres ouvertes par l'appli : notées dans window.__opened ; window.__blocked simule un navigateur qui refuse l'ouverture.
  await r.page.evaluateOnNewDocument(()=>{window.__opened=[];window.__blocked=false;window.open=u=>{if(window.__blocked)return null;window.__opened.push(u);return {opener:1}}});
  await r.page.goto(H.URL0);await H.sl(900);
  await r.page.evaluate(async(vins,prenom)=>{localStorage.setItem('cave-gratuit','off');localStorage.setItem('cave-ai',JSON.stringify({provider:'gemini',key:'AIzaPERSO',model:'gemini-3.5-flash-lite'}));
    const s=await import('./store.js');const L=await import('./logic.js');await s.replaceAll(vins.map(L.normalizeWine));
    await s.setMeta('bienvenue',{prenom,date:1})},vins,prenom);
  await r.page.reload();await H.sl(1500);
  await r.page.evaluate(()=>document.querySelectorAll('.modal.show').forEach(m=>m.classList.remove('show')));
  return r}
const vis=(p,s)=>p.evaluate(s=>{const e=document.querySelector(s);return !!e&&!e.hidden&&e.getClientRects().length>0},s);
const val=(p,s)=>p.$eval(s,e=>e.value);
const wines=p=>p.evaluate(async()=>{const s=await import('./store.js');return s.allWines()});
async function nouveau(page,{name,dom='Jean Foillard',year='2024',region='Morgon'}){
  await H.click(page,'#fab');await H.tapText(page,'#sMenu button','Saisie manuelle');await H.sl(300);
  await page.type('#f-name',name);await page.type('#f-dom',dom);await page.type('#f-year',year);await page.type('#f-region',region)}

// 1. Parcours complet : génération, relecture, recherche web, enregistrement.
let {page,errs}=await ouvre([]);
await nouveau(page,{name:'Côte du Py'});
T('avant génération : bouton de génération visible, ni mention ni recours web',await vis(page,'#f-gen')&&!(await vis(page,'#f-rl'))&&!(await vis(page,'#f-web')));
await H.click(page,'#f-gen');await H.sl(700);
T('génération : histoire écrite par l’assistant dans le champ',(await val(page,'#f-story')).includes('TESTHIST'));
T('génération : une seule par vin, le bouton disparaît',!(await vis(page,'#f-gen')));
T('mention « À relire, Jeff » visible sous l’histoire',await vis(page,'#f-rl')&&(await H.txt(page,'#f-rl')).includes('À relire, Jeff'),await H.txt(page,'#f-rl'));
T('recours « Pas satisfait ? Chercher sur le web » visible, avec sa phrase d’explication',await vis(page,'#f-web')&&(await H.txt(page,'#f-web')).includes('Pas satisfait ? Chercher sur le web')&&await vis(page,'#f-web-n')&&(await H.txt(page,'#f-web-n')).includes('Une seule fois'),await H.txt(page,'#f-web'));
await H.click(page,'#f-web');await H.sl(400);
const dt=await H.txt(page,'#dlgT'),dx=await page.$eval('#dlgX',e=>e.textContent);
T('confirmation avant Google : titre, consigne complète et mention d’envoi à Google',(await H.shown(page,'#sDlg'))&&dt==='Ouvrir Google ?'&&dx.includes('Jean Foillard')&&dx.includes('Côte du Py')&&dx.includes('millésime 2024')&&dx.includes('appellation Morgon')&&dx.includes('envoyé à Google'),dt+' | '+dx);
await H.tapText(page,'#sDlg button','Annuler');await H.sl(300);
T('annuler : rien ouvert, le recours reste proposé',(await page.evaluate(()=>window.__opened.length))===0&&await vis(page,'#f-web'));
await H.click(page,'#f-web');await H.sl(300);await H.tapText(page,'#sDlg button','Ouvrir Google');await H.sl(400);
const op=await page.evaluate(()=>window.__opened);
T('Google ouvert une fois, en mode IA, avec la consigne de la fiche',op.length===1&&op[0].startsWith('https://www.google.com/search?udm=50&q=')&&decodeURIComponent(op[0].split('&q=')[1]).includes('le domaine Jean Foillard et sa cuvée Côte du Py, millésime 2024, appellation Morgon'),JSON.stringify(op));
T('recherche web utilisée : le recours disparaît (une seule fois), la mention reste',!(await vis(page,'#f-web'))&&!(await vis(page,'#f-web-n'))&&await vis(page,'#f-rl'));
await H.click(page,'#f-rl-ok');await H.sl(200);
T('« J’ai relu » : mention « ✓ Relue », bouton retiré',(await H.txt(page,'#f-rl')).includes('✓ Relue')&&!(await vis(page,'#f-rl-ok')),await H.txt(page,'#f-rl'));
await H.click(page,'#f-save');await H.sl(500);
let ws=await wines(page);let w=ws.find(x=>x.name==='Côte du Py');
T('enregistré : génération, relecture et recherche web notées, histoire d’origine assistant',!!w&&w.genFaite>0&&w.histRelue>0&&w.histWeb>0&&w.src.story==='ai',JSON.stringify(w&&[w.genFaite,w.histRelue,w.histWeb,w.src]));
// Réouverture en modification : plus rien à faire.
await page.evaluate(()=>document.querySelector('#list .w [data-a="e"]').click());await H.sl(400);
T('modification : plus de génération, de mention ni de recours web',!(await vis(page,'#f-gen'))&&!(await vis(page,'#f-rl'))&&!(await vis(page,'#f-web')));
await H.click(page,'#f-cancel');await H.sl(300);
T('aucune erreur de page (parcours complet)',errs.length===0,errs.join(' | '));
await page.close();

// 2. Fiche non relue : mention sur la carte, « J’ai relu » depuis la carte.
({page,errs}=await ouvre([wine('a',{story:'Histoire de l’assistant.',src:{story:'ai'},aiPass:5})]));
await page.evaluate(()=>{document.querySelector('#list .w details').open=true});await H.sl(200);
T('carte : « À relire, Jeff » sous l’histoire de l’assistant',(await H.txt(page,'#list .w .rlr')).includes('À relire, Jeff'),await H.txt(page,'#list .w .rlr'));
await page.evaluate(()=>document.querySelector('#list .w [data-a="relu"]').click());await H.sl(600);
ws=await wines(page);
T('carte : « J’ai relu » enregistré',ws[0].histRelue>0&&ws[0].story==='Histoire de l’assistant.');
T('carte : mention retirée, fiche toujours dépliée',!(await page.$('#list .w .rlr'))&&await page.evaluate(()=>document.querySelector('#list .w details').open));
T('carte : message de confirmation',(await H.txt(page,'#toasts')).includes('Histoire relue'),await H.txt(page,'#toasts'));
await page.evaluate(()=>document.querySelector('#list .w [data-a="e"]').click());await H.sl(400);
T('modification d’un vin déjà passé par l’assistant : pas de nouvelle génération',!(await vis(page,'#f-gen')));
await H.click(page,'#f-cancel');
T('aucune erreur de page (carte)',errs.length===0,errs.join(' | '));
await page.close();

// 3. Vin dont l’histoire de l’assistant n’est pas relue, recherche web déjà faite : mention seule.
({page,errs}=await ouvre([wine('b',{story:'Histoire B.',src:{story:'ai'},histWeb:9}),wine('c',{story:'Histoire C.',src:{story:'ai'}})]));
await page.evaluate(()=>{[...document.querySelectorAll('#list .w')].find(w=>w.textContent.includes('Vin b')).querySelector('[data-a="e"]').click()});await H.sl(400);
T('recherche web déjà faite : mention visible, recours absent',await vis(page,'#f-rl')&&!(await vis(page,'#f-web')));
await H.click(page,'#f-cancel');await H.sl(300);
await page.evaluate(()=>{[...document.querySelectorAll('#list .w')].find(w=>w.textContent.includes('Vin c')).querySelector('[data-a="e"]').click()});await H.sl(400);
T('histoire de l’assistant non relue : mention et recours visibles en modification',await vis(page,'#f-rl')&&await vis(page,'#f-web'));
// Retouche à la main : ce n’est plus l’histoire de l’assistant.
await page.type('#f-story',' Ajout à la main.');await H.sl(200);
T('histoire retouchée à la main : mention et recours disparaissent',!(await vis(page,'#f-rl'))&&!(await vis(page,'#f-web')));
await H.click(page,'#f-save');await H.sl(500);
ws=await wines(page);const wc=ws.find(x=>x.id==='c');
T('histoire retouchée : origine « utilisateur », plus « à relire »',wc.src.story==='user'&&!(await page.evaluate(async()=>(await import('./logic.js')).aRelire((await (await import('./store.js')).allWines()).find(x=>x.id==='c')))));
T('aucune erreur de page (autres cas)',errs.length===0,errs.join(' | '));
await page.close();

// 4. Navigateur qui refuse d’ouvrir la fenêtre : message, et le recours reste proposé (pas compté comme utilisé).
({page,errs}=await ouvre([]));
await nouveau(page,{name:'Cuvée bloquée'});
await H.click(page,'#f-gen');await H.sl(700);
await page.evaluate(()=>{window.__blocked=true});
await H.click(page,'#f-web');await H.sl(300);await H.tapText(page,'#sDlg button','Ouvrir Google');await H.sl(400);
T('fenêtre refusée par le navigateur : message clair',(await H.txt(page,'#toasts')).includes('bloqué l’ouverture de Google'),await H.txt(page,'#toasts'));
T('fenêtre refusée : le recours n’est pas compté comme utilisé',await vis(page,'#f-web'));
await H.click(page,'#f-cancel');await H.sl(300);
T('aucune erreur de page (fenêtre refusée)',errs.length===0,errs.join(' | '));
await page.close();

// 5. Sans prénom : mention simple « À relire ».
({page,errs}=await ouvre([],''));
await nouveau(page,{name:'Cuvée sans prénom'});
await H.click(page,'#f-gen');await H.sl(700);
T('sans prénom : « À relire » sans virgule ni nom',(await H.txt(page,'#f-rl')).trim().startsWith('À relire')&&!(await H.txt(page,'#f-rl')).includes(','),await H.txt(page,'#f-rl'));
await H.click(page,'#f-cancel');await H.sl(300);
T('aucune erreur de page (sans prénom)',errs.length===0,errs.join(' | '));
await page.close();

await b.close();srv.close?.();
console.log(S.out.join('\n'));
