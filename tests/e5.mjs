import {start} from './server.mjs';import * as H from './h.mjs';
H.deploy();const srv=await start(8123);const b=await H.browser();
const {T,out}=H.suite('Robustesse');
// 1. migration : anciennes fiches sans schéma (prix texte, couleur minuscule, champs manquants)
let {page,errs}=await H.newPage(b);
await page.goto(H.URL0+'manifest.webmanifest');
await page.evaluate(()=>new Promise((res,rej)=>{const r=indexedDB.open('cave-a-vin',1);r.onupgradeneeded=()=>{r.result.createObjectStore('wines',{keyPath:'id'});r.result.createObjectStore('meta')};r.onsuccess=()=>{const t=r.result.transaction('wines','readwrite');const s=t.objectStore('wines');s.put({id:'old1',name:'Ancien',color:'rouge',price:'12,5',qty:'2',pairings:'Poulet, Gibier'});s.put({id:'old2',year:2020});t.oncomplete=()=>{r.result.close();res()}};r.onerror=rej}));
await page.goto(H.URL0);await H.sl(1500);
T('migration : ancienne fiche normalisée',(await H.txt(page,'#list')).includes('Ancien')&&(await H.txt(page,'#sB'))==='2'&&(await H.txt(page,'#list')).includes('Rouge'));
T('migration : fiche sans nom écartée sans plantage',(await page.$$('#list .w')).length===1);
const meta=await page.evaluate(()=>new Promise(res=>{const r=indexedDB.open('cave-a-vin',1);r.onsuccess=()=>{const g=r.result.transaction('meta').objectStore('meta').get('schema');g.onsuccess=()=>res(g.result)}}));
T('migration : version de schéma enregistrée',meta===12,String(meta));
// Fenêtre de garde inversée (début après fin) : remise dans l'ordre au chargement, sans qu'un vin soit à la fois « À garder » et « Passé »
await page.evaluate(()=>new Promise((res,rej)=>{const r=indexedDB.open('cave-a-vin',1);r.onsuccess=()=>{const t=r.result.transaction(['wines','meta'],'readwrite');t.objectStore('wines').put({id:'inv',name:'Inversé',dom:'D',year:2015,color:'Rouge',region:'Zzz',qty:1,from:2031,to:2024,src:{from:'ai',to:'bible'},created:1,updated:1});t.objectStore('meta').put(10,'schema');t.oncomplete=()=>res();t.onerror=()=>rej(t.error)}}));
await page.reload();await H.sl(1500);
const inv=await page.evaluate(()=>new Promise(res=>{const r=indexedDB.open('cave-a-vin',1);r.onsuccess=()=>{const g=r.result.transaction('wines').objectStore('wines').get('inv');g.onsuccess=()=>res(g.result)}}));
T('migration : fenêtre de garde inversée remise dans l’ordre',!!inv&&inv.from===2024&&inv.to===2031,JSON.stringify(inv&&[inv.from,inv.to]));
const cartes=await H.txt(page,'#list');
T('fiche à fenêtre inversée : jamais « À garder » et « Passé » ensemble',cartes.includes('Inversé')&&!(cartes.includes('À garder')&&cartes.includes('Passé')),cartes.slice(0,200));
T('aucune erreur (migration)',errs.length===0,errs.join('|'));
await page.close();
// 2. stockage refusé (navigation privée stricte) : mode secours + avertissement
({page,errs}=await H.newPage(b));
await page.evaluateOnNewDocument(()=>{Object.defineProperty(window,'indexedDB',{get(){throw new Error('bloqué')}})});
await page.goto(H.URL0);await H.sl(1200);
T('stockage refusé : avertissement visible',(await H.txt(page,'#banners')).includes('Stockage indisponible'));
await H.click(page,'#fab');await H.tapText(page,'#sMenu button','Saisie manuelle');await page.type('#f-name','Vin temporaire');await H.click(page,'#f-save');await H.sl(400);
T('stockage refusé : l’appli reste utilisable',(await H.txt(page,'#list')).includes('Vin temporaire'));
T('aucune erreur (secours)',errs.length===0,errs.join('|'));
await page.close();
// 3. contenu hostile dans un import (injection HTML)
({page,errs}=await H.newPage(b));
await page.goto(H.URL0);await H.sl(1000);
await page.evaluate(async()=>{const s=await import('./store.js');await s.putWines([{id:'x',name:'<img src=x onerror=alert(1)>',dom:'"><b>',qty:1,color:'Rouge',pairings:['<script>'],year:'',region:'',grape:'',price:'',loc:'',from:'',to:'',story:'',note:'',check:false,conf:'',created:1,updated:1}])});
await page.reload();await H.sl(1200);
T('texte affiché tel quel, jamais exécuté',(await H.txt(page,'#list')).includes('<img src=x')&&!(await page.$('#list img')));
T('aucune boîte native déclenchée',errs.length===0,errs.join('|'));
// 4. rendu visuel
await page.evaluate(async()=>{const s=await import('./store.js');const L=await import('./logic.js');const w=[
 {name:'Morgon',dom:'Marcel Lapierre',year:2023,color:'Rouge',region:'Beaujolais',grape:'Gamay',qty:6,price:22,loc:'Casier A',from:2025,to:2027,pairings:['Poulet rôti','Charcuterie'],story:'Cuvée emblématique.',conf:'vérifiée'},
 {name:'Chassagne-Montrachet',dom:'Paul Jouard',year:2024,color:'Blanc',grape:'Chardonnay',qty:1,price:58,from:2027,to:2033,check:true,conf:'estimée'},
 {name:'Champagne Brut',dom:'Maison X',color:'Pétillant',qty:0}].map(L.normalizeWine);await s.replaceAll(w)});
await page.reload();await H.sl(1200);
await page.screenshot({path:'.site/shot-light.png'});
await page.emulateMediaFeatures([{name:'prefers-color-scheme',value:'dark'}]);await H.sl(200);await page.screenshot({path:'.site/shot-dark.png'});
await H.click(page,'#fab');await H.sl(200);await page.screenshot({path:'.site/shot-menu-dark.png'});
console.log(out.join('\n'));await b.close();srv.close();
