// Clé gratuite partagée : réservée à la lecture d’étiquette ; passe par le proxy avec l’identifiant d’appareil, limite de 1 vin par jour, clé personnelle prioritaire, fenêtre de limite. Fiches, valeur et passe de fond demandent une clé personnelle.
import {start} from './server.mjs';import * as H from './h.mjs';
H.deploy();const srv=await start(8123);const b=await H.browser();
const S=H.suite('Clé gratuite');const T=S.T;
const PROXY='cave-ia.m-jeanfrancois-morin.workers.dev';
const G=o=>({json:{candidates:[{content:{parts:[{text:JSON.stringify(o)}]}}]}});
let mode='ok';
const OBJ={items:[],name:'Cuvée Test',dom:'Domaine Test',year:2019,color:'Rouge',region:'Cornas',grape:'Syrah',lecture:'haute'};
const RELAIS='cave-groq.m-jeanfrancois-morin.workers.dev';
const ai=async c=>{
  if(c.url.includes(RELAIS))return mode==='groq429'?{status:429,json:{error:{message:'rate'}}}:{json:{choices:[{message:{content:JSON.stringify(JSON.stringify(c.body).includes('Voici le résumé chiffré')?{court:'Cave équilibrée.',complet:'Détail.'}:OBJ)}}]}};
  if(c.url.includes('googleapis')&&mode==='g429')return {status:429,json:{error:{message:'quota'}}};
  return mode==='403'?{status:403,json:{error:'origine_refusee'}}:G(OBJ);};
const r=await H.newPage(b,{ai});const page=r.page;const calls=r.calls;
const errs=[];page.on('pageerror',e=>errs.push(e.message));
const lancer=async()=>{await H.click(page,'#fab');await H.sl(300);await H.tapText(page,'#sMenu button','Mettre à jour les fiches');await H.sl(500);const d=await page.evaluate(()=>(document.querySelector('#dlgT')?.textContent||'')+' '+(document.querySelector('#dlgX')?.textContent||'')+' || '+(document.querySelector('#toast,.toast')?.textContent||''));if(!d.includes('Limite du jour')&&!d.includes('Lancer')&&!(await page.evaluate(()=>[...document.querySelectorAll('#dlgB button')].some(b=>b.textContent.includes('Lancer')))))throw new Error('pas de confirmation : '+d);if(!d.includes('Limite du jour'))await page.evaluate(()=>[...document.querySelectorAll('#dlgB button')].find(b=>b.textContent.includes('Lancer')).click());await H.sl(2500);};
const aujourdhui=()=>new Date().toISOString().slice(0,10);
const fermer=()=>page.evaluate(()=>document.querySelectorAll('.modal.show').forEach(m=>m.classList.remove('show')));
const scan=async()=>{await H.click(page,'#fab');await H.pickFiles(page,()=>H.tapText(page,'#sMenu button','Scanner une étiquette'),['fixtures/lab.png']);await H.sl(2200);};
const texteEcran=()=>page.evaluate(()=>(document.querySelector('#sLog')?.innerText||'')+' || '+(document.querySelector('#toast,.toast')?.textContent||'')+' || '+(document.querySelector('#dlgT')?.textContent||'')+' '+(document.querySelector('#dlgX')?.textContent||''));

await page.goto(H.URL0);await H.sl(900);
await page.evaluate(async()=>{localStorage.setItem('cave-gratuit','on');localStorage.removeItem('cave-ai');
  const s=await import('./store.js');await s.replaceAll([{id:'a',name:'Vin A',year:2018,qty:2,from:2020,to:2035,src:{from:'user',to:'user'},dom:'D',color:'Rouge',region:'M',grape:'',price:20,created:1,updated:1,story:'',pairings:[],check:false,conf:'',sources:[],note:'',loc:'',tastings:[]}]);});
