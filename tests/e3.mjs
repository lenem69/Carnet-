import {start} from './server.mjs';import * as H from './h.mjs';import fs from 'fs';
H.deploy();const srv=await start(8123);const b=await H.browser();
const {T,out}=H.suite('Données');
const {page,errs}=await H.newPage(b);
await page.goto(H.URL0);await H.sl(1000);
const imp=async f=>{await H.click(page,'#fab');await H.pickFiles(page,()=>H.tapText(page,'#sMenu button','Importer un tableur'),[f]);};
// import 1000+
let t0=Date.now();await imp('fixtures/big.csv');await page.waitForFunction(()=>document.querySelector('#sB').innerText!=='0',{timeout:20000});const dt=Date.now()-t0;
T('import 1030 lignes : 1060 bouteilles, 1000 vins',(await H.txt(page,'#sB')).replace(/\s/g,'')==='1060',await H.txt(page,'#sB'));
T('import : message récapitulatif (doublons, à vérifier)',/1000 vin\(s\) ajouté\(s\), 30 doublon/.test(await H.txt(page,'#toasts')),await H.txt(page,'#toasts'));
T('import 1000 vins en moins de 8 s ('+dt+' ms)',dt<8000);
T('affichage paginé (100 cartes + Afficher plus)',(await page.$$('#list .w')).length===100&&(await H.txt(page,'#list')).includes('Afficher plus'));
await H.tapText(page,'#list button','Afficher plus');T('afficher plus : 200',(await page.$$('#list .w')).length===200);
t0=Date.now();await page.type('#q','cuvée 123');await H.sl(500);
T('recherche dans 1000 vins',(await page.$$('#list .w')).length>0&&(await page.$$('#list .w')).length<20,String((await page.$$('#list .w')).length));
await page.$eval('#q',e=>{e.value='';e.dispatchEvent(new Event('input'))});await H.sl(300);
await H.tapText(page,'#chips button','Blanc');const blanc=(await H.txt(page,'#chips'));T('filtre couleur avec compteurs',/Blanc \d+/.test(blanc));
await H.tapText(page,'#chips button','À vérifier');T('filtre À vérifier',(await page.$$('#list .w')).length>0);
await H.tapText(page,'#chips button','Tous');
await page.select('#sort','urgent');await H.sl(200);const first=await page.$eval('#list .w h4',e=>e.innerText);T('tri à boire en priorité',!!first);
await page.reload();await H.sl(1800);T('1000 vins rechargés',(await H.txt(page,'#sB')).replace(/\s/g,'')==='1060');
// import modèle xlsx + accents
await imp('fixtures/test.xlsx');await H.sl(1200);T('import xlsx : vins ajoutés',(await H.txt(page,'#toasts')).includes('ajouté'),await H.txt(page,'#toasts'));
// réimport avec des vins déjà en cave : choix proposé
{const q0=await page.evaluate(()=>[...document.querySelectorAll('#list .w')].length);
await H.sl(300);
fs.writeFileSync('.site/reimport.csv','Domaine;Cuvée;Millésime;Quantité\r\nDomaine 1;Cuvée 1;2011;2\r\nNouveau Domaine;Vin neuf unique;2019;5\r\n');
const sb0=(await H.txt(page,'#sB')).replace(/\s/g,'');
await imp('.site/reimport.csv');await H.sl(800);
const shown=await H.shown(page,'#sDlg');const dtx=await H.txt(page,'#dlgX');
T('réimport : boîte de choix (existants/nouveaux)',shown&&/déjà en cave/.test(dtx)&&(await H.txt(page,'#dlgB')).includes('seulement'),dtx);
await H.tapText(page,'#dlgB button','Annuler');await H.sl(500);
T('réimport annulé : rien modifié',(await H.txt(page,'#sB')).replace(/\s/g,'')===sb0&&(await H.txt(page,'#toasts')).includes('annulé'));
await imp('.site/reimport.csv');await H.sl(800);await H.tapText(page,'#dlgB button','seulement');await H.sl(1000);
T('réimport « seulement les nouveaux » : +5 bouteilles, existant inchangé',(await H.txt(page,'#sB')).replace(/\s/g,'')===String(+sb0+5)&&/déjà en cave \(inchangé\)/.test(await H.txt(page,'#toasts')),(await H.txt(page,'#sB'))+' '+(await H.txt(page,'#toasts')));
await imp('.site/reimport.csv');await H.sl(800);
T('réimport sans nouveau : pas de choix « seulement »',!(await H.txt(page,'#dlgB')).includes('seulement'));
await H.tapText(page,'#dlgB button','Additionner');await H.sl(1000);
T('réimport « additionner » : +7 bouteilles',(await H.txt(page,'#sB')).replace(/\s/g,'')===String(+sb0+12),await H.txt(page,'#sB'));
await page.evaluate(()=>document.querySelectorAll('.toast').forEach(t=>t.remove()));
}
// export CSV
await H.click(page,'#fab');await H.tapText(page,'#sMenu button','Exporter');await H.sl(800);
let dl=await page.evaluate(()=>window.__dl);const csv=dl.find(d=>d.name.endsWith('.csv'));
T('export CSV : fichier produit avec en-têtes et accents',csv&&csv.text.includes('Cuvée;')===false&&csv.text.includes('"Cuvée";"Domaine"')&&csv.text.includes('Lapierre'),csv&&csv.text.slice(0,120));
T('export CSV : 1000+ lignes',csv&&csv.text.split('\r\n').length>1000);
// sauvegarde (téléchargement)
await H.click(page,'#banners [data-b="bk"]');await page.waitForFunction(()=>window.__dl.some(d=>d.name.endsWith('.json')),{timeout:8000,polling:100}).catch(()=>{});dl=await page.evaluate(()=>window.__dl);const bk=dl.find(d=>d.name.endsWith('.json'));
T('sauvegarde : fichier JSON complet',bk&&JSON.parse(bk.text).wines.length>=1002,bk&&bk.name);
T('sauvegarde : bandeau disparaît',!(await H.txt(page,'#banners')).includes('sauvegarde'));
fs.writeFileSync('.site/backup-full.json',bk.text);
await page.reload();await H.sl(1500);T('date de sauvegarde mémorisée',!(await H.txt(page,'#banners')).includes('sauvegarde'));
// sauvegarde via partage (Drive)
await page.evaluate(()=>{window.__shared=null;navigator.canShare=()=>true;navigator.share=async d=>{window.__shared=d.files[0].name}});
await H.click(page,'#fab');await H.tapText(page,'#sMenu button','Sauvegarder');await H.sl(600);
T('sauvegarde : partage proposé (Drive)',(await page.evaluate(()=>window.__shared||'')).endsWith('.json')&&(await H.txt(page,'#toasts')).includes('Drive'));
await page.evaluate(()=>{navigator.share=async()=>{throw new DOMException('x','AbortError')}});
await H.click(page,'#fab');await H.tapText(page,'#sMenu button','Sauvegarder');await H.sl(500);
T('partage annulé : pas de faux succès',(await H.txt(page,'#toasts')).includes('annulée'));
// restauration v1 en fusion puis remplacement
const res=async(f,choice)=>{await H.click(page,'#fab');await H.pickFiles(page,()=>H.tapText(page,'#sMenu button','Restaurer'),[f]);await H.sl(500);if(choice)await H.tapText(page,'#dlgB button',choice);await H.sl(1200)};
await res('fixtures/bad.json');T('fichier invalide : message clair',(await H.txt(page,'#toasts')).includes('JSON illisible'));
await res('fixtures/backup-v1.json');T('restauration : choix proposé + lignes illisibles signalées',await H.shown(page,'#sDlg')&&(await H.txt(page,'#dlgX')).includes('1 ligne(s) illisible'));
await H.tapText(page,'#dlgB button','Ajouter seulement');await H.sl(800);
T('fusion : vins absents ajoutés',(await H.txt(page,'#toasts')).includes('ajouté(s) depuis la sauvegarde'));
await res('fixtures/backup-v1.json','Remplacer');
T('remplacement : cave = sauvegarde v1 (7 bouteilles)',(await H.txt(page,'#sB'))==='7',await H.txt(page,'#sB'));
T('ancienne fiche à vérifier conservée',(await H.txt(page,'#chips')).includes('À vérifier'));
await H.tapText(page,'#toasts button','Annuler');await H.sl(2500);
T('annuler la restauration : cave précédente revenue',(await H.txt(page,'#sB')).replace(/\s/g,'').length>=4,await H.txt(page,'#sB'));
await res('.site/backup-full.json','Remplacer');await page.reload();await H.sl(1500);
T('restauration complète persistée',(await H.txt(page,'#sB')).replace(/\s/g,'')!=='7');
// panne de stockage : pas de faux succès
await page.evaluate(()=>{const p=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){throw new DOMException('Quota','QuotaExceededError')}});
await H.click(page,'#fab');await H.tapText(page,'#sMenu button','Saisie manuelle');await page.type('#f-name','Vin quota');await H.click(page,'#f-save');await H.sl(500);
const tq=await H.txt(page,'#toasts');T('mémoire pleine : erreur explicite, pas de faux succès',tq.includes('PAS conservées')&&!tq.includes('✅'),tq);
// effacer tout
await page.reload();await H.sl(1500);
await H.click(page,'#bSet');await H.sl(500);T('réglages : infos de stockage',(await H.txt(page,'#st-info')).includes('vin(s) enregistré(s)'));
await H.click(page,'#st-erase');await H.tapText(page,'#dlgB button','Continuer');await H.sl(200);await H.tapText(page,'#dlgB button','Tout effacer');await H.sl(800);
T('effacer : double confirmation puis cave vide',(await H.txt(page,'#list')).includes('Bienvenue dans votre cave'));
await page.reload();await H.sl(1000);T('effacement persisté',(await H.txt(page,'#sB'))==='0');
// modèle de tableur
await H.click(page,'#fab');await H.tapText(page,'#sMenu button','Guide');await H.click(page,'#h-tpl');await H.sl(500);
dl=await page.evaluate(()=>window.__dl);T('modèle de tableur téléchargeable',dl.some(d=>d.name==='modele-cave.csv'&&d.text.includes('Confiance')));
T('aucune erreur navigateur ni boîte native',errs.filter(e=>!e.includes('QuotaExceeded')).length===0,errs.join(' | '));
console.log(out.join('\n'));await b.close();srv.close();
