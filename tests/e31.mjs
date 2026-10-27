// Activation de la clé gratuite (1.38.0) : encarts A, B, C, feuille en 3 étapes, test de clé, remplacement, hors connexion, règles anti-harcèlement.
import {start} from './server.mjs';import * as H from './h.mjs';
H.deploy();const srv=await start(8123);const b=await H.browser();
const S=H.suite('Clé');const T=S.T;
const PROXY='cave-ia.m-jeanfrancois-morin.workers.dev';
const KEY='AQ.Ab12-fakeKEY_0123456789abcdefghij';
const KEY2='AIzaSyFAKEKEY2_0123456789abcdefghijk';
const G=o=>({json:{candidates:[{content:{parts:[{text:JSON.stringify(o)}]}}]}});
const OBJ={name:'Cuvée Test',dom:'Domaine Test',year:2019,color:'Rouge',region:'Cornas',grape:'Syrah',lecture:'haute'};
let proxyN=0;
let ml='ok';      // réponse de la liste des modèles (test de clé)
let gen='ok';     // réponse des lectures d'étiquette
const ai=async c=>{
  if(c.url.includes('/v1beta/models?'))return ({ok:{json:{models:[{name:'models/x'}]}},refusee:{status:400,json:{error:{message:'API key not valid. Please pass a valid API key.'}}},r403:{status:403,json:{error:{message:'Permission denied'}}},limite:{status:429,json:{error:{message:'Resource exhausted'}}},panne:{status:500,json:{error:{message:'Internal'}}}})[ml];
  if(c.url.includes(PROXY)){proxyN++;return gen==='saturé'||(gen==='uneSeule'&&proxyN>1)?{status:429,json:{error:{message:'quota'}}}:G(OBJ);}
  if(c.url.includes('googleapis')){if(gen==='revoquee')return {status:400,json:{error:{message:'API key not valid. Please pass a valid API key.'}}};if(gen==='limitePerso')return {status:429,json:{error:{message:'quota'}}};return G(OBJ);}
  return G(OBJ);};
const r=await H.newPage(b,{ai});const page=r.page;const calls=r.calls;const errs=r.errs;
const aujourdhui=()=>new Date().toISOString().slice(0,10);
const closeAll=()=>page.evaluate(()=>document.querySelectorAll('.modal.show').forEach(m=>m.classList.remove('show')));
const vis=s=>page.evaluate(s=>{const e=document.querySelector(s);return !!e&&!e.hidden&&e.getClientRects().length>0},s);
const txt=s=>page.evaluate(s=>{const e=document.querySelector(s);return e?(s==='#cle-stp'?e.textContent:e.innerText):''},s);
const shown=s=>H.shown(page,s);
const stubs=()=>page.evaluate(()=>{window.__opened=[];window.open=u=>{window.__opened.push(u);return null};window.__clip='';
  Object.defineProperty(navigator,'clipboard',{value:{readText:async()=>{if(window.__clipFail)throw new Error('refusé');return window.__clip},writeText:async t=>{window.__written=t}},configurable:true});});
const reset=async o=>{o=o||{};await page.evaluate(async o=>{
  localStorage.setItem('cave-gratuit','on');
  if(o.key)localStorage.setItem('cave-ai',JSON.stringify({provider:'gemini',key:o.key}));else localStorage.removeItem('cave-ai');
  localStorage.removeItem('cave-cle-invit');localStorage.removeItem('cave-cle-etape');localStorage.removeItem('cave-ai-cool');
  if(o.invit)localStorage.setItem('cave-cle-invit',JSON.stringify(o.invit));
  const s=await import('./store.js');const j=new Date().toISOString().slice(0,10);
  await s.replaceAll([{id:'a',name:'Vin A',year:2018,qty:2,from:2020,to:2035,src:{from:'user',to:'user'},dom:'D',color:'Rouge',region:'M',grape:'',price:20,created:1,updated:1,story:'',pairings:[],check:false,conf:'',sources:[],note:'',loc:'',tastings:[]}]);
  await s.setMeta('gratuit',{jour:j,vins:o.g||0});await s.setMeta('relais',{jour:j,vins:o.r||0});
},o);await page.reload();await H.sl(1600);await closeAll();await stubs();
  await page.evaluate(async()=>{const m=await import('./ai.js');m.cfg.retryDelay=200;});};
const scan=async(files=['fixtures/lab.png'])=>{await H.click(page,'#fab');await H.pickFiles(page,()=>H.tapText(page,'#sMenu button',files.length>1?'Importer des photos':'Scanner une étiquette'),files);await H.sl(2500)};
const keyOf=()=>page.evaluate(async()=>(await import('./ai.js')).getConfig('gemini').key);
const coller=async t=>{await page.evaluate(t=>{window.__clip=t},t);await H.click(page,'#cle-coller');await H.sl(200)};

await page.goto(H.URL0);await H.sl(1000);
await reset({});