await page.reload();await H.sl(1500);
await page.evaluate(()=>document.querySelectorAll('.modal.show').forEach(m=>m.classList.remove('show')));
const appareil=await page.evaluate(async()=>{const s=await import('./store.js');return s.getMeta('appareil');});
T('identifiant d’appareil créé',typeof appareil==='string'&&appareil.length>=16,appareil);

await scan();
const c1=calls.find(c=>c.url.includes(PROXY));
T('sans clé personnelle : la lecture d’étiquette passe par le proxy',!!c1,calls.map(c=>c.url).join(' | '));
T('appel proxy : identifiant d’appareil et nombre de vins, sans clé Google',c1&&c1.headers['x-appareil']===appareil&&c1.headers['x-unites']==='1'&&!c1.headers['x-goog-api-key'],JSON.stringify(c1&&c1.headers));
const cpt=await page.evaluate(async()=>{const s=await import('./store.js');return s.getMeta('gratuit');});
T('compteur du jour : 1 vin compté',cpt&&cpt.vins===1&&cpt.jour===aujourdhui(),JSON.stringify(cpt));
const r0=await page.evaluate(async()=>(await import('./ai.js')).gratuitReste());
T('après un vin : plus d’IA gratuite aujourd’hui',r0===0,r0);
await fermer();

// L'appel gratuit Gemini est réservé au scan ; fiches, valeur et accords passent par le relais Groq (texte seul), sans toucher au compteur Gemini.
await page.evaluate(async()=>{const s=await import('./store.js');await s.setMeta('gratuit',{jour:new Date().toISOString().slice(0,10),vins:0});});
await page.reload();await H.sl(1500);await fermer();
const nP=calls.length;
await lancer();
const cr=calls.slice(nP).filter(c=>c.url.includes(RELAIS));
T('fiches sans clé personnelle : un appel au relais, avec l’identifiant d’appareil',cr.length>=1&&cr[0].headers['x-appareil']===appareil&&!!cr[0].headers['x-unites'],JSON.stringify(cr[0]&&cr[0].headers));
T('relais : texte seul (aucune image), aucune clé dans la requête',cr.length>=1&&!JSON.stringify(cr[0].body).includes('image_url')&&!cr[0].headers['x-goog-api-key']&&!cr[0].headers.authorization,JSON.stringify(cr[0]&&cr[0].headers));
T('fiches sans clé personnelle : aucun appel Gemini ni proxy',!calls.slice(nP).some(c=>c.url.includes(PROXY)||c.url.includes('googleapis')),calls.slice(nP).map(c=>c.url).join(' | '));
const cpt2=await page.evaluate(async()=>{const s=await import('./store.js');return [await s.getMeta('gratuit'),await s.getMeta('relais')];});
T('fiches sans clé personnelle : lecture gratuite Gemini non consommée, relais compté',cpt2[0]&&cpt2[0].vins===0&&cpt2[1]&&cpt2[1].vins>=1,JSON.stringify(cpt2));
await fermer();
const nP2=calls.length;
await H.sl(4500);
T('fiches automatiques sans clé personnelle : aucun appel au proxy ni au relais (hors avis de Magic)',!calls.slice(nP2).some(c=>c.url.includes(PROXY)||(c.url.includes(RELAIS)&&!JSON.stringify(c.body).includes('Voici le résumé chiffré'))),calls.slice(nP2).map(c=>c.url).join(' | '));

// Relais épuisé (10 vins) : fenêtre d'invitation à saisir sa clé, aucun appel.
await page.evaluate(async()=>{const s=await import('./store.js');await s.setMeta('relais',{jour:new Date().toISOString().slice(0,10),vins:10});});
await page.reload();await H.sl(1500);await fermer();
const nR=calls.length;
await page.evaluate(()=>{document.querySelector('#fab').click();});await H.sl(300);
await H.tapText(page,'#sMenu button','Mettre à jour les fiches');await H.sl(800);
const ecrR=await texteEcran();
T('relais épuisé : aucun appel et fenêtre « Limite du jour atteinte » avec le nombre de vins',calls.length===nR&&ecrR.includes('Limite du jour atteinte')&&/10 vins par jour/.test(ecrR),ecrR.slice(0,250));
await fermer();
await page.evaluate(async()=>{const s=await import('./store.js');await s.setMeta('relais',{jour:new Date().toISOString().slice(0,10),vins:0});});

