import {start} from './server.mjs';import * as H from './h.mjs';
H.deploy();const srv=await start(8123);const b=await H.browser();
const {T,out}=H.suite('Base');
const {page,errs}=await H.newPage(b);
await page.goto(H.URL0);await H.sl(1200);
T('démarrage : cave vide affichée',(await H.txt(page,'#list')).includes('Votre cave est vide'));
{const t=await H.txt(page,'#list');T('cave vide : toutes les fonctions proposées (photos, tableur, restauration, guide)',['Scanner une étiquette','Importer des photos','Importer un tableur','Saisie manuelle','Restaurer une sauvegarde','Guide'].every(x=>t.includes(x)),t)}
T('version affichée côté page',await page.evaluate(()=>self.APP_VERSION)==='1.20.0');
{const q1=await H.txt(page,'#quoteText');const Q=await page.evaluate(async()=>(await import('./quotes.js')).QUOTES);
T('citation : affichée et issue de la liste (300)',Q.length===300&&Q.includes(q1)&&q1.length>10,q1);
T('citation : bloc visible sous l’en-tête',await page.$eval('.quote',e=>e.getBoundingClientRect().height>40)&&await page.evaluate(()=>document.querySelector('header.top').compareDocumentPosition(document.querySelector('.quote'))&4));
T('crédit en bas de page',(await H.txt(page,'.credit')).includes('Jean-François Morin'));
T('copyright en bas de la page d’accueil',(await H.txt(page,'.credit')).includes('Copyright appartenant à Jean-François Morin 2026'));
await page.evaluate(()=>document.querySelector('#bContact').click());await H.sl(300);
T('aide et contact : fenêtre ouverte depuis le bas de page',await H.shown(page,'#sContact'));
T('aide et contact : « Publier ma requête » est le premier bouton (par défaut), « Envoyer par message » le deuxième',await page.$$eval('#sContact .stack button',b=>b.map(x=>x.textContent.trim()).slice(0,2).join('|'))==='Publier ma requête|Envoyer par message (WhatsApp, SMS…)');
await page.evaluate(()=>document.querySelector('#ct-share').click());await H.sl(200);
T('aide et contact : message vide refusé',(await H.txt(page,'#toasts')).includes('Écrivez d’abord'));
await page.evaluate(()=>{window.__sh=null;navigator.share=async d=>{window.__sh=d}});
await page.$eval('#ct-msg',e=>{e.value='Le bouton + ne répond plus'});
await page.evaluate(()=>document.querySelector('#ct-share').click());await H.sl(300);
const sh=await page.evaluate(()=>window.__sh);
T('aide et contact : message partagé avec version et appareil, sans donnée de cave',!!sh&&sh.text.includes('[Bug]')&&sh.text.includes('Le bouton + ne répond plus')&&sh.text.includes('version 1.20.0')&&sh.text.includes('Appareil :')&&!/vin|bouteille/i.test(sh.text.replace('Ma cave','')),JSON.stringify(sh));
T('publier : message vide refusé',await page.evaluate(()=>{document.querySelector('#ct-msg').value='';document.querySelector('#ct-pub').click();return true})&&(await H.sl(200),(await H.txt(page,'#toasts')).includes('Écrivez d’abord')));
await page.$eval('#ct-msg',e=>{e.value='Le bouton + ne répond plus'});
await page.evaluate(()=>{window.__rf=window.fetch;window.__fx=[];window.fetch=(function(o){return function(u,i){if(String(u).includes('formResponse')){window.__fx.push({u:String(u),m:i&&i.method,mode:i&&i.mode,c:i&&i.credentials,b:i&&String(i.body)});return Promise.resolve(new Response(null))}return o.apply(this,arguments)}})(window.fetch)});
await page.evaluate(()=>document.querySelector('#ct-pub').click());await H.sl(400);
const fx=await page.evaluate(()=>window.__fx);
T('publier : envoi direct au formulaire Google, sans quitter l’appli (POST, sans cookies)',fx.length===1&&fx[0].u==='https://docs.google.com/forms/d/e/1FAIpQLSfOirVg2Xykiv6DvPS1jNM5NQJSpnW0ajhbdP1gD3bKap1QDw/formResponse'&&fx[0].m==='POST'&&fx[0].mode==='no-cors'&&fx[0].c==='omit',JSON.stringify(fx));
T('publier : champ « Votre message » rempli avec le message, la version et l’appareil',fx.length===1&&decodeURIComponent(fx[0].b.replace(/\+/g,' ')).startsWith('entry.1804718778=[Bug] Le bouton + ne répond plus')&&fx[0].b.includes('1.20.0'),fx[0]&&fx[0].b);
T('publier : confirmation affichée et fenêtre fermée',(await H.txt(page,'#toasts')).includes('Requête publiée')&&!(await H.shown(page,'#sContact')),await H.txt(page,'#toasts'));
await page.evaluate(()=>document.querySelector('#bContact').click());await H.sl(300);
T('publier : message effacé après envoi',(await page.$eval('#ct-msg',e=>e.value))==='');
await page.evaluate(()=>{window.fetch=()=>Promise.reject(new TypeError('Failed to fetch'))});
await page.$eval('#ct-msg',e=>{e.value='Second essai'});await page.evaluate(()=>document.querySelector('#ct-pub').click());await H.sl(400);
T('publier : réseau en échec → erreur explicite, message conservé, pas de faux succès',(await H.txt(page,'#toasts')).includes('Envoi impossible')&&(await page.$eval('#ct-msg',e=>e.value))==='Second essai'&&(await page.$eval('#ct-pub',e=>!e.disabled&&e.textContent==='Publier ma requête')),await H.txt(page,'#toasts'));
await page.evaluate(()=>{window.fetch=window.__rf});
const srcs=await page.evaluate(async()=>(await Promise.all(['app.js','index.html','sw.js','logic.js','ai.js'].map(f=>fetch(f).then(r=>r.text())))).join('\n'));
T('discrétion : aucune adresse mail dans le code publié',!/[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(srcs));
await page.evaluate(()=>document.querySelector('#sContact .close').click());await H.sl(300);
await page.evaluate(()=>document.querySelector('#bSet').click());await H.sl(300);
T('copyright dans les Réglages',(await H.txt(page,'#sSet')).includes('Copyright appartenant à Jean-François Morin 2026'));
await page.evaluate(()=>document.querySelector('#st-help').click());await H.sl(300);
T('aide et contact accessible depuis les Réglages',await H.shown(page,'#sContact')&&!(await H.shown(page,'#sSet')));
await page.evaluate(()=>document.querySelector('#sContact .close').click());await H.sl(300);
T('titre par défaut + crayon visible',(await H.txt(page,'#appTitle'))==='Ma cave'&&await page.$eval('#bTitle',e=>e.getBoundingClientRect().width>30));
await page.reload();await H.sl(1200);const q2=await H.txt(page,'#quoteText');T('citation : change à chaque ouverture',q2!==q1&&Q.includes(q2),q1+' / '+q2);
await H.click(page,'#bTitle');await H.sl(300);T('crayon : fenêtre de titre ouverte',await H.shown(page,'#sTitle'));
await page.type('#ti-in','La cave de Paul');await H.click(page,'#ti-save');await H.sl(600);
T('titre modifié affiché',(await H.txt(page,'#appTitle'))==='La cave de Paul',await H.txt(page,'#appTitle'));
await page.reload();await H.sl(1500);T('titre conservé après réouverture',(await H.txt(page,'#appTitle'))==='La cave de Paul');
await page.evaluate(()=>document.querySelectorAll('.toast').forEach(t=>t.remove()));
await H.click(page,'#bTitle');await H.sl(300);await H.click(page,'#ti-reset');await H.sl(600);
T('titre remis à « Ma cave »',(await H.txt(page,'#appTitle'))==='Ma cave');
await page.evaluate(()=>document.querySelectorAll('.toast').forEach(t=>t.remove()));}
T('bandeau sauvegarde absent si cave vide',(await H.txt(page,'#banners')).trim()==='');
// ajout manuel
await H.click(page,'#fab');T('menu ouvert',await H.shown(page,'#sMenu'));
await H.tapText(page,'#sMenu button','Saisie manuelle');T('formulaire ouvert, menu fermé',await H.shown(page,'#sForm')&&!(await H.shown(page,'#sMenu')));
await page.type('#f-name','Morgon');await page.type('#f-dom','Marcel Lapierre');await page.type('#f-year','2023');
await page.$eval('#f-qty',e=>e.value='');await page.type('#f-qty','3');await page.type('#f-price','18,50');
await page.type('#f-from','2025');await page.type('#f-to','2027');await page.type('#f-pairings','Poulet rôti, Charcuterie');
await H.click(page,'#f-save');await H.sl(400);
T('enregistrer : formulaire fermé',!(await H.shown(page,'#sForm')));
T('enregistrer : vin listé',(await H.txt(page,'#list')).includes('Morgon 2023'));
T('enregistrer : message de succès',(await H.txt(page,'#toasts')).includes('enregistré'));
T('stats : 3 bouteilles, valeur à estimer, 3 à boire vite',(await H.txt(page,'#sB'))==='3'&&(await H.txt(page,'#sV'))==='à estimer'&&(await H.txt(page,'#sD'))==='3',(await H.txt(page,'.stats')));
T('bandeau sauvegarde apparaît',(await H.txt(page,'#banners')).includes('Aucune sauvegarde'));
// persistance
await page.reload();await H.sl(1000);
T('persistance IndexedDB après rechargement',(await H.txt(page,'#list')).includes('Morgon 2023')&&(await H.txt(page,'#sB'))==='3');
// validations
await H.click(page,'#fab');await H.tapText(page,'#sMenu button','Saisie manuelle');
await H.click(page,'#f-save');T('nom vide : erreur claire, formulaire reste ouvert',(await H.txt(page,'#toasts')).includes('obligatoire')&&await H.shown(page,'#sForm'));
await page.type('#f-name','Test');await page.type('#f-from','2030');await page.type('#f-to','2025');await H.click(page,'#f-save');
T('garde incohérente refusée',(await H.txt(page,'#toasts')).includes('début de garde'));
await page.$eval('#f-from',e=>e.value='');await page.$eval('#f-to',e=>e.value='');await page.type('#f-price','abc');await H.click(page,'#f-save');
T('prix invalide refusé',(await H.txt(page,'#toasts')).includes('Prix invalide'));
await H.click(page,'#f-cancel');await H.sl(200);T('annuler ferme',!(await H.shown(page,'#sForm')));
// doublon
await H.click(page,'#fab');await H.tapText(page,'#sMenu button','Saisie manuelle');
await page.type('#f-name','morgon');await page.type('#f-dom','Marcel  Lapierre');await page.type('#f-year','2023');await H.click(page,'#f-save');await H.sl(200);
T('doublon détecté (casse/espaces)',await H.shown(page,'#sDlg')&&(await H.txt(page,'#dlgX')).includes('existe déjà'));
await H.tapText(page,'#dlgB button','Ajouter');await H.sl(400);
T('doublon : quantité additionnée (4)',(await page.$eval('#list .w .q b',e=>e.innerText))==='4'&&(await page.$$('#list .w')).length===1);
// +/- et persistance
await H.click(page,'#list .w [data-a="m"]');await H.click(page,'#list .w [data-a="m"]');await H.sl(900);
await page.reload();await H.sl(900);
{const v=await page.$eval('#list .w .q b',e=>e.innerText).catch(x=>'ERR '+x.message);T('boutons − persistés (2)',v==='2',v+' / cartes='+(await page.$$('#list .w')).length+' / '+(await page.evaluate(()=>document.querySelector('#list').innerText.slice(0,200))));}
// modifier
await H.click(page,'#list .w [data-a="e"]');T('modifier : champs remplis',(await page.$eval('#f-price',e=>e.value))==='18,5'&&(await page.$eval('#f-pairings',e=>e.value)).includes('Charcuterie'));
await page.type('#f-loc','Casier A');await H.click(page,'#f-save');await H.sl(300);
T('modifier : emplacement enregistré',(await H.txt(page,'#list')).includes('Casier A'));
// supprimer + annuler
await H.click(page,'#list .w [data-a="d"]');T('supprimer : confirmation dans l’appli',await H.shown(page,'#sDlg'));
await H.tapText(page,'#dlgB button','Supprimer');await H.sl(300);
T('supprimer : vin retiré',(await H.txt(page,'#list')).includes('Votre cave est vide'));
await H.tapText(page,'#toasts button','Annuler');await H.sl(400);
T('annuler la suppression',(await H.txt(page,'#list')).includes('Morgon'));
await page.reload();await H.sl(900);T('annulation persistée',(await H.txt(page,'#list')).includes('Morgon'));
// bouton retour Android : ferme la fenêtre au lieu de quitter
await H.click(page,'#fab');await H.tapText(page,'#sMenu button','Saisie manuelle');await page.type('#f-name','Brouillon');
await page.goBack();await H.sl(400);
T('retour : ferme la fiche sans quitter l’appli',!(await H.shown(page,'#sForm'))&&page.url().startsWith(H.URL0),page.url());
await H.click(page,'#fab');await H.sl(100);await page.goBack();await H.sl(300);T('retour : ferme le menu',!(await H.shown(page,'#sMenu')));
// petit écran : bouton enregistrer visible
await page.setViewport({width:320,height:568,isMobile:true,hasTouch:true,deviceScaleFactor:2});
await H.click(page,'#fab');await H.tapText(page,'#sMenu button','Saisie manuelle');await H.sl(200);
const r=await page.evaluate(()=>{const b=document.getElementById('f-save').getBoundingClientRect();return {bottom:b.bottom,vh:innerHeight,hit:document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)?.id}});
T('320×568 : Enregistrer visible et cliquable',r.bottom<=r.vh&&r.hit==='f-save',JSON.stringify(r));
await page.screenshot({path:'.site/shot-form-320.png'});
const ov=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);T('pas de défilement horizontal',!ov);
T('aucune erreur navigateur ni boîte native',errs.length===0,errs.join(' | '));
console.log(out.join('\n'));await b.close();srv.close();
