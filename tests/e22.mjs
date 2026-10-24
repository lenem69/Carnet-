// Identité et UX 1.25.2-1.25.3 : esprit de Ma cave, Réglages en rubriques, menu en deux sections, Que boire expliqué,
// Équilibre de ma cave (contenu de l’avis strictement conservé), une seule erreur affichée à la fois.
import {start} from './server.mjs';import * as H from './h.mjs';
H.deploy();const srv=await start(8123);const b=await H.browser();
const S=H.suite('Identité et UX');const T=S.T;
const r=await H.newPage(b,{});const page=r.page;
const errs=[];page.on('pageerror',e=>errs.push(e.message));
await page.goto(H.URL0);await H.sl(900);
const COURT='Cave plutôt rouge, il lui manque des blancs.\nEt une pointe de Loire.';
const COMPLET='Premier paragraphe détaillé.\n\nSecond paragraphe : réserves et nuances.';
await page.evaluate(async(COURT,COMPLET)=>{const s=await import('./store.js');const base={src:{from:'user',to:'user'},dom:'D',color:'Rouge',region:'Margaux',grape:'Merlot',price:20,created:1,updated:1,story:'x',pairings:['a'],check:false,conf:'',sources:[],note:'',loc:'',tastings:[]};
await s.replaceAll([{...base,id:'a',name:'Vin A',year:2018,qty:2,from:2020,to:2035},{...base,id:'b',name:'Vin B',year:2010,qty:1,from:2015,to:2026}]);
await s.setMeta('bienvenue',{prenom:'Jeff',date:1});
await s.setMeta('avis',{court:COURT,complet:COMPLET,date:Date.now(),cle:'x',v:window.APP_VERSION||'',erreur:''});},COURT,COMPLET);
await page.reload();await H.sl(2500);
await page.evaluate(()=>document.querySelectorAll('.modal.show').forEach(m=>m.classList.remove('show')));

/* Accueil : signature discrète, citation conservée */
T('accueil : signature discrète',(await H.txt(page,'.credit')).toLowerCase().includes('votre cave. vos choix. votre plaisir.'));
T('accueil : citation conservée',(await H.txt(page,'.quote')).length>10);
T('tags des cartes pas en majuscules espacées',await page.evaluate(()=>{const t=document.querySelector('#list .tag');return !t||getComputedStyle(t).textTransform==='none';}));
T('carte : statut en pastille principale',await page.evaluate(()=>!!document.querySelector('#list .w .stl .tag.stp')));

/* Menu Ajouter des vins : deux sections, toutes les commandes */
await page.evaluate(()=>document.querySelector('#fab').click());await H.sl(400);
const menu=(await H.txt(page,'#sMenu')).toLowerCase();
T('menu : section « Ajouter des bouteilles »',menu.includes('ajouter des bouteilles'));
T('menu : section « Gérer ma cave »',menu.includes('gérer ma cave'));
const cmds=await page.evaluate(()=>[...document.querySelectorAll('#sMenu [data-m]')].map(e=>e.dataset.m));
T('menu : toutes les commandes conservées',['cam','img','xls','man','enr','bk','res','csv','help'].every(k=>cmds.includes(k)),cmds.join(','));
const hmin=await page.evaluate(()=>Math.min(...[...document.querySelectorAll('#sMenu [data-m]')].map(e=>e.getBoundingClientRect().height)));
T('menu : zones tactiles ≥ 44 px',hmin>=44,String(hmin));
await page.evaluate(()=>document.querySelectorAll('.modal.show').forEach(m=>m.classList.remove('show')));

/* Réglages : À propos en haut, rubriques, esprit */
await page.evaluate(()=>document.querySelector('#bSet').click());await H.sl(500);
const heads=await page.evaluate(()=>[...document.querySelectorAll('#sSet h3')].filter(h=>h.offsetParent).map(h=>h.textContent.trim()));
T('réglages : « À propos » est la première rubrique',heads[0]==='À propos',heads.join(' | '));
T('réglages : rubriques IA, Données, Application présentes',['IA (optionnelle)','Données','Application'].every(x=>heads.includes(x)),heads.join(' | '));
T('réglages : champs IA toujours utilisables',await page.evaluate(()=>{const e=document.querySelector('#ai-key');return !!e&&e.offsetParent!==null;}));
T('réglages : info hors connexion',(await H.txt(page,'#sSet')).includes('Hors connexion'));
await page.evaluate(()=>document.querySelector('#st-news').click());await H.sl(500);
T('réglages : « Voir les nouveautés » affiche la liste',(await H.txt(page,'#sDlg')).includes('cave de démonstration'),await H.txt(page,'#sDlg'));
await H.tapText(page,'#dlgB button','Fermer');await H.sl(400);
await page.evaluate(()=>document.querySelector('#st-esprit').click());await H.sl(500);
const es=await H.txt(page,'#sEsprit');
for(const t of ['Votre cave vous appartient.','Une cave, sans complications.','Savoir quoi ouvrir, et quand.','Votre cave, même hors connexion.','Des repères solides, pas des réponses au hasard.','Un outil à votre service. Rien de plus.','base de données dédiée au vin'])
  T('esprit : « '+t+' »',es.includes(t));
T('esprit : signature',es.toLowerCase().includes('votre cave. vos choix. votre plaisir.'));
T('esprit : IA = service externe, dit clairement',es.includes('envoyées au service d’IA'));
T('esprit : pas de promesse absolue',!/100 ?%|zéro donnée/i.test(es));
await page.evaluate(()=>document.querySelectorAll('.modal.show').forEach(m=>m.classList.remove('show')));

