// Recherche web Gemini EN PAUSE (1.39.3) : comportement réel (sans l'interrupteur de test) + la voie « réactivée » reste intacte.
import {start} from './server.mjs';import * as H from './h.mjs';
H.deploy();const srv=await start(8123);const b=await H.browser();
const S=H.suite('Recherche web en pause');const T=S.T;
const G=o=>({json:{candidates:[{content:{parts:[{text:JSON.stringify(o)}]}}]}});
const ai=async c=>{
  if(!c.url.includes('googleapis'))return G({});
  const t=c.body.contents[0].parts[0].text;
  if(t.includes('Pour chaque vin')){const ids=JSON.parse(t.slice(t.indexOf('Vins : ')+7,t.indexOf('. Réponds'))).map(x=>x.id);return G({items:ids.map(id=>({id,g:'Gamay',s:'Histoire de lot.',f:2026,t:2031,p:['Poulet rôti','Fromages'],u:[],c:'estimée'}))})}
  if(t.includes('omplète la fiche'))return G({grape:'Gamay',story:'Cuvée TESTPAUSE.',from:2025,to:2031,pairings:['Poulet rôti','Andouillette'],conf:'estimée'});
  return G({});
};
const gem=calls=>calls.filter(c=>c.url.includes('googleapis'));
// Appels qui relèvent de la recherche web : outil google_search, ou consigne « Utilise la recherche web ».
const web=calls=>gem(calls).filter(c=>!!c.body.tools||JSON.stringify(c.body).includes('Utilise la recherche web'));
const wine=(id,o={})=>({id,name:'Vin '+id,dom:'Dom '+id,year:2018,qty:2,from:2020,to:2035,src:{},color:'Rouge',region:'Cahors',grape:'',price:20,created:1,updated:1,story:'',pairings:[],check:false,conf:'',sources:[],tastings:[],...o});
// Vin déjà passé par l'IA, avec valeur, mais cépage douteux : avant la 1.39.3, la passe automatique lui aurait fait une recherche web.
// Sans dates de garde, pour que le contrôle de garde (autre appel, sans recherche web) ne s'en mêle pas.
const douteux=()=>wine('d',{from:'',to:'',grape:'Malbec',story:'Histoire.',pairings:['agneau'],aiPass:5,aiSearch:0,aiDoute:['grape'],estim:{min:10,max:20,date:1}});

async function ouvre(opts,vins,rapide){
  const r=await H.newPage(b,{ai,...opts});
  if(rapide)await r.page.evaluateOnNewDocument(()=>{window.__AUTO_DELAY=500;window.__AUTO_EVERY=600});
  await r.page.goto(H.URL0);await H.sl(900);
  await r.page.evaluate(async vins=>{localStorage.setItem('cave-gratuit','off');localStorage.setItem('cave-ai',JSON.stringify({provider:'gemini',key:'AIzaPERSO',model:'gemini-3.5-flash-lite'}));
    const s=await import('./store.js');const L=await import('./logic.js');await s.replaceAll(vins.map(L.normalizeWine));
    await s.setMeta('bienvenue',{prenom:'Jeff',date:1});await s.setMeta('autoFill',{on:true,day:'',calls:0,tries:{},pauseUntil:0,pauseWhy:''});await s.setMeta('passeVerrou',0)},vins);
  await r.page.reload();await H.sl(1500);
  await r.page.evaluate(()=>document.querySelectorAll('.modal.show').forEach(m=>m.classList.remove('show')));
  return r}

// 1. Comportement réel : l'interrupteur est éteint.
let {page,errs,calls}=await ouvre({web:null},[douteux()],true);
T('interrupteur : recherche web en pause par défaut',(await page.evaluate(async()=>(await import('./ai.js')).RECHERCHE_WEB))===false);
await H.sl(3500);
T('passe automatique : aucune recherche web pour un vin qui en attendait une (les autres appels, comme le contrôle de garde, restent permis)',web(calls).length===0,JSON.stringify(web(calls).map(c=>!!c.body.tools)));
T('passe automatique : le vin n’a pas été modifié',(await page.evaluate(async()=>{const s=await import('./store.js');return (await s.allWines())[0].aiSearch}))===0);
await page.close();

// 2. Fiche demandée à la main : requête sans outil de recherche, message unique.
({page,errs,calls}=await ouvre({web:null},[wine('a')],false));
await page.evaluate(()=>document.querySelector('#list .w [data-a="menu"]').click());await H.sl(400);
await page.evaluate(()=>document.querySelector('#sAct [data-x="gen"]').click());await H.sl(1800);
const g=gem(calls);
T('fiche manuelle : un appel Gemini, sans outil de recherche web',g.length>=1&&g.every(c=>!c.body.tools&&!JSON.stringify(c.body).includes('google_search')),JSON.stringify(g.map(c=>c.body.tools)));
T('fiche manuelle : le prompt ne demande pas de consulter le web',g.every(c=>!JSON.stringify(c.body).includes('Utilise la recherche web')),'');
const msg=await H.txt(page,'#toasts');
T('fiche manuelle : message unique « Fiche mise à jour par l’assistant. »',msg.includes('Fiche mise à jour par l’assistant.'),msg);
T('fiche manuelle : aucun message sur la recherche web ni détail du service',!/recherche web|Détail du service|estimée, à vérifier/i.test(msg),msg);
T('fiche manuelle : la fiche est écrite et jamais « vérifiée »',(await page.evaluate(()=>document.querySelector('#list .w').textContent)).includes('TESTPAUSE')&&!(await page.evaluate(()=>document.querySelector('#list .w').textContent)).includes('fiche vérifiée'));
T('aucune erreur de page (pause)',errs.length===0,errs.join(' | '));
await page.close();

// 3. Voie réactivée (interrupteur de test allumé) : la recherche web fonctionne encore, prête pour une réactivation.
({page,errs,calls}=await ouvre({web:true},[douteux()],true));
await H.sl(3500);
const gr=gem(calls);
T('réactivée : la passe automatique refait une recherche web pour ce vin',gr.some(c=>!!c.body.tools&&JSON.stringify(c.body.tools).includes('google_search')),String(gr.length));
T('aucune erreur de page (réactivée)',errs.length===0,errs.join(' | '));
await page.close();

await b.close();srv.close?.();
console.log(S.out.join('\n'));