/* ---------- A : ligne discrète sous les boutons de photo ---------- */
await H.click(page,'#fab');await H.sl(300);
const A=await page.evaluate(()=>({t:document.querySelector('#m-enc').innerText,mini:document.querySelector('#m-enc').classList.contains('mini'),vis:!document.querySelector('#m-enc').hidden}));
T('A : ligne « 1 photo gratuite par jour. Plus avec votre propre clé. » et lien',A.vis&&A.mini&&A.t.includes('1 photo gratuite par jour. Plus avec votre propre clé.')&&A.t.includes('Activer ma clé gratuite'),JSON.stringify(A));
T('A : le menu reste utilisable (les boutons de photo sont là)',(await txt('#sMenu')).includes('Scanner une étiquette'));
const hA=await page.evaluate(()=>document.querySelector('#m-enc .lnk').getBoundingClientRect().height);
T('A : zone de toucher d’au moins 44 px',hA>=44,hA);
await H.tapText(page,'#m-enc button','Activer ma clé gratuite');await H.sl(300);
T('A → la feuille d’activation s’ouvre à l’étape 1',await shown('#sCle')&&(await txt('#cle-stp')).includes('Étape 1 sur 3')&&await vis('#cle-1')&&!(await vis('#cle-2'))&&(await txt('#cleT'))==='Activer ma clé gratuite',await txt('#cle-stp'));
const e1=await txt('#cle-1');
T('étape 1 : « environ 2 minutes, sans carte bancaire », compte Google, bouton en anglais, transparence sur Google',e1.includes('Environ 2 minutes, sans carte bancaire')&&e1.includes('compte Google')&&e1.includes('Create API key')&&e1.includes('peuvent servir à améliorer')&&e1.includes('ne photographiez que des étiquettes')&&e1.includes('reste sur ce téléphone'),e1.slice(0,400));
T('étape 1 : pas de « Tester » ni de champ visibles',!(await vis('#cle-champ'))&&!(await vis('#cle-test')));
T('étape 1 : pas de saisie de clé tant qu’on n’y est pas (aucune clé enregistrée)',(await keyOf())==='');
await H.tapText(page,'#cle-copy','Copier l’adresse');await H.sl(200);
T('copier l’adresse : lien direct de création de clé',(await page.evaluate(()=>window.__written))==='https://aistudio.google.com/app/apikey');
await H.click(page,'#cle-open');await H.sl(300);
const op=await page.evaluate(()=>window.__opened);
T('« Ouvrir la page de Google » : page exacte de création de clé, onglet séparé',op.length===1&&op[0]==='https://aistudio.google.com/app/apikey',JSON.stringify(op));
T('après l’ouverture : on passe à l’étape 2',(await txt('#cle-stp')).includes('Étape 2 sur 3')&&await vis('#cle-2'));
T('étape 2 : champ masqué, sans correction ni majuscule automatiques',await page.evaluate(()=>{const i=document.querySelector('#cle-champ');return i.type==='password'&&i.autocomplete==='off'&&i.autocapitalize==='none'&&i.spellcheck===false}));
const rep0=await page.evaluate(()=>localStorage.getItem('cave-cle-etape'));
T('reprise mémorisée (étape 2)',!!rep0&&JSON.parse(rep0).etape===2,rep0);

/* ---------- reprise : fermer puis rouvrir la feuille → étape 2 ---------- */
await page.evaluate(()=>document.querySelector('#sCle [data-close]').click());await H.sl(300);
T('fermer la feuille : la feuille se ferme, le menu reste',!(await shown('#sCle'))&&await shown('#sMenu'));
await H.tapText(page,'#m-enc button','Activer ma clé gratuite');await H.sl(300);
T('reprise : la feuille rouverte reprend à l’étape 2',(await txt('#cle-stp')).includes('Étape 2 sur 3'));
await page.evaluate(()=>localStorage.setItem('cave-cle-etape',JSON.stringify({etape:2,t:Date.now()-2*3600e3})));
await page.evaluate(()=>document.querySelector('#sCle [data-close]').click());await H.sl(300);
await H.tapText(page,'#m-enc button','Activer ma clé gratuite');await H.sl(300);
T('reprise expirée (plus d’une heure) : retour à l’étape 1',(await txt('#cle-stp')).includes('Étape 1 sur 3'));

/* ---------- étape 2 : champ vide, clé incomplète ---------- */
await H.click(page,'#cle-have');await H.sl(200);
await H.click(page,'#cle-suite');await H.sl(200);
T('champ vide : « Collez d’abord votre clé. »',(await txt('#cle-err')).includes('Collez d’abord votre clé.')&&(await txt('#cle-stp')).includes('Étape 2'));
await page.type('#cle-champ','AQ.abc');await H.click(page,'#cle-suite');await H.sl(200);
T('clé trop courte : « semble incomplète », on reste à l’étape 2',(await txt('#cle-err')).includes('semble incomplète. Recopiez-la en entier, sans espace.')&&(await txt('#cle-stp')).includes('Étape 2'));
await page.$eval('#cle-champ',e=>e.value='');await page.type('#cle-champ','AQ.Ab12-fake KEY_0123456789abcdefghij');await H.click(page,'#cle-suite');await H.sl(200);
T('espace au milieu : « semble incomplète »',(await txt('#cle-err')).includes('semble incomplète')&&!(await vis('#cle-3')));
T('aucun appel réseau pour une clé manifestement incomplète',!calls.some(c=>c.url.includes('/v1beta/models?')),calls.map(c=>c.url).join(' | '));
await H.click(page,'#cle-voir');await H.sl(100);
T('« Voir » affiche la clé, « Masquer » la recache',(await page.$eval('#cle-champ',e=>e.type))==='text'&&(await txt('#cle-voir'))==='Masquer');
await H.click(page,'#cle-voir');

