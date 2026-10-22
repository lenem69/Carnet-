import {start} from './server.mjs';import * as H from './h.mjs';
H.deploy('1.0.0');const srv=await start(8123);const b=await H.browser();
const {T,out}=H.suite('PWA');
const {page,errs}=await H.newPage(b);
await page.goto(H.URL0);await H.sl(1500);
const swOk=await page.evaluate(async()=>{const r=await navigator.serviceWorker.ready;return !!r.active});
T('service worker installé et actif',swOk);
const man=await page.evaluate(async()=>{const r=await fetch('manifest.webmanifest');const j=await r.json();const imgs=await Promise.all(j.icons.map(i=>fetch(i.src).then(r=>r.ok&&r.headers.get('content-type').includes('png'))));return {ok:j.display==='standalone'&&j.start_url==='./',imgs}});
T('manifeste valide (installable) + icônes présentes',man.ok&&man.imgs.every(Boolean),JSON.stringify(man));
// données de départ
await H.click(page,'#fab');await H.tapText(page,'#sMenu button','Saisie manuelle');await page.type('#f-name','Vin de référence');await H.click(page,'#f-save');await H.sl(400);
await page.reload();await H.sl(1000);
T('page contrôlée par le service worker',await page.evaluate(()=>!!navigator.serviceWorker.controller));
// hors connexion
await page.setOfflineMode(true);await page.reload();await H.sl(1500);
T('hors connexion : l’appli s’ouvre',(await H.txt(page,'#list')).includes('Vin de référence'));
await H.click(page,'#fab');await H.tapText(page,'#sMenu button','Saisie manuelle');await page.type('#f-name','Ajout hors ligne');await H.click(page,'#f-save');await H.sl(400);
T('hors connexion : ajout possible',(await H.txt(page,'#list')).includes('Ajout hors ligne'));
await H.click(page,'#fab');await H.pickFiles(page,()=>H.tapText(page,'#sMenu button','Importer un tableur'),['fixtures/test.xlsx']);await H.sl(1500);
T('hors connexion : import Excel (lecteur embarqué)',(await H.txt(page,'#toasts')).includes('ajouté'),await H.txt(page,'#toasts'));
await page.setOfflineMode(false);
// mise à jour : on publie la 1.0.1 (le serveur envoie Cache-Control max-age=600, comme GitHub Pages)
H.deploy('1.0.1');
await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update()});await H.sl(2500);
T('nouvelle version détectée : bandeau affiché',(await H.txt(page,'#updBar')).includes('Nouvelle version'),await H.txt(page,'#updBar'));
T('bandeau de mise à jour : collé en haut, pleine largeur, bouton visible',await page.evaluate(()=>{const u=document.querySelector('#updBar .upd').getBoundingClientRect(),b=document.querySelector('#updBar .btn').getBoundingClientRect();return u.top<=1&&u.width>=innerWidth-1&&b.height>=40&&getComputedStyle(document.querySelector('#updBar')).position==='sticky'}));
T('ancienne version toujours active avant accord',await page.evaluate(()=>self.APP_VERSION)==='1.0.0');
await page.evaluate(()=>document.querySelectorAll('.toast').forEach(t=>t.remove()));await H.click(page,'#updBar [data-b="upd"]');await H.sl(3000);
T('après « Mettre à jour » : version 1.0.1 chargée',await page.evaluate(()=>self.APP_VERSION)==='1.0.1',await page.evaluate(()=>self.APP_VERSION));
T('données intactes après mise à jour',(await H.txt(page,'#list')).includes('Vin de référence')&&(await H.txt(page,'#list')).includes('Ajout hors ligne'));
T('bandeau de mise à jour disparu',!(await H.txt(page,'#updBar')).includes('Nouvelle version'));
const caches=await page.evaluate(async()=>(await caches.keys()));T('ancien cache supprimé',caches.length===1&&caches[0]==='cave-1.0.1',JSON.stringify(caches));
await H.click(page,'#bSet');await H.sl(300);T('version visible dans Réglages',(await H.txt(page,'#st-ver'))==='1.0.1');
await H.click(page,'#st-upd');await H.sl(2500);T('« Vérifier les mises à jour » : à jour',(await H.txt(page,'#toasts')).includes('dernière version'),await H.txt(page,'#toasts'));
// hors connexion après mise à jour
await page.setOfflineMode(true);await page.reload();await H.sl(1500);
T('hors connexion avec la nouvelle version',await page.evaluate(()=>self.APP_VERSION)==='1.0.1'&&(await H.txt(page,'#list')).includes('Vin de référence'));
await page.setOfflineMode(false);
T('aucune erreur navigateur',errs.length===0,errs.join(' | '));
console.log(out.join('\n'));await b.close();srv.close();
