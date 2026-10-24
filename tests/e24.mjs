// Cave vide engageante + cave de démonstration (ajout, retrait sans toucher aux vins de l’utilisateur) ; scan d’étiquette rapide (réflexion réduite, repli, lecture en avance).
import {start} from './server.mjs';import * as H from './h.mjs';
H.deploy();const srv=await start(8123);const b=await H.browser();
const S=H.suite('Démo et scan rapide');const T=S.T;
const G=o=>({json:{candidates:[{content:{parts:[{text:JSON.stringify(o)}]}}]}});
// ---------- Cave vide et démonstration ----------
{
  const r=await H.newPage(b,{ai:async()=>G({})});const page=r.page;const errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(H.URL0);await H.sl(1200);
  const v=await page.evaluate(()=>({stats:getComputedStyle(document.querySelector('.stats')).display,txt:document.querySelector('#list').textContent,btn:!![...document.querySelectorAll('#list [data-m="demo"]')].length}));
  T('cave vide : plus de compteurs « 0 bouteilles / 0 à boire vite »',v.stats==='none',v.stats);
  T('cave vide : accueil engageant et bouton démo (15 bouteilles)',v.btn&&/Bienvenue/.test(v.txt)&&/15 bouteilles/.test(v.txt),v.txt.slice(0,200));
  await page.evaluate(()=>document.querySelector('#list [data-m="demo"]').click());await H.sl(900);
  const d=await page.evaluate(()=>({n:document.querySelectorAll('#list .w').length,bar:!!document.querySelector('#list .demobar'),stats:getComputedStyle(document.querySelector('.stats')).display,bt:document.querySelector('#sB').textContent,pills:[...new Set([...document.querySelectorAll('#list .w .stl .tag')].map(e=>e.textContent.trim()))],colors:[...new Set([...document.querySelectorAll('#chips .chip')].map(e=>e.dataset.c))]}));
  T('démo : 15 vins affichés, bandeau « Cave de démonstration », compteurs revenus',d.n===15&&d.bar&&d.stats!=='none',JSON.stringify(d));
  T('démo : plusieurs statuts de garde différents (à garder, prêt, urgent…)',d.pills.length>=3,JSON.stringify(d.pills));
  T('démo : toutes les couleurs présentes',['Rouge','Blanc','Rosé','Pétillant'].every(c=>d.colors.includes(c)),JSON.stringify(d.colors));
  const st=await page.evaluate(async()=>{const s=await import('./store.js');const a=await s.allWines();return {n:a.length,ids:a.every(w=>w.id.startsWith('demo-')),complet:a.every(w=>w.story&&w.pairings.length>=4&&w.from&&w.to&&w.from<=w.to)}});
  T('démo : enregistrée (15, identifiants demo-) et fiches complètes',st.n===15&&st.ids&&st.complet,JSON.stringify(st));
  // un vin à soi, puis effacement de la démo
  await page.evaluate(async()=>{const s=await import('./store.js');await s.putWines([{id:'mien',name:'Mon vrai vin',dom:'',year:2019,color:'Rouge',region:'',grape:'',qty:2,price:'',loc:'',from:2022,to:2030,story:'',pairings:[],note:'',check:false,src:{},conf:'',sources:[],tastings:[],created:1,updated:1}])});
  await page.reload();await H.sl(1500);
  await page.evaluate(()=>document.querySelector('#list [data-m="democlear"]').click());await H.sl(500);
  const dlg=await page.evaluate(()=>document.querySelector('#sDlg').textContent);
  T('effacer la démo : demande confirmation et rassure sur ses propres vins',/Effacer la cave de démonstration/.test(dlg)&&/Vos propres vins ne sont pas touchés/.test(dlg),dlg.slice(0,200));
  await page.evaluate(()=>[...document.querySelectorAll('#dlgB button')].find(x=>/Effacer la démo/.test(x.textContent)).click());await H.sl(900);
  const e=await page.evaluate(async()=>{const s=await import('./store.js');const a=await s.allWines();return {ids:a.map(w=>w.id),bar:!!document.querySelector('#list .demobar'),cards:document.querySelectorAll('#list .w').length}});
  T('effacer la démo : seul « Mon vrai vin » reste, bandeau retiré',e.ids.length===1&&e.ids[0]==='mien'&&!e.bar&&e.cards===1,JSON.stringify(e));
  T('aucune erreur JavaScript (démo)',errs.length===0,errs.join(' / '));
  await page.close();
}
// ---------- Scan rapide ----------
{
  const calls=[];let refuse=false;
  const ai=async c=>{calls.push({t:Date.now(),think:c.body.generationConfig&&c.body.generationConfig.thinkingConfig,model:c.url});
    if(refuse&&c.body.generationConfig.thinkingConfig)return {status:400,json:{error:{message:'Invalid argument'}}};
    return {...G({name:'Cuvée Test',dom:'Domaine Test',year:2019,color:'Rouge',region:'Cornas',grape:'Syrah',lecture:'haute'}),delay:500}};
  const r=await H.newPage(b,{ai});const page=r.page;const errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(H.URL0);await H.sl(900);await H.setAI(page,'gemini','AIzaTEST');await page.reload();await H.sl(1200);
  await H.click(page,'#fab');await H.pickFiles(page,()=>H.tapText(page,'#sMenu button','Scanner une étiquette'),['fixtures/lab.png']);await H.sl(1800);
  T('scan : réflexion réduite demandée (thinkingLevel low)',calls.length===1&&calls[0].think&&calls[0].think.thinkingLevel==='low',JSON.stringify(calls[0]));
  const f1=await page.evaluate(()=>document.querySelector('#f-name')?.value||document.querySelector('#fT')?.textContent);
  T('scan : étiquette reconnue, formulaire de vérification ouvert',/Cuvée Test|Vérifier/.test(f1||''),f1);
  // le service refuse le réglage : nouvel essai sans, sans erreur visible
  await page.reload();await H.sl(1200);calls.length=0;refuse=true;
  await H.click(page,'#fab');await H.pickFiles(page,()=>H.tapText(page,'#sMenu button','Scanner une étiquette'),['fixtures/lab.png']);await H.sl(2200);
  T('scan : réglage refusé → nouvel essai sans, le scan réussit',calls.length===2&&calls[0].think&&!calls[1].think,JSON.stringify(calls.map(c=>c.think)));
  const f2=await page.evaluate(()=>document.querySelector('#f-name')?.value||'');
  T('scan : résultat affiché malgré le repli',/Cuvée Test/.test(f2),f2);
  await page.close();
  // deux photos : la seconde est lue pendant que la première est traitée (clé personnelle)
  const r2=await H.newPage(b,{ai});const p2=r2.page;calls.length=0;refuse=false;
  await p2.goto(H.URL0);await H.sl(900);await p2.evaluate(async()=>{const s=await import('./store.js');await s.replaceAll([])});await H.setAI(p2,'gemini','AIzaTEST');await p2.reload();await H.sl(1200);
  await H.click(p2,'#fab');await H.pickFiles(p2,()=>H.tapText(p2,'#sMenu button','Importer des photos'),['fixtures/lab.png','fixtures/lab.png']);await H.sl(3500);
  T('2 photos : 2 appels lancés presque ensemble (lecture en avance)',calls.length===2&&calls[1].t-calls[0].t<350,JSON.stringify(calls.map(c=>c.t-calls[0].t)));
  const w2=await p2.evaluate(async()=>{const s=await import('./store.js');const a=await s.allWines();return a.map(w=>w.qty)});
  T('2 photos du même vin : un seul vin, 2 bouteilles (doublon détecté dans l’ordre)',w2.length===1&&w2[0]===2,JSON.stringify(w2));
  T('aucune erreur JavaScript (scan)',errs.length===0,errs.join(' / '));
}
S.out.forEach(l=>console.log(l));
await b.close();srv.close&&srv.close();process.exit(0);