/* ---------- Coller : refus du presse-papiers, vide, mauvaise donnée, bonne clé ---------- */
await page.evaluate(()=>{window.__clipFail=true});await H.click(page,'#cle-coller');await H.sl(250);
T('presse-papiers refusé : explication simple, saisie manuelle possible',(await txt('#cle-err')).includes('Collage impossible')&&(await txt('#cle-stp')).includes('Étape 2'),await txt('#cle-err'));
await page.evaluate(()=>{window.__clipFail=false});
await coller('');
T('presse-papiers vide : « Collez d’abord votre clé. »',(await txt('#cle-err')).includes('Collez d’abord votre clé.')||(await txt('#cle-err')).includes('semble incomplète'),await txt('#cle-err'));
await coller('Voici ma clé : '+KEY+' merci');
T('texte recopié avec des mots autour : refusé proprement (« incomplète »)',(await txt('#cle-err')).includes('semble incomplète')&&!(await vis('#cle-3')));
await coller('  "'+KEY+'"\n');
T('bonne clé collée (avec guillemets et saut de ligne) : passage direct à l’étape 3',(await txt('#cle-stp')).includes('Étape 3 sur 3')&&await vis('#cle-3')&&await vis('#cle-test'));
T('étape 3 : la clé n’est jamais affichée en entier (début et fin seulement)',(await txt('#cle-apercu'))==='AQ.A…ghij',await txt('#cle-apercu'));
T('étape 3 : rien n’est encore enregistré',(await keyOf())==='');

/* ---------- Test : clé refusée par Google ---------- */
ml='refusee';const n0=calls.length;
await H.click(page,'#cle-test');await H.sl(600);
const ct=calls.slice(n0);const cm=ct.find(c=>c.url.includes('/v1beta/models?'));
T('test de clé : un appel de lecture (liste des modèles), clé dans l’en-tête et jamais dans l’adresse, nettoyée',!!cm&&cm.headers['x-goog-api-key']===KEY&&!cm.url.includes('AQ.')&&!cm.url.includes('key='),JSON.stringify(cm&&[cm.url,cm.headers]));
T('test de clé : aucune génération de texte consommée',!ct.some(c=>c.url.includes('generateContent')),ct.map(c=>c.url).join(' | '));
const resKo=await txt('#cle-res');
T('clé refusée : message « ❌ Google a refusé cette clé… »',resKo.includes('❌ Google a refusé cette clé. Vérifiez qu’elle est copiée en entier, ou créez-en une nouvelle.'),resKo);
T('clé refusée : trois actions (Réessayer, Créer une nouvelle clé, Saisir à la main)',await page.evaluate(()=>[...document.querySelectorAll('#cle-fin button')].map(b=>b.textContent).join('|'))==='Réessayer|Créer une nouvelle clé|Saisir à la main');
T('clé refusée : la clé n’est PAS enregistrée',(await keyOf())==='');
T('clé refusée : le résultat n’est pas signalé par la couleur seule (texte + ❌) et annoncé (role=status)',await page.evaluate(()=>{const e=document.querySelector('#cle-res');return e.getAttribute('role')==='status'&&e.classList.contains('ko')}));
const hb=await page.evaluate(()=>[...document.querySelectorAll('#cle-fin button')].map(b=>b.getBoundingClientRect().height));
T('boutons du résultat : au moins 44 px',hb.every(h=>h>=44),hb.join(','));
/* Réessayer → étape 2, champ conservé ; 403 est aussi « refusée » */
await H.tapText(page,'#cle-fin button','Réessayer');await H.sl(250);
T('« Réessayer » : retour à l’étape 2 avec la clé encore dans le champ, résultat effacé',(await txt('#cle-stp')).includes('Étape 2')&&(await page.$eval('#cle-champ',e=>e.value))===KEY&&!(await vis('#cle-res')));
await H.click(page,'#cle-suite');await H.sl(200);ml='r403';await H.click(page,'#cle-test');await H.sl(500);
T('accès refusé (403) : même message que clé refusée, rien d’enregistré',(await txt('#cle-res')).includes('Google a refusé cette clé')&&(await keyOf())==='');
/* panne de Google */
await H.tapText(page,'#cle-fin button','Réessayer');await H.sl(200);await H.click(page,'#cle-suite');await H.sl(200);
ml='panne';await H.click(page,'#cle-test');await H.sl(500);
T('Google en panne (500) : message dédié, pas « clé refusée », rien d’enregistré',(await txt('#cle-res')).includes('Google ne répond pas correctement pour le moment')&&!(await txt('#cle-res')).includes('refusé')&&(await keyOf())==='');
T('Google en panne : actions Réessayer et Saisir à la main',await page.evaluate(()=>[...document.querySelectorAll('#cle-fin button')].map(b=>b.textContent).join('|'))==='Réessayer|Saisir à la main');
/* Réessayer = nouveau test avec la même clé ; cette fois valide */
ml='ok';await H.tapText(page,'#cle-fin button','Réessayer');await H.sl(700);
T('Réessayer après une panne : nouveau test de la même clé, réussi',(await txt('#cle-res')).includes('✅ Clé activée')&&(await keyOf())===KEY,await txt('#cle-res'));
T('succès : message exact, boutons « Photographier une étiquette » et « Terminer »',(await txt('#cle-res')).includes('✅ Clé activée. L’appli ne fixe plus de limite pour vos photos ; seul le quota gratuit de Google s’applique.')&&await page.evaluate(()=>[...document.querySelectorAll('#cle-fin button')].map(b=>b.textContent).join('|'))==='Photographier une étiquette|Terminer');
T('succès : la reprise est effacée',(await page.evaluate(()=>localStorage.getItem('cave-cle-etape')))===null);
const st=await page.evaluate(async()=>{const s=await import('./store.js');const c=await s.getMeta('aiCfg');return JSON.stringify(c)});
T('succès : la clé est aussi copiée pour la passe de fond (sur le téléphone seulement)',st.includes(KEY),st.slice(0,80));
/* « Terminer » : le menu est mis à jour (plus d'encart), Réglages aussi */
await H.tapText(page,'#cle-fin button','Terminer');await H.sl(300);
T('Terminer : feuille fermée, encart A disparu du menu (clé valide : rien n’est affiché)',!(await shown('#sCle'))&&!(await vis('#m-enc')));
await page.evaluate(()=>document.querySelector('#sMenu [data-close]').click());await H.sl(200);
await page.evaluate(()=>document.querySelector('#bSet').click());await H.sl(500);
T('Réglages avec clé : guide masqué, « Remplacer ma clé » visible',!(await vis('#ai-guide'))&&await vis('#ai-repl'));
T('Réglages : le champ de clé est rempli avec la nouvelle clé',(await page.$eval('#ai-key',e=>e.value))===KEY);
await page.evaluate(()=>document.querySelector('#sSet [data-close]').click());await H.sl(300);

