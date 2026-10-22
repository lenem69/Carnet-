import {start} from './server.mjs';import * as H from './h.mjs';
H.deploy();const srv=await start(8123);const b=await H.browser();
const {T,out}=H.suite('Base');
const {page,errs}=await H.newPage(b);
await page.goto(H.URL0);await H.sl(1200);
T('démarrage : cave vide affichée',(await H.txt(page,'#list')).includes('Votre cave est vide'));
T('version affichée côté page',await page.evaluate(()=>self.APP_VERSION)==='1.0.0');
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
T('stats : 3 bouteilles, 56 €, 3 à boire vite',(await H.txt(page,'#sB'))==='3'&&(await H.txt(page,'#sV')).replace(/\s/g,'').startsWith('56')&&(await H.txt(page,'#sD'))==='3',(await H.txt(page,'.stats')));
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
await H.click(page,'#list .w [data-a="m"]');await H.click(page,'#list .w [data-a="m"]');await H.sl(300);
await page.reload();await H.sl(900);
T('boutons − persistés (2)',(await page.$eval('#list .w .q b',e=>e.innerText))==='2');
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
