// Contrôle de la garde par l'IA (1.33.0) : étiquettes « confirmé » / « bible » en italique, passe de contrôle sur les vins déjà traités.
import {start} from './server.mjs';import * as H from './h.mjs';
H.deploy();const srv=await start(8123);const b=await H.browser();
const S=H.suite('Contrôle de la garde');const T=S.T;
const G=o=>({json:{candidates:[{content:{parts:[{text:JSON.stringify(o)}]}}]}});
const ai=async c=>{const t=((c.body&&c.body.contents&&c.body.contents[0].parts[0].text)||'');
  if(t.includes('Contrôle de la fenêtre de garde'))return G({items:[{id:'e',f:2021,t:2034},{id:'g',f:2026,t:2040},{id:'h',f:2020,t:2035}]});
  return G({items:[]})};
const r=await H.newPage(b,{ai});const page=r.page,calls=r.calls;
const errs=[];page.on('pageerror',e=>errs.push(e.message));
await page.evaluateOnNewDocument(()=>{window.__AUTO_DELAY=600;window.__AUTO_EVERY=700});
const W=(id,name,o={})=>({id,name,dom:'Domaine X',year:2016,color:'Rouge',region:'Région Inconnue',grape:'Syrah',qty:1,price:20,from:2020,to:2035,src:{from:'bible',to:'bible'},story:'Histoire.',pairings:['agneau'],conf:'estimée',sources:[],tastings:[],check:false,estim:{min:10,max:20,date:1},aiPass:5,aiSearch:5,aiDoute:[],created:1,updated:1,...o});
await page.goto(H.URL0);await H.sl(900);
// 1. Affichage des étiquettes (pas d'IA : aucune clé)
await page.evaluate(async ws=>{const s=await import('./store.js');await s.replaceAll(ws);await s.setMeta('bienvenue',{prenom:'Jeff',date:1});},[
  W('a','Vin Bible'),
  W('b','Vin Saisi',{src:{from:'user',to:'user'}}),
  W('c','Vin Confirme',{gv:{from:2020,to:2035,k:'c'}}),
  W('d','Vin Calcule',{src:{from:'calc',to:'calc'}}),
  W('x','Vin Confirme Puis Change',{to:2040,gv:{from:2020,to:2035,k:'c'}}),
]);
await page.reload();await H.sl(1500);
await page.evaluate(()=>document.querySelectorAll('.modal.show').forEach(m=>m.classList.remove('show')));
const cartes=await page.evaluate(()=>Object.fromEntries([...document.querySelectorAll('#list .w')].map(w=>[w.querySelector('h4').textContent.replace(/\s*\d{4}$/,''),w.querySelector('details')?w.querySelector('details').innerHTML:''])));
T('étiquette « bible » en italique sur une garde de la bible',(cartes['Vin Bible']||'').includes('<i>bible</i>')&&!(cartes['Vin Bible']||'').includes('confirmé'),(cartes['Vin Bible']||'').slice(0,200));
T('étiquette « confirmé » en italique sur une garde contrôlée par l’IA',(cartes['Vin Confirme']||'').includes('<i>confirmé</i>')&&!(cartes['Vin Confirme']||'').includes('<i>bible</i>'),(cartes['Vin Confirme']||'').slice(0,200));
T('garde saisie à la main : aucune étiquette',!/<i>(bible|confirmé)<\/i>/.test(cartes['Vin Saisi']||''),(cartes['Vin Saisi']||'').slice(0,200));
T('garde calculée selon le rang : libellé inchangé, sans « bible »',(cartes['Vin Calcule']||'').includes('garde calculée selon le rang du vin')&&!(cartes['Vin Calcule']||'').includes('<i>bible</i>'),(cartes['Vin Calcule']||'').slice(0,200));
T('garde changée depuis le contrôle : retour à « bible »',(cartes['Vin Confirme Puis Change']||'').includes('<i>bible</i>')&&!(cartes['Vin Confirme Puis Change']||'').includes('confirmé'),(cartes['Vin Confirme Puis Change']||'').slice(0,200));
T('aucun texte « vérifié par l’IA » ni « corrigé par l’IA » affiché',!/vérifié par l.IA|corrigé par l.IA/i.test(await page.evaluate(()=>document.body.textContent)));
T('sans clé : aucun appel d’IA',calls.length===0,String(calls.length));
// 2. Passe de contrôle (clé personnelle) sur des vins déjà traités
await page.evaluate(async ws=>{localStorage.setItem('cave-gratuit','off');localStorage.setItem('cave-ai',JSON.stringify({provider:'gemini',key:'AIzaPERSO',model:'gemini-3.5-flash-lite'}));
  const s=await import('./store.js');await s.replaceAll(ws);await s.setMeta('autoFill',null);},[
  W('e','Vin Accord'),                                   // IA d'accord à 1 an près → confirmé
  W('f','Vin Saisi',{src:{from:'user',to:'user'}}),      // saisi : jamais envoyé
  W('g','Vin Corrige',{to:2030}),                        // écart net → corrigé
  W('h','Vin Deja Confirme',{gv:{from:2020,to:2035,k:'c'}}), // déjà contrôlé : pas renvoyé
]);
const n0=calls.length;
await page.reload();await H.sl(4500);
const verif=calls.slice(n0).filter(c=>JSON.stringify(c.body).includes('Contrôle de la fenêtre de garde'));
T('contrôle de garde : un seul appel pour les vins à contrôler',verif.length===1,String(verif.length));
const corps=JSON.stringify(verif[0]&&verif[0].body);
T('l’appel contient les vins à contrôler avec leur fenêtre actuelle (a, b)',corps.includes('Vin Accord')&&corps.includes('Vin Corrige')&&/\\"a\\":2020/.test(corps),corps.slice(0,300));
T('l’appel ne contient ni la garde saisie ni le vin déjà contrôlé',!corps.includes('Vin Saisi')&&!corps.includes('Vin Deja Confirme'),corps.slice(0,300));
const w=await page.evaluate(async()=>{const s=await import('./store.js');return Object.fromEntries((await s.allWines()).map(x=>[x.id,x]))});
T('IA d’accord : garde inchangée (2020-2035), verdict « confirmée »',w.e.from===2020&&w.e.to===2035&&w.e.gv&&w.e.gv.k==='c',JSON.stringify([w.e.from,w.e.to,w.e.gv]));
T('écart net : garde corrigée (2026-2040), enregistrée',w.g.from===2026&&w.g.to===2040&&w.g.gv&&w.g.gv.k==='x'&&w.g.src.from==='ai',JSON.stringify([w.g.from,w.g.to,w.g.gv,w.g.src]));
T('garde saisie : intacte, sans verdict',w.f.from===2020&&w.f.to===2035&&!w.f.gv,JSON.stringify([w.f.from,w.f.to,w.f.gv]));
const ch=await page.evaluate(()=>Object.fromEntries([...document.querySelectorAll('#list .w')].map(x=>[x.querySelector('h4').textContent.replace(/\s*\d{4}$/,''),x.querySelector('details').innerHTML])));
T('affichage après contrôle : « confirmé » sur les deux vins contrôlés, rien sur la saisie',(ch['Vin Accord']||'').includes('<i>confirmé</i>')&&(ch['Vin Corrige']||'').includes('<i>confirmé</i>')&&!/<i>(bible|confirmé)<\/i>/.test(ch['Vin Saisi']||''),JSON.stringify(Object.values(ch).map(x=>x.slice(0,80))));
const n1=calls.length;await H.sl(2500);
T('pas de nouveau contrôle une fois la cave contrôlée',calls.length===n1,String(calls.length-n1));
T('aucune erreur JavaScript de page',errs.length===0&&r.errs.length===0,errs.concat(r.errs).join(' / '));
S.out.forEach(l=>console.log(l));
console.log(`\n${S.out.filter(l=>l.startsWith('PASS')).length} réussis, ${S.out.filter(l=>l.startsWith('FAIL')).length} échec(s)`);
await b.close();srv.close?.();process.exit(S.out.some(l=>l.startsWith('FAIL'))?1:0);