/* ---------- Remplacement : l'ancienne clé reste active tant que la nouvelle n'est pas bonne ---------- */
await page.evaluate(()=>document.querySelector('#bSet').click());await H.sl(400);
await H.click(page,'#ai-repl');await H.sl(300);
T('remplacer : titre « Remplacer ma clé » et rappel que l’ancienne reste active',(await txt('#cleT'))==='Remplacer ma clé'&&await vis('#cle-ancienne')&&(await txt('#cle-ancienne')).includes('reste active'),await txt('#cleT'));
await H.click(page,'#cle-have');await H.sl(200);
await coller(KEY2);ml='refusee';await H.click(page,'#cle-test');await H.sl(500);
T('nouvelle clé refusée : l’ancienne reste en place',(await keyOf())===KEY&&(await txt('#cle-res')).includes('refusé'));
await H.tapText(page,'#cle-fin button','Réessayer');await H.sl(200);await H.click(page,'#cle-suite');await H.sl(200);
ml='limite';await H.click(page,'#cle-test');await H.sl(500);
T('limite de Google (429) : « ✅ Clé valide… », la clé est enregistrée, remplace l’ancienne',(await txt('#cle-res')).includes('✅ Clé valide. Google a atteint sa limite pour le moment : elle fonctionnera de nouveau plus tard.')&&(await keyOf())===KEY2,await txt('#cle-res'));
T('limite de Google : un seul bouton « Terminer »',await page.evaluate(()=>[...document.querySelectorAll('#cle-fin button')].map(b=>b.textContent).join('|'))==='Terminer');
await H.tapText(page,'#cle-fin button','Terminer');await H.sl(300);
T('Réglages ouverts derrière : le champ montre la nouvelle clé',(await page.$eval('#ai-key',e=>e.value))===KEY2);
await page.evaluate(()=>document.querySelector('#sSet [data-close]').click());await H.sl(300);

