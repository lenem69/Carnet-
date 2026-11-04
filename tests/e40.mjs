// 1.44.1 : accueil (filtres région/lieu/couleur), effervescents, deux lieux, Que boire (quantité), Réglages en liste, partage et QR code.
import {start} from './server.mjs';import * as H from './h.mjs';
H.deploy();const srv=await start(8123);const b=await H.browser();
const S=H.suite('1.44.1');const T=S.T;
const {page,errs}=await H.newPage(b,{flat:false});
await page.goto(H.URL0+'manifest.webmanifest');
const Y=new Date().getFullYear();
const vins=[
 {id:'a',name:'Cuvée A',dom:'Dom A',year:2015,color:'Rouge',region:'Pauillac',qty:1,from:Y,to:Y+4,site:'Principale'},
 {id:'b',name:'Cuvée B',dom:'Dom B',year:2016,color:'Rouge',region:'Morgon',qty:15,from:Y,to:Y+4,site:'Secondaire'},
 {id:'c',name:'Blanc C',dom:'Dom C',year:2020,color:'Blanc',region:'Chablis',qty:2,from:Y,to:Y+6},
 {id:'d',name:'Brut Réserve',dom:'Maison D',year:2012,color:'Pétillant',region:'Champagne',qty:3,from:Y,to:Y+6,site:'Principale'},
 {id:'e',name:'Crémant E',dom:'Dom E',year:2021,color:'Pétillant',region:'Crémant de Loire',qty:2,from:Y,to:Y+3},
 {id:'f',name:'Pet nat F',dom:'Dom F',year:2022,color:'Pétillant',region:'Vin de France',qty:1,from:Y,to:Y+2}
];
await page.evaluate(v=>new Promise((res,rej)=>{const r=indexedDB.open('cave-a-vin',1);r.onupgradeneeded=()=>{r.result.createObjectStore('wines',{keyPath:'id'});r.result.createObjectStore('meta')};r.onsuccess=()=>{const t=r.result.transaction('wines','readwrite');const s=t.objectStore('wines');v.forEach(x=>s.put(x));t.oncomplete=()=>res();t.onerror=()=>rej(t.error)}}),vins);
await page.goto(H.URL0);await H.sl(2500);
const ch=await H.txt(page,'#chips');
T('puces : Tous, Rouge, Blanc, Rosé, Effervescent (jamais « Pétillant »)',/Tous/.test(ch)&&/Rouge/.test(ch)&&/Blanc/.test(ch)&&/Rosé/.test(ch)&&/Effervescent/.test(ch)&&!/Pétillant/.test(ch),ch);
T('barre de recherche sur toute la largeur',await page.evaluate(()=>{const q=document.querySelector('#q').getBoundingClientRect();const w=document.querySelector('#vCave').getBoundingClientRect();return q.width>=w.width-4}));
T('tri placé sous la recherche',await page.evaluate(()=>document.querySelector('#sort').getBoundingClientRect().top>document.querySelector('#q').getBoundingClientRect().bottom-2));
// effervescents
await H.click(page,'#chips [data-c="Pétillant"]');await H.sl(300);
const l1=await H.txt(page,'#list');
T('Effervescent : trois vins listés',/Brut Réserve/.test(l1)&&/Crémant E/.test(l1)&&/Pet nat F/.test(l1)&&!/Cuvée A/.test(l1),l1.slice(0,200));
const ch2=await H.txt(page,'#chips2');
T('types affichés : Champagne, Crémant, Mousseux',/Champagne/.test(ch2)&&/Crémant/.test(ch2)&&/Mousseux/.test(ch2),ch2);
await page.evaluate(()=>document.querySelector('#chips2 [data-k="Champagne"]').click());await H.sl(300);
const l2=await H.txt(page,'#list');
T('filtre Champagne : seulement le champagne',/Brut Réserve/.test(l2)&&!/Crémant E/.test(l2)&&!/Pet nat F/.test(l2),l2.slice(0,200));
await H.click(page,'#chips [data-c="Tous"]');await H.sl(300);
// régions
const reg=await page.evaluate(()=>[...document.querySelectorAll('#fReg option')].map(o=>o.textContent).join('|'));
T('sélecteur de région avec les grandes régions et leurs nombres',/Bordeaux/.test(reg)&&/Beaujolais|Bourgogne/.test(reg)&&/Toutes/.test(reg),reg);
await page.select('#fReg',await page.evaluate(()=>[...document.querySelectorAll('#fReg option')].find(o=>/Bordeaux/.test(o.textContent)).value));await H.sl(300);
const l3=await H.txt(page,'#list');
T('filtre région : Pauillac seul',/Cuvée A/.test(l3)&&!/Cuvée B/.test(l3),l3.slice(0,150));
await page.select('#fReg','');await H.sl(300);
// lieux
T('sélecteur de lieu visible (2 lieux)',await page.evaluate(()=>!document.querySelector('#fSite').hidden));
await page.select('#fSite','Secondaire');await H.sl(300);
const l4=await H.txt(page,'#list');
T('filtre lieu : seulement la résidence secondaire',/Cuvée B/.test(l4)&&!/Cuvée A/.test(l4)&&!/Blanc C/.test(l4),l4.slice(0,150));
await page.select('#fSite','');await H.sl(300);
// Que boire ?
await H.click(page,'.tab[data-t="boire"]');await H.sl(500);
let bl=await H.txt(page,'#blist');
T('Que boire : le nombre de bouteilles est affiché',/15 bouteilles/.test(bl)&&/1 bouteille\b/.test(bl),bl.slice(0,300));
const iA=bl.indexOf('Cuvée A'),iB=bl.indexOf('Cuvée B');
T('même fin de garde : le vin en 15 exemplaires passe avant celui en 1',iB>=0&&iA>=0&&iB<iA,bl.slice(0,300));
await page.select('#bsort','year');await H.sl(300);
bl=await H.txt(page,'#blist');
T('tri par millésime : le plus ancien en premier',bl.indexOf('Brut Réserve')<bl.indexOf('Cuvée A'),bl.slice(0,300));
await page.select('#bsort','qty');await H.sl(300);
bl=await H.txt(page,'#blist');
T('tri par nombre : Cuvée B (15) en tête',bl.indexOf('Cuvée B')<bl.indexOf('Cuvée A')&&bl.indexOf('Cuvée B')<bl.indexOf('Brut'),bl.slice(0,300));
await H.click(page,'.tab[data-t="cave"]');await H.sl(300);
// fiche : type d'effervescent automatique et lieu
await page.evaluate(()=>document.querySelector('#list .card, #list [data-id]').click());await H.sl(300);
await page.evaluate(()=>document.querySelector('#fab').click());await H.sl(300);
await H.tapText(page,'#sMenu button','Saisie manuelle');await H.sl(300);
await page.type('#f-name','Test');await page.select('#f-color','Pétillant');await page.type('#f-region','Champagne');await H.sl(300);
T('formulaire : choix de type visible pour un effervescent, déduit « Champagne »',await page.evaluate(()=>!document.querySelector('#f-spk-w').hidden&&/Champagne/.test(document.querySelector('#f-spk-n').textContent)),await H.txt(page,'#f-spk-n'));
await page.select('#f-spk','Mousseux');await H.sl(150);
T('correction manuelle prise en compte',/Choisi par vous/.test(await H.txt(page,'#f-spk-n')));
await page.select('#f-color','Rouge');await H.sl(150);
T('type masqué pour un autre vin',await page.evaluate(()=>document.querySelector('#f-spk-w').hidden));
T('champ Lieu présent',await page.evaluate(()=>!!document.querySelector('#f-site')));
await page.evaluate(()=>document.querySelector('#sForm .sx').click());await H.sl(500);
await page.evaluate(()=>{const d=document.querySelector('#sDlg.show');if(d){const bs=[...d.querySelectorAll('button')];(bs.find(x=>/Abandonner/.test(x.textContent))||bs[0]).click()}});await H.sl(400);
// Réglages en liste
await page.evaluate(()=>document.querySelector('#bSet').click());await H.sl(500);
T('Réglages : « L’esprit » en haut, « Partager » dans la liste',await page.evaluate(()=>{const v=e=>{const el=document.querySelector(e);return !!el&&el.getClientRects().length>0};return v('#st-esprit')&&v('#set-list')&&v('[data-go="partage"]')&&v('[data-go="ia"]')}));
T('Réglages : les détails sont cachés tant qu’une rubrique n’est pas ouverte',await page.evaluate(()=>document.querySelector('#ai-key').getClientRects().length===0&&document.querySelector('#st-erase').getClientRects().length===0));
const res=await page.evaluate(()=>[...document.querySelectorAll('.setrow .rs')].map(e=>e.textContent).join('|'));
T('chaque ligne a un résumé',/Aide offerte/.test(res)&&/Désactivées|Activées/.test(res)&&/6 vins/.test(res)&&/Version 1\.44\.1/.test(res),res);
await page.evaluate(()=>document.querySelector('[data-go="ia"]').click());await H.sl(250);
T('rubrique IA : champs visibles, liste masquée, titre de la rubrique, bouton retour',await page.evaluate(()=>document.querySelector('#ai-key').getClientRects().length>0&&document.querySelector('#set-list').getClientRects().length===0&&/IA/.test(document.querySelector('#stT').textContent)&&!document.querySelector('#set-back').hidden));
await page.evaluate(()=>document.querySelector('#set-back').click());await H.sl(250);
T('retour : la liste revient',await page.evaluate(()=>document.querySelector('#set-list').getClientRects().length>0&&document.querySelector('#ai-key').getClientRects().length===0));
await page.evaluate(()=>document.querySelector('[data-go="data"]').click());await H.sl(250);
T('rubrique Données : bouton d’effacement visible',await page.evaluate(()=>document.querySelector('#st-erase').getClientRects().length>0));
await page.evaluate(()=>history.back());await H.sl(400);
T('retour Android dans une rubrique : revient à la liste sans fermer les réglages',await H.shown(page,'#sSet')&&await page.evaluate(()=>document.querySelector('#set-list').getClientRects().length>0));
await page.evaluate(()=>document.querySelector('[data-go="data"]').click());await H.sl(250);
await page.evaluate(()=>document.querySelector('#sSet .sx').click());await H.sl(300);
T('croix dans une rubrique : revient à la liste, Réglages restent ouverts',await H.shown(page,'#sSet')&&await page.evaluate(()=>document.querySelector('#set-list').getClientRects().length>0));
// Partage et QR
const url=await page.evaluate(()=>document.querySelector('#set-share').dataset.url);
T('lien de partage = adresse de l’appli',url===H.URL0,url);
await page.evaluate(()=>{window.__shared=null;navigator.share=async d=>{window.__shared=d}});
await page.evaluate(()=>document.querySelector('#sh-send').click());await H.sl(300);
const sh=await page.evaluate(()=>window.__shared);
T('Envoyer par message : feuille de partage avec le lien',sh&&sh.url===H.URL0&&/Ma cave/.test(sh.text||sh.title),JSON.stringify(sh));
await page.evaluate(()=>{window.__clip=null;Object.defineProperty(navigator,'clipboard',{value:{writeText:async t=>{window.__clip=t}},configurable:true})});
await page.evaluate(()=>document.querySelector('#sh-copy').click());await H.sl(300);
T('Copier le lien : le lien est copié',(await page.evaluate(()=>window.__clip))===H.URL0);
await page.evaluate(()=>document.querySelector('#sh-qr').click());await H.sl(300);
T('QR en grand affiché avec l’adresse',await H.shown(page,'#sQr')&&await page.evaluate(()=>!!document.querySelector('#qr-big svg path')&&/localhost/.test(document.querySelector('#qr-url').textContent)));
const svg=await page.evaluate(()=>document.querySelector('#qr-big').innerHTML);
(await import('fs')).writeFileSync(new URL('.site/qr-test.svg',import.meta.url),svg);
T('aucun appel réseau externe pour le QR',!/https?:\/\/(?!www\.w3\.org)/.test(svg.replace(/xmlns="[^"]*"/,'')));
T('erreurs de page : aucune',errs.length===0,JSON.stringify(errs));
await b.close();srv.close?.();
console.log(S.out.join('\n'));