/* Que boire ? : usages principaux, justification issue des données */
await H.tapText(page,'.tab','Que boire');await H.sl(500);
const modes=await page.evaluate(()=>[...document.querySelectorAll('#bchips .chip')].map(c=>c.textContent.trim()));
T('que boire : ordre des usages (apogée en complément)',modes.join('|')==='Cette année|À boire vite|Avec un plat|Apogée',modes.join('|'));
T('que boire : justification affichée',(await H.txt(page,'#blist')).includes('Dans sa période de garde'),await H.txt(page,'#blist'));
await H.tapText(page,'#bchips .chip','À boire vite');await H.sl(400);
T('que boire : « à boire vite » explique la fenêtre',/Fenêtre de garde (jusqu’en|qui se termine|terminée)/.test(await H.txt(page,'#blist')),await H.txt(page,'#blist'));

/* Magic : Équilibre de ma cave, contenu de l’avis conservé à l’identique */
await H.tapText(page,'.tab','Magic');await H.sl(600);
const bilan=await H.txt(page,'#vChiffres .bilan');
T('équilibre : titre « Équilibre de ma cave »',bilan.includes('Équilibre de ma cave'));
const avis=await page.evaluate(()=>{const a=document.querySelector('#avisIA');const d=a.querySelector('details');return {tout:a.textContent,complet:d?d.querySelector('p').textContent:null,summary:d?d.querySelector('summary').textContent:null};});
T('équilibre : avis court identique',avis.tout.includes(COURT),JSON.stringify(avis.tout));
T('équilibre : avis complet identique',avis.complet===COMPLET,JSON.stringify(avis.complet));
T('équilibre : accès « Avis complet » conservé',avis.summary==='Avis complet');
T('équilibre : mention « pas une valeur de revente garantie »',bilan.includes('pas une valeur de revente garantie'));


/* Menu « Actions » d’une carte */
await H.tapText(page,'.tab','Ma cave');await H.sl(400);
T('carte : un seul bouton visible « Actions », plus de Supprimer à côté des + et −',await page.evaluate(()=>{const c=document.querySelector('#list .w');const vis=[...c.querySelectorAll('button')].filter(b=>b.offsetParent!==null).map(b=>b.textContent.trim());return vis.some(x=>x.includes('Actions'))&&!vis.includes('Supprimer')&&!vis.includes('Modifier');}));
T('carte : bouton Actions éloigné de 12 px au moins du « − »',await page.evaluate(()=>{const c=document.querySelector('#list .w');const a=c.querySelector('.am').getBoundingClientRect();const m=c.querySelector('[data-a="m"]').getBoundingClientRect();return a.top-m.bottom>=12;}));
await page.evaluate(()=>document.querySelector('#list .w .am').click());await H.sl(500);
const act=await H.txt(page,'#sAct');
T('menu actions : nom du vin et 4 actions',act.includes('Vin')&&act.includes('Modifier')&&act.includes('Noter une dégustation')&&act.includes('Supprimer'),act);
T('menu actions : Supprimer est séparé et en rouge',await page.evaluate(()=>{const b=document.querySelector('#sAct [data-x="d"]');return b.classList.contains('danger')&&!b.closest('.stack').querySelector('[data-x="e"]');}));
await page.evaluate(()=>document.querySelector('#sAct [data-x="d"]').click());await H.sl(500);
T('supprimer depuis le menu : confirmation demandée (rien n’est supprimé tout de suite)',(await H.txt(page,'#sDlg')).includes('Supprimer ce vin ?')&&await page.evaluate(()=>document.querySelectorAll('#list .w').length)===2);
await H.tapText(page,'#dlgB button','Annuler');await H.sl(400);
await page.evaluate(()=>document.querySelector('#list .w .am').click());await H.sl(400);
await page.evaluate(()=>document.querySelector('#sAct [data-x="e"]').click());await H.sl(600);
T('modifier depuis le menu : le formulaire s’ouvre rempli',await page.evaluate(()=>document.querySelector('#sForm').classList.contains('show')&&document.querySelector('#f-name').value.startsWith('Vin')),'');
await page.evaluate(()=>document.querySelectorAll('.modal.show').forEach(m=>m.classList.remove('show')));

/* Erreurs : une seule à la fois, bouton vers les Réglages sur erreur de clé */
await H.tapText(page,'.tab','Ma cave');await H.sl(300);
await page.evaluate(()=>{window.dispatchEvent(new ErrorEvent('error',{message:'essai un'}));window.dispatchEvent(new ErrorEvent('error',{message:'essai deux'}));window.dispatchEvent(new ErrorEvent('error',{message:'essai deux'}));});await H.sl(300);
const nb=await page.evaluate(()=>document.querySelectorAll('#toasts .toast.err').length);
const tx=await H.txt(page,'#toasts');
T('erreurs : une seule bannière à la fois',nb===1,String(nb));
T('erreurs : la plus récente est gardée',tx.includes('essai deux')&&!tx.includes('essai un'),tx);
T('aucune erreur JavaScript de page',errs.length===0,errs.join(' / '));
S.out.forEach(l=>console.log(l));
console.log(`\n${S.out.filter(l=>l.startsWith('PASS')).length} réussis, ${S.out.filter(l=>l.startsWith('FAIL')).length} échec(s)`);
await b.close();srv.close?.();process.exit(S.out.some(l=>l.startsWith('FAIL'))?1:0);