/* ---------- Hors connexion : clé enregistrée, vérifiée plus tard ---------- */
await reset({});
await H.click(page,'#fab');await H.tapText(page,'#m-enc button','Activer ma clé gratuite');await H.sl(300);await H.click(page,'#cle-have');await H.sl(200);
await coller(KEY);
await page.setOfflineMode(true);await H.sl(200);
const n1=calls.length;ml='ok';
await H.click(page,'#cle-test');await H.sl(500);
T('hors connexion : « Pas de réseau… », clé enregistrée, aucun appel tenté',(await txt('#cle-res')).includes('Pas de réseau : impossible de tester maintenant. Votre clé est enregistrée ; elle sera vérifiée à votre prochaine photo.')&&(await keyOf())===KEY&&calls.length===n1,await txt('#cle-res'));
await page.setOfflineMode(false);await H.sl(200);
/* réseau coupé en cours de route (la requête échoue) */
await reset({});
await H.click(page,'#fab');await H.tapText(page,'#m-enc button','Activer ma clé gratuite');await H.sl(300);await H.click(page,'#cle-have');await H.sl(200);
await coller(KEY);
await page.evaluate(()=>{window.__f=window.fetch;window.fetch=async()=>{throw new TypeError('Failed to fetch')}});
await H.click(page,'#cle-test');await H.sl(500);
await page.evaluate(()=>{window.fetch=window.__f});
T('requête qui échoue (réseau coupé) : même message « Pas de réseau », jamais « clé refusée »',(await txt('#cle-res')).includes('Pas de réseau')&&!(await txt('#cle-res')).includes('refusé'),await txt('#cle-res'));

/* ---------- C1 : photo du jour utilisée, encart dans le menu ---------- */
await reset({g:1});
await H.click(page,'#fab');await H.sl(300);
const C1=await page.evaluate(()=>({t:document.querySelector('#m-enc').innerText,mini:document.querySelector('#m-enc').classList.contains('mini'),b:[...document.querySelectorAll('#m-enc button')].map(x=>x.textContent)}));
T('C1 : titre et texte exacts dans le menu',C1.t.includes('Plus de photo gratuite aujourd’hui')&&C1.t.includes('Elle revient demain. Pour continuer maintenant, activez votre clé gratuite (environ 2 minutes), ou saisissez vos vins à la main.')&&!C1.mini,C1.t);
T('C1 : deux actions « Activer ma clé gratuite » et « Saisir à la main »',C1.b.join('|')==='Activer ma clé gratuite|Saisir à la main',C1.b.join('|'));
const n2=calls.length;
await H.tapText(page,'#sMenu button','Scanner une étiquette');await H.sl(500);
T('C1 : toucher « Scanner » n’ouvre ni appareil photo ni fenêtre bloquante, aucun appel',!(await shown('#sDlg'))&&await shown('#sMenu')&&calls.length===n2&&await vis('#m-enc'));
await H.tapText(page,'#sMenu button','Importer des photos');await H.sl(500);
T('C1 : idem pour « Importer des photos »',!(await shown('#sDlg'))&&await shown('#sMenu')&&calls.length===n2);
await H.tapText(page,'#m-enc button','Saisir à la main');await H.sl(400);
T('C1 : « Saisir à la main » ouvre le formulaire vide',await shown('#sForm')&&(await page.$eval('#f-name',e=>e.value))===''&&!(await shown('#sMenu')));
T('C1 : formulaire manuel sans photo ni encart',!(await vis('#f-photo-w'))&&!(await vis('#f-enc')));
await page.evaluate(()=>document.querySelector('#f-cancel').click());await H.sl(300);
await H.click(page,'#fab');await H.sl(300);await H.tapText(page,'#m-enc button','Activer ma clé gratuite');await H.sl(300);
T('C1 : « Activer ma clé gratuite » ouvre la feuille',await shown('#sCle'));
/* activer depuis C1 : le menu se met à jour tout seul */
await H.click(page,'#cle-have');await H.sl(200);await coller(KEY);ml='ok';await H.click(page,'#cle-test');await H.sl(500);
await H.tapText(page,'#cle-fin button','Terminer');await H.sl(300);
T('après activation depuis C1 : plus d’encart, la photo est de nouveau possible',!(await vis('#m-enc'))&&(await page.evaluate(async()=>(await import('./ai.js')).etatPhoto()))==='perso');
await page.evaluate(()=>document.querySelector('#sMenu [data-close]').click());await H.sl(200);

