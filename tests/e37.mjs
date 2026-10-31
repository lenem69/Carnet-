// 1.41.0 : statistiques quotidiennes vers le serveur de l'auteur (Worker cave-stats).
// Accord (nouveaux et anciens appareils), compteurs par jour, origine de la cave, envoi confirmé par le serveur, pannes, discrétion.
import fs from 'fs';import path from 'path';
import {start} from './server.mjs';import * as H from './h.mjs';
H.deploy();
// Version de test : formulaire hebdomadaire « configuré » (adresse fictive, jamais appelée pour de vrai) ; le serveur quotidien est simulé dans h.mjs.
const ap=path.join(path.dirname(new URL(import.meta.url).pathname),'.site','www','cave','app.js');
fs.writeFileSync(ap,fs.readFileSync(ap,'utf8').replace(/const STATS_POST = '[^']*';/,"const STATS_POST = 'https://docs.google.com/forms/d/e/TESTFORM/formResponse';").replace(/const STATS_ENTRY = '[^']*';/,"const STATS_ENTRY = 'entry.42';"));
const srv=await start(8123);const b=await H.browser();
const {T,out}=H.suite('Statistiques quotidiennes');
const meta=(page,k)=>page.evaluate(async k=>{const s=await import('./store.js');return s.getMeta(k)},k);
const setmeta=(page,k,v)=>page.evaluate(async(k,v)=>{const s=await import('./store.js');await s.setMeta(k,v)},k,v);
const jours=page=>page.evaluate(()=>window.__jours.map(j=>({...j,body:j.body?JSON.parse(j.body):null})));
const dlg=async page=>({show:await H.shown(page,'#sDlg'),t:await H.txt(page,'#dlgT'),x:await H.txt(page,'#dlgX')});
// Les pages d'un même navigateur partagent le stockage : on repart d'un appareil neuf (aucun accord, aucun compteur).
const fresh=async page=>{await page.goto(H.URL0);await H.sl(1200);
  await page.evaluate(async()=>{const s=await import('./store.js');for(const k of ['statsConsent','statsJour','statsId','stats','statsOrigine','statsJourEnvois','statsJourEtat','statsOuvJour','installAt','firstWineAt','satisfaction','ouverturesAvis'])await s.setMeta(k,null)});
  await page.reload();await H.sl(1500)};
async function mk(){const r=await H.newPage(b);await H.simulerFormulaires(r.page);return r}

// 1. Nouvel appareil : l'accord annonce l'envoi quotidien, puis l'envoi part avec une réponse lue
let {page,errs}=await mk();
await page.goto(H.URL0);await H.sl(1500);
let d=await dlg(page);
T('accord : envoi chaque jour annoncé, nombres seulement, adresse non enregistrée',d.show&&/Chaque jour/.test(d.x)&&/nombres/.test(d.x)&&/adresse n’est pas enregistrée/.test(d.x),d.x);
await H.tapText(page,'#dlgB button','Oui, aider');await H.sl(800);
T('accord quotidien enregistré en même temps',(await meta(page,'statsJour'))==='oui');
await H.click(page,'#fab');await H.tapText(page,'#sMenu button','Saisie manuelle');await page.type('#f-name','Château Secretissime');await H.click(page,'#f-save');await H.sl(1200);
await page.evaluate(async()=>{const S=await import('./stats.js');await S.sendDays({wines:1,iaKeys:0,daysSinceBackup:-1},true)});await H.sl(500);
let j=await jours(page);
T('un envoi vers le serveur de l’auteur, en POST',j.length>=1&&j.every(x=>x.method==='POST'&&/\/v1\/jour$/.test(x.url)),JSON.stringify(j.map(x=>x.url)));
const p=j[j.length-1].body;
T('charge utile : version 1, identifiant aléatoire, jour, compteurs',p&&p.v===1&&/^[0-9a-f]{10}$/.test(p.id)&&/^\d{4}-\d\d-\d\d$/.test(p.jour)&&p.n&&p.n.ouvertures===1&&p.n.add_manuel===1,JSON.stringify(p));
T('origine de la cave : saisie à la main',p&&p.o==='manuel',JSON.stringify(p));
T('aucun nom de vin ni adresse dans l’envoi',!/Secretissime/.test(JSON.stringify(j))&&!/\d+\.\d+\.\d+\.\d+/.test(JSON.stringify(j.map(x=>x.body))));
T('envoi sans cookies ni identifiants de session',j.every(x=>!/cookie|authorization/i.test(JSON.stringify(x.headers))));
const etat=await meta(page,'statsJourEtat');
T('état : dernier envoi réussi noté',etat&&etat.ok===true,JSON.stringify(etat));
const n0=(await jours(page)).length;
await page.evaluate(async()=>{const S=await import('./stats.js');await S.sendDays({wines:1,iaKeys:0,daysSinceBackup:-1},true)});await H.sl(400);
T('rien de neuf : pas de nouvel envoi (pas de doublon)',(await jours(page)).length===n0);
await page.evaluate(async()=>{const S=await import('./stats.js');S.track('conso');await new Promise(r=>setTimeout(r,500));await S.sendDays({wines:1,iaKeys:0,daysSinceBackup:-1},true)});await H.sl(400);
const j2=await jours(page);
T('un geste de plus : nouvel envoi avec le compteur à jour',j2.length===n0+1&&j2[j2.length-1].body.n.conso===1,JSON.stringify(j2[j2.length-1]&&j2[j2.length-1].body));
// aperçu
await page.evaluate(()=>document.querySelector('#bSet').click());await H.sl(500);
await H.click(page,'#st-stats-show');await H.sl(300);
const pv=await H.txt(page,'#dlgX');
T('aperçu : montre aussi ce qui part chaque jour et le dernier envoi réussi',/Chaque jour, vers le serveur de l’auteur/.test(pv)&&/"id":"[0-9a-f]{10}"/.test(pv)&&/Dernier envoi réussi/.test(pv),pv.slice(0,300));
T('aperçu : aucun nom de vin',!/Secretissime/.test(pv));
T('aucune erreur (nouvel appareil)',errs.length===0,errs.join('|'));
await page.close();

// 2. Panne du serveur : rien n'est noté envoyé, l'échec est dit dans l'aperçu, nouvel essai ensuite
({page,errs}=await mk());
await page.evaluateOnNewDocument(()=>{window.__JOUR_MODE='erreur'});
await fresh(page);
await H.tapText(page,'#dlgB button','Oui, aider');await H.sl(800);
await page.evaluate(async()=>{window.__JOUR_MODE='erreur';const S=await import('./stats.js');S.track('conso');await S.sendDays({wines:0,iaKeys:0,daysSinceBackup:-1},true)});await H.sl(400);
let et=await meta(page,'statsJourEtat');
T('serveur en erreur : échec noté, pas de faux succès',et&&et.ok===false&&et.code===500,JSON.stringify(et));
T('serveur en erreur : aucun jour marqué envoyé',Object.keys((await meta(page,'statsJourEnvois'))||{}).length===0);
await page.evaluate(async()=>{window.__JOUR_MODE='reseau';const S=await import('./stats.js');await S.sendDays({wines:0,iaKeys:0,daysSinceBackup:-1},true)});await H.sl(400);
et=await meta(page,'statsJourEtat');
T('réseau coupé : échec noté (code 0)',et&&et.ok===false&&et.code===0,JSON.stringify(et));
await page.evaluate(async()=>{window.__JOUR_MODE='ok';const S=await import('./stats.js');await S.sendDays({wines:0,iaKeys:0,daysSinceBackup:-1},true)});await H.sl(400);
T('serveur revenu : envoi réussi, jour marqué envoyé',((await meta(page,'statsJourEtat'))||{}).ok===true&&Object.keys((await meta(page,'statsJourEnvois'))||{}).length>=1);
await page.close();

// 3. Ancien appareil (accord hebdomadaire déjà donné) : une question, rien n'est envoyé avant la réponse
({page,errs}=await mk());
await page.evaluateOnNewDocument(()=>{window.__JOUR=true});
await fresh(page);
await setmeta(page,'statsConsent','oui');await setmeta(page,'statsId','abcdef0123');await setmeta(page,'statsJour',null);
await page.reload();await H.sl(1800);
d=await dlg(page);
T('ancien accord : la question de l’envoi quotidien s’affiche',d.show&&/récapitulatif chaque jour/i.test(d.t)&&/propre serveur/.test(d.x),JSON.stringify(d));
T('rien n’est envoyé avant la réponse',(await jours(page)).length===0);
await H.tapText(page,'#dlgB button','Non, rester hebdomadaire');await H.sl(500);
T('refus : envoi quotidien « non », accord hebdomadaire conservé',(await meta(page,'statsJour'))==='non'&&(await meta(page,'statsConsent'))==='oui');
await page.reload();await H.sl(1800);
T('refus : question non reposée, toujours rien d’envoyé',!(await dlg(page)).show&&(await jours(page)).length===0);
await setmeta(page,'statsJour',null);await page.reload();await H.sl(1800);
await H.tapText(page,'#dlgB button','Oui, chaque jour');await H.sl(1200);
T('acceptation : envoi quotidien « oui » et envoi réalisé',(await meta(page,'statsJour'))==='oui'&&(await jours(page)).length>=1);
T('aucune erreur (ancien appareil)',errs.length===0,errs.join('|'));
await page.close();

// 4. Retrait de l'accord : tout est effacé, rien n'est plus envoyé
({page,errs}=await mk());
await fresh(page);
await H.tapText(page,'#dlgB button','Oui, aider');await H.sl(600);
await page.evaluate(()=>document.querySelector('#bSet').click());await H.sl(500);
await page.tap('#st-stats');await H.sl(600);
T('arrêt : accord, envoi quotidien, origine et envois effacés',(await meta(page,'statsConsent'))==='non'&&(await meta(page,'statsJour'))==='non'&&!(await meta(page,'statsOrigine'))&&!(await meta(page,'statsJourEnvois')));
const avant=(await jours(page)).length;
await page.evaluate(async()=>{const S=await import('./stats.js');S.track('conso');await S.sendDays({wines:0,iaKeys:0,daysSinceBackup:-1},true)});await H.sl(300);
T('arrêt : plus aucun envoi',(await jours(page)).length===avant);
await page.close();

// 5. Origine de la cave : tableur, sauvegarde, scan ; jamais remplacée
({page,errs}=await mk());
await fresh(page);
await H.tapText(page,'#dlgB button','Oui, aider');await H.sl(600);
const orig=await page.evaluate(async()=>{const S=await import('./stats.js');const db=await import('./store.js');
  S.noteOrigine('sauvegarde');const a=await db.getMeta('statsOrigine');S.track('add_tableur',5);S.track('add_scan');await new Promise(r=>setTimeout(r,200));const c=await db.getMeta('statsOrigine');S.noteOrigine('n’importe quoi');return [a,c,await db.getMeta('statsOrigine')]});
T('origine : la première reste (sauvegarde), jamais remplacée',orig[0]==='sauvegarde'&&orig[1]==='sauvegarde'&&orig[2]==='sauvegarde',JSON.stringify(orig));
await page.close();

await b.close();srv.close();
console.log(out.join('\n'));