// Le service gratuit refuse (403) : message clair, qui n'accuse pas une clé que l'utilisateur n'a pas.
mode='403';
await page.evaluate(async()=>{const s=await import('./store.js');await s.setMeta('gratuit',{jour:new Date().toISOString().slice(0,10),vins:0});
  await s.replaceAll([{id:'q',name:'Vin Q',year:2017,qty:1,from:2020,to:2035,src:{from:'user',to:'user'},dom:'D',color:'Rouge',region:'M',grape:'',price:20,created:1,updated:1,story:'',pairings:[],check:false,conf:'',sources:[],note:'',loc:'',tastings:[]}]);});
await page.reload();await H.sl(1500);
await fermer();
await scan();
const logT=await page.evaluate(()=>document.querySelector('#sLog')?.innerText||'');
T('service gratuit refusé : message clair, sans « Clé IA refusée »',/service gratuit est momentanément indisponible/.test(logT)&&!/Clé IA refusée/.test(logT),logT.slice(0,300));
T('service gratuit refusé : le motif du service est affiché',logT.includes('origine_refusee'),logT.slice(0,300));
mode='ok';

// Clé personnelle : elle passe avant la clé gratuite.
await page.evaluate(()=>localStorage.setItem('cave-ai',JSON.stringify({provider:'gemini',key:'AIzaPERSO',model:'gemini-3.5-flash-lite'})));
await page.reload();await H.sl(1500);
await page.evaluate(()=>document.querySelectorAll('.modal.show').forEach(m=>m.classList.remove('show')));
const n0=calls.length;
await page.evaluate(async()=>{const s=await import('./store.js');await s.replaceAll([{id:'b',name:'Vin B',year:2019,qty:1,from:2020,to:2035,src:{from:'user',to:'user'},dom:'D',color:'Rouge',region:'M',grape:'',price:20,created:1,updated:1,story:'',pairings:[],check:false,conf:'',sources:[],note:'',loc:'',tastings:[]}]);});
await page.reload();await H.sl(1500);
await page.evaluate(()=>document.querySelectorAll('.modal.show').forEach(m=>m.classList.remove('show')));
await lancer();
const c2=calls.slice(n0).find(c=>c.url.includes('googleapis'));
T('clé personnelle : appel direct, prioritaire',!!c2&&c2.headers['x-goog-api-key']==='AIzaPERSO',calls.slice(n0).map(c=>c.url).join(' | '));
T('clé personnelle : aucun appel au proxy',!calls.slice(n0).some(c=>c.url.includes(PROXY)));

// Limite atteinte sans clé personnelle : fenêtre explicative, pas d’appel.
await page.evaluate(async()=>{localStorage.removeItem('cave-ai');const s=await import('./store.js');await s.setMeta('gratuit',{jour:new Date().toISOString().slice(0,10),vins:5});});
await page.reload();await H.sl(1500);
await page.evaluate(()=>document.querySelectorAll('.modal.show').forEach(m=>m.classList.remove('show')));
const n1=calls.length;
await H.click(page,'#fab');await H.sl(300);await H.tapText(page,'#sMenu button','Scanner une étiquette');await H.sl(3000);
T('limite atteinte : aucun appel',calls.slice(n1).length===0,calls.slice(n1).length);
const titre=await page.evaluate(()=>(document.querySelector('#dlgT')?.textContent||'')+'');
T('limite atteinte : fenêtre « Limite du jour atteinte »',titre.includes('Limite du jour atteinte'),titre);