/* ---------- B : après la 1re photo gratuite du jour ---------- */
await reset({});
await scan();
T('B : la fiche à vérifier s’ouvre avec l’encart « Votre photo gratuite du jour est utilisée »',await shown('#sForm')&&await vis('#f-enc')&&(await txt('#f-enc')).includes('Votre photo gratuite du jour est utilisée'),await txt('#f-enc'));
T('B : texte exact et deux sorties (Activer, croix), jamais de fenêtre bloquante',(await txt('#f-enc')).includes('Pour en lire d’autres aujourd’hui, activez votre clé gratuite (environ 2 minutes, sans carte bancaire). Sinon, la saisie à la main fonctionne très bien.')&&await page.evaluate(()=>[...document.querySelectorAll('#f-enc button')].map(b=>b.textContent.trim()).join('|'))==='×|Activer ma clé gratuite'&&!(await shown('#sDlg')));
T('B : la fiche scannée est bien remplie malgré l’encart',(await page.$eval('#f-name',e=>e.value))==='Cuvée Test');
const inv1=await page.evaluate(()=>JSON.parse(localStorage.getItem('cave-cle-invit')));
T('B : vu une fois, mémorisé sur l’appareil (jour)',inv1.vus===1&&inv1.dernier===new Date().toISOString().slice(0,10),JSON.stringify(inv1));
await H.tapText(page,'#f-enc button','Activer ma clé gratuite');await H.sl(300);
T('B → « Activer ma clé gratuite » ouvre la feuille par-dessus la fiche',await shown('#sCle')&&await shown('#sForm'));
await page.evaluate(()=>document.querySelector('#sCle [data-close]').click());await H.sl(300);
T('fermer la feuille : on retrouve la fiche scannée et sa saisie',await shown('#sForm')&&(await page.$eval('#f-name',e=>e.value))==='Cuvée Test'&&!(await shown('#sCle')));
await page.evaluate(()=>{document.querySelector('#f-cancel').click()});await H.sl(300);
if(await shown('#sDlg'))await H.tapText(page,'#sDlg button','Abandonner');await H.sl(300);
/* anti-harcèlement : même jour → pas de B ; lendemain → B ; 3 fois au plus ; croix → 14 jours */
await reset({invit:inv1,g:0});
await scan();
T('anti-harcèlement : une 2e photo gratuite le même jour (compteur remis à zéro) n’affiche pas B',await shown('#sForm')&&!(await vis('#f-enc')));
const hier=new Date(Date.now()-864e5).toISOString().slice(0,10);
await reset({invit:{vus:1,dernier:hier,ferme:0},g:0});await scan();
T('anti-harcèlement : le lendemain, B revient (2e fois)',await vis('#f-enc')&&JSON.parse(await page.evaluate(()=>localStorage.getItem('cave-cle-invit'))).vus===2);
await reset({invit:{vus:2,dernier:hier,ferme:0},g:0});await scan();
T('anti-harcèlement : 3e fois affichée',await vis('#f-enc')&&JSON.parse(await page.evaluate(()=>localStorage.getItem('cave-cle-invit'))).vus===3);
await reset({invit:{vus:3,dernier:hier,ferme:0},g:0});await scan();
T('anti-harcèlement : jamais une 4e fois',await shown('#sForm')&&!(await vis('#f-enc')));
await reset({invit:{vus:1,dernier:hier,ferme:0},g:0});await scan();
await H.click(page,'#f-enc .x');await H.sl(200);
const inv2=await page.evaluate(()=>JSON.parse(localStorage.getItem('cave-cle-invit')));
T('croix : B disparaît tout de suite et la fermeture est mémorisée',!(await vis('#f-enc'))&&inv2.ferme>0&&(await shown('#sForm')),JSON.stringify(inv2));
const hx=await page.evaluate(()=>{const x=document.createElement('div');return 44});
await reset({invit:{vus:1,dernier:hier,ferme:Date.now()-5*864e5},g:0});await scan();
T('croix il y a 5 jours : pas de B (pause de 14 jours)',await shown('#sForm')&&!(await vis('#f-enc')));
await reset({invit:{vus:1,dernier:hier,ferme:Date.now()-15*864e5},g:0});await scan();
T('croix il y a 15 jours : B peut revenir',await vis('#f-enc'));
await reset({key:KEY,g:0});await scan();
T('avec une clé valide : jamais d’encart B',await shown('#sForm')&&!(await vis('#f-enc')));
await H.click(page,'#fab');await H.sl(300);
T('avec une clé valide : jamais d’encart dans le menu',!(await vis('#m-enc')));
await closeAll();

/* ---------- B : pas de B à la première ouverture, avant toute photo ---------- */
await reset({});
T('avant toute photo : aucun encart B à l’écran, aucune invitation mémorisée',!(await vis('#f-enc'))&&(await page.evaluate(()=>localStorage.getItem('cave-cle-invit')))===null);

/* ---------- C2 : service gratuit saturé, photo conservée pour la saisie ---------- */
await reset({g:0});gen='saturé';proxyN=0;
await page.evaluate(async()=>{(await import('./ai.js')).cfg.retryDelay=20000});
await scan();
const lg=await txt('#sLog');
T('C2 : service gratuit saturé → réponse immédiate, un seul appel, aucune attente de 20 s',lg.includes('Le service de photo gratuit est saturé')&&proxyN===1&&!lg.includes('nouvel essai'),proxyN+' | '+lg.slice(0,200));
T('C2 : encart « Le service de photo gratuit est saturé » dans la fenêtre d’analyse',lg.includes('Le service de photo gratuit est saturé')&&lg.includes('Ce n’est pas de votre fait. Réessayez plus tard, activez votre clé gratuite, ou saisissez ce vin à la main.'),lg.slice(0,500));
T('C2 : jamais « vous avez utilisé votre photo » quand c’est le service qui est saturé',!lg.includes('Plus de photo gratuite aujourd’hui'));
T('C2 : les deux actions sont là (Activer ma clé gratuite, Saisir à la main)',await page.evaluate(()=>[...document.querySelectorAll('#sLog button:not(.sx)')].filter(b=>b.getClientRects().length>0).map(b=>b.textContent.trim()).join('|'))==='Activer ma clé gratuite|Saisir à la main|Fermer',await page.evaluate(()=>[...document.querySelectorAll('#sLog button')].filter(b=>b.getClientRects().length>0).map(b=>b.textContent.trim()).join('|')));
await H.tapText(page,'#lgMan','Saisir à la main');await H.sl(400);
T('C2 : « Saisir à la main » ouvre le formulaire vide avec la photo affichée au-dessus',await shown('#sForm')&&(await page.$eval('#f-name',e=>e.value))===''&&await vis('#f-photo-w')&&(await page.$eval('#f-photo',e=>e.src.startsWith('blob:')&&e.naturalWidth>0)),await page.$eval('#f-photo',e=>e.src));
T('C2 : texte d’aide sous la photo',(await txt('#f-photo-w')).includes('Votre photo reste ici pour vous aider à saisir le vin.'));
const hasW=await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1);
T('C2 : pas de débordement horizontal',hasW);
await page.evaluate(()=>document.querySelector('#f-cancel').click());await H.sl(300);
await H.click(page,'#fab');await H.pickFiles(page,()=>H.tapText(page,'#sMenu button','Scanner une étiquette'),['fixtures/lab.png']);await H.sl(2500);
await H.tapText(page,'#sLog button','Activer ma clé gratuite');await H.sl(300);
T('C2 : « Activer ma clé gratuite » ouvre la feuille par-dessus l’analyse',await shown('#sCle'));
await page.evaluate(()=>document.querySelector('#sCle [data-close]').click());await H.sl(300);
await page.evaluate(()=>document.querySelector('#lgX').click());await H.sl(300);
T('C2 : la photo n’est pas consommée quand le service refuse',(await page.evaluate(async()=>(await import('./ai.js')).gratuitReste()))===1);
/* la photo disparaît du formulaire suivant */
await H.click(page,'#fab');await H.tapText(page,'#sMenu button','Saisie manuelle');await H.sl(400);
T('formulaire suivant : l’ancienne photo n’y est plus',!(await vis('#f-photo-w'))&&!(await page.$eval('#f-photo',e=>e.hasAttribute('src'))));
await page.evaluate(()=>document.querySelector('#f-cancel').click());await H.sl(300);

/* ---------- C1 en lot : 2e photo refusée ---------- */
gen='uneSeule';proxyN=0;await reset({g:0});
await scan(['fixtures/lab.png','fixtures/lab.png']);
for(let i=0;i<40&&!(await txt('#sLog')).includes('Plus de photo gratuite');i++)await H.sl(250);
const lot=await txt('#sLog');
T('lot sans clé : 1re photo lue, la 2e refusée avec l’encart « Plus de photo gratuite aujourd’hui » (sans promettre une photo affichée)',lot.includes('Plus de photo gratuite aujourd’hui')&&lot.includes('saisissez vos vins à la main')&&!lot.includes('votre photo reste affichée'),lot.slice(0,600));
await page.evaluate(()=>document.querySelector('#lgX').click());await H.sl(300);

/* ---------- Clé révoquée / limite de Google pour une clé personnelle ---------- */
gen='revoquee';await reset({key:KEY,g:0});
await scan();
const rv=await txt('#sLog');
T('clé révoquée : encart « Google ne reconnaît plus votre clé » avec « Remplacer ma clé »',rv.includes('Google ne reconnaît plus votre clé')&&rv.includes('Elle a peut-être été supprimée.')&&rv.includes('Remplacer ma clé'),rv.slice(0,500));
T('clé révoquée : « Saisir à la main » proposé aussi',await vis('#lgMan'));
await H.tapText(page,'#sLog button','Remplacer ma clé');await H.sl(300);
T('clé révoquée → feuille « Remplacer ma clé »',await shown('#sCle')&&(await txt('#cleT'))==='Remplacer ma clé');
await page.evaluate(()=>document.querySelector('#sCle [data-close]').click());await H.sl(300);
await page.evaluate(()=>document.querySelector('#lgX').click());await H.sl(300);
gen='limitePerso';await reset({key:KEY,g:0});
await scan();
const lp=await txt('#sLog');
T('limite de Google pour votre clé : message exact, sans bouton d’activation inutile',lp.includes('Google a atteint sa limite du jour pour votre clé. Elle revient demain. En attendant, saisissez à la main.')&&!lp.includes('Activer ma clé gratuite')&&!lp.includes('Remplacer ma clé'),lp.slice(0,500));
await page.evaluate(()=>document.querySelector('#lgX').click());await H.sl(300);
gen='ok';