// L'avis de Magic : sans clé personnelle, le relais le prépare une seule fois par jour, sans toucher à la lecture gratuite Gemini.
await page.evaluate(async()=>{localStorage.removeItem('cave-ai');const s=await import('./store.js');await s.setMeta('gratuit',{jour:new Date().toISOString().slice(0,10),vins:0});await s.setMeta('relais',{jour:new Date().toISOString().slice(0,10),vins:0});await s.setMeta('avisRelais','');await s.setMeta('avis',null);
  await s.replaceAll([{id:'r',name:'Vin R',year:2016,qty:1,from:2020,to:2035,src:{from:'user',to:'user'},dom:'D',color:'Rouge',region:'M',grape:'x',price:20,created:1,updated:1,story:'x',pairings:['a'],check:false,conf:'',sources:[],note:'',loc:'',tastings:[],aiPass:1,estim:{min:1,max:2,date:1}}]);});
const avisN=()=>calls.filter(c=>JSON.stringify(c.body).includes('Voici le résumé chiffré'));
const na=avisN().length;
await page.reload();await H.sl(5000);
const nb=avisN().length;
T('avis de Magic sans clé personnelle : un appel au relais, jamais Gemini',nb-na===1&&avisN().slice(na).every(c=>c.url.includes(RELAIS)),avisN().slice(na).map(c=>c.url).join(' | '));
const cptG=await page.evaluate(async()=>(await import('./store.js')).getMeta('gratuit'));
T('avis de Magic : la lecture gratuite Gemini n’est pas consommée',cptG&&cptG.vins===0,JSON.stringify(cptG));
await page.reload();await H.sl(4000);
T('avis de Magic : pas de second appel le même jour',avisN().length===nb,avisN().length-nb);

// Clé Gemini personnelle épuisée : le relais prend le relais, sans rien afficher.
await page.evaluate(async()=>{localStorage.setItem('cave-ai',JSON.stringify({provider:'gemini',key:'AIzaPERSO',model:'gemini-3.5-flash-lite'}));const s=await import('./store.js');await s.setMeta('relais',{jour:new Date().toISOString().slice(0,10),vins:0});});
await page.reload();await H.sl(1500);await fermer();
mode='g429';
const nS=calls.length;
await page.evaluate(async()=>{const s=await import('./store.js');await s.replaceAll([{id:'z',name:'Vin Z',year:2019,qty:1,from:2020,to:2035,src:{from:'user',to:'user'},dom:'D',color:'Rouge',region:'M',grape:'',price:20,created:1,updated:1,story:'',pairings:[],check:false,conf:'',sources:[],note:'',loc:'',tastings:[]}]);});
await page.reload();await H.sl(1500);await fermer();
await lancer();
const cs=calls.slice(nS);
T('clé Gemini épuisée : Gemini essayé d’abord, puis le relais',cs.some(c=>c.url.includes('googleapis'))&&cs.some(c=>c.url.includes(RELAIS)),cs.map(c=>c.url).join(' | '));
mode='ok';

// Le relais lui-même est plein côté serveur (429) : invitation à saisir sa clé, pas de « clé refusée ».
await page.evaluate(async()=>{localStorage.removeItem('cave-ai');const s=await import('./store.js');await s.setMeta('relais',{jour:new Date().toISOString().slice(0,10),vins:0});});
await page.reload();await H.sl(1500);await fermer();
mode='groq429';
await lancer();
const ecr429=await texteEcran();
T('relais refusé (429) : message « IA offerte » sans « Clé IA refusée »',!/Clé IA refusée/.test(ecr429),ecr429.slice(0,250));
mode='ok';
await fermer();

// Désactivée : aucune clé gratuite, comportement d’avant.
await page.evaluate(()=>localStorage.setItem('cave-gratuit','off'));
await page.reload();await H.sl(1200);
T('aucune erreur de script',errs.length===0,errs.join(' / '));
S.out.forEach(l=>console.log(l));
console.log(`\n${S.out.filter(l=>l.startsWith('PASS')).length} réussis, ${S.out.filter(l=>l.startsWith('FAIL')).length} échec(s)`);
await b.close();srv.close?.();process.exit(S.out.some(l=>l.startsWith('FAIL'))?1:0);