/* ---------- Relais épuisé (fiches) : la fenêtre propose l'activation ---------- */
await reset({g:0,r:10});
await H.click(page,'#fab');await H.sl(300);await H.tapText(page,'#sMenu button','Mettre à jour les fiches');await H.sl(600);
const dl=await page.evaluate(()=>({t:document.querySelector('#dlgT').textContent,x:document.querySelector('#dlgX').textContent,b:[...document.querySelectorAll('#sDlg button')].filter(b=>b.getClientRects().length>0).map(b=>b.textContent.trim())}));
T('IA offerte épuisée : fenêtre « Limite du jour atteinte » avec « Activer ma clé gratuite » et « Plus tard »',dl.t.includes('Limite du jour atteinte')&&dl.x.includes('environ 2 minutes, sans carte bancaire')&&dl.b.includes('Activer ma clé gratuite')&&dl.b.includes('Plus tard'),JSON.stringify(dl));
await H.tapText(page,'#sDlg button','Activer ma clé gratuite');await H.sl(500);
T('IA offerte épuisée : « Activer ma clé gratuite » ouvre la feuille',await shown('#sCle'));
await page.evaluate(()=>document.querySelector('#sCle [data-close]').click());await H.sl(300);await closeAll();

/* ---------- Réglages sans clé : « Activer pas à pas » ---------- */
await reset({});
await page.evaluate(()=>document.querySelector('#bSet').click());await H.sl(500);
T('Réglages sans clé : guide existant conservé, « Activer pas à pas » visible, « Remplacer » masqué',await vis('#ai-guide')&&await vis('#ai-pas')&&!(await vis('#ai-repl'))&&(await txt('#ai-open'))==='🔑 Obtenir ma clé gratuite');
await H.click(page,'#ai-pas');await H.sl(300);
T('« Activer pas à pas » ouvre la feuille',await shown('#sCle')&&await shown('#sSet'));
/* bouton Retour d'Android */
await page.evaluate(()=>history.back());await H.sl(500);
T('bouton Retour : ferme la feuille d’activation d’abord (puis Réglages)',!(await shown('#sCle'))&&await shown('#sSet'));
await page.evaluate(()=>history.back());await H.sl(500);
T('bouton Retour : puis ferme Réglages',!(await shown('#sSet')));

/* ---------- La clé n'est jamais dans une sauvegarde ni un export ---------- */
await reset({key:KEY});
await page.evaluate(()=>{window.__dl=[]});
await H.click(page,'#fab');await H.sl(300);await H.tapText(page,'#sMenu button','Sauvegarder ma cave');await H.sl(1200);
const dls=await page.evaluate(()=>window.__dl);
T('sauvegarde : un fichier est produit et il ne contient jamais la clé',dls.length>=1&&dls.every(d=>!d.text.includes(KEY)&&!d.text.includes('AQ.Ab12')&&!d.text.includes('cave-ai')),JSON.stringify(dls.map(d=>[d.name,d.text.length])));
await closeAll();
await page.evaluate(()=>{window.__dl=[]});
await H.click(page,'#fab');await H.sl(300);await H.tapText(page,'#sMenu button','Exporter en tableur');await H.sl(1200);
const dls2=await page.evaluate(()=>window.__dl);
T('export tableur : jamais la clé',dls2.every(d=>!d.text.includes(KEY)),JSON.stringify(dls2.map(d=>d.name)));
await closeAll();

/* ---------- Hors connexion : le nouveau fichier est bien dans le cache ---------- */
const cache=await page.evaluate(async()=>{const k=await caches.keys();let ok=false;for(const n of k){const c=await caches.open(n);if(await c.match('cle.js'))ok=true}return ok});
T('hors connexion : cle.js est dans le cache du service worker',cache===true);

/* ---------- Petit écran 320 px : pas de débordement dans la feuille ---------- */
await reset({});
await page.setViewport({width:320,height:640,isMobile:true,hasTouch:true,deviceScaleFactor:2});
await page.evaluate(()=>document.querySelector('#bSet').click());await H.sl(300);await H.click(page,'#ai-pas');await H.sl(300);
const w1=await page.evaluate(()=>{const s=document.querySelector('#sCle .sheet');return s.scrollWidth<=s.clientWidth+1});
await H.click(page,'#cle-have');await H.sl(200);
const w2=await page.evaluate(()=>{const s=document.querySelector('#sCle .sheet');return s.scrollWidth<=s.clientWidth+1});
await coller(KEY);await H.sl(200);
const w3=await page.evaluate(()=>{const s=document.querySelector('#sCle .sheet');return s.scrollWidth<=s.clientWidth+1});
T('320 px : aucune étape ne déborde horizontalement',w1&&w2&&w3,[w1,w2,w3].join());
const hs=await page.evaluate(()=>['#cle-open','#cle-copy','#cle-have','#cle-test'].map(s=>{const e=document.querySelector(s);return e.getClientRects().length?e.getBoundingClientRect().height:99}));
T('boutons de la feuille : au moins 44 px (sauf le lien discret « J’ai déjà ma clé » ≥ 36 px)',hs[0]>=44&&hs[1]>=44&&hs[2]>=36&&hs[3]>=44,hs.join());
await page.setViewport({width:390,height:780,isMobile:true,hasTouch:true,deviceScaleFactor:2});

T('aucune erreur de page ni fenêtre native pendant tout le parcours',errs.length===0,errs.join(' | '));
await b.close();srv.close();
console.log(S.out.join('\n'));
