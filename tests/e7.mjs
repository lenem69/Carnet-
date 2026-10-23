import fs from 'fs';import path from 'path';
import {start} from './server.mjs';import * as H from './h.mjs';
H.deploy();
// Version de test : formulaire de statistiques « configuré » (adresse fictive, jamais appelée pour de vrai)
const ap=path.join(path.dirname(new URL(import.meta.url).pathname),'.site','www','cave','app.js');
let src=fs.readFileSync(ap,'utf8');
src=src.replace(/const STATS_POST = '[^']*';/,"const STATS_POST = 'https://docs.google.com/forms/d/e/TESTFORM/formResponse';").replace(/const STATS_ENTRY = '[^']*';/,"const STATS_ENTRY = 'entry.42';");
fs.writeFileSync(ap,src);
const srv=await start(8123);const b=await H.browser();
const {T,out}=H.suite('Statistiques');
const RE=/^v1\|[0-9a-f]{10}\|\d{4}-\d\d-\d\d\|1.14.0\|\d{4}-\d\d-\d\d\|(-?\d+\|){23}-?\d+$/;
async function mk(){const r=await H.newPage(b);
  await r.page.evaluateOnNewDocument(()=>{window.__posts=[];window.__fail=false;const of=window.fetch;
    window.fetch=async(i,init={})=>{const u=typeof i==='string'?i:i.url;
      if(/forms\/d\/e\/TESTFORM\/formResponse/.test(u)){if(window.__fail)throw new TypeError('offline');window.__posts.push({u,m:init.method,body:String(init.body),mode:init.mode,cred:init.credentials});return new Response('',{status:200})}
      return of(i,init)}});
  return r}
const meta=(page,k)=>page.evaluate(async k=>{const s=await import('./store.js');return s.getMeta(k)},k);
const setmeta=(page,k,v)=>page.evaluate(async(k,v)=>{const s=await import('./store.js');await s.setMeta(k,v)},k,v);
const past={weeks:{'2020-01-06':{n:{ouvertures:3,add_scan:2,conso:1,ia_ok:4},d:['2020-01-07','2020-01-09']}},sent:[]};

// 1. refus : la question n'apparaît qu'une fois, rien n'est compté ni envoyé
let {page,errs}=await mk();
await page.goto(H.URL0);await H.sl(1500);
T('accord demandé à la première ouverture',(await H.shown(page,'#sDlg'))&&(await H.txt(page,'#dlgT')).includes('Aider'));
T('texte : pas de nom de vin, photos ni clés',/Jamais le nom de vos vins/.test(await H.txt(page,'#dlgX')));
await H.tapText(page,'#dlgB button','Non merci');await H.sl(300);
T('refus enregistré',(await meta(page,'statsConsent'))==='non');
T('refus : aucun identifiant',!(await meta(page,'statsId')));
await page.evaluate(async()=>{const S=await import('./stats.js');S.track('conso');S.track('ouvertures')});await H.sl(600);
T('refus : rien n’est compté',JSON.stringify(await meta(page,'stats')||{weeks:{}}).indexOf('conso')<0);
await page.reload();await H.sl(1500);
T('refus : la question ne revient pas',!(await H.shown(page,'#sDlg')));
await H.click(page,'#bSet');await H.sl(200);
T('réglages : case décochée',(await page.$eval('#st-stats',e=>e.checked))===false);
T('refus : aucun envoi',(await page.evaluate(()=>window.__posts.length))===0);
T('aucune erreur (refus)',errs.length===0,errs.join('|'));
await page.close();

// 2. accord : compteurs, ligne de 29 champs, aperçu, aucun contenu
({page,errs}=await mk());
await page.goto(H.URL0);await H.sl(1200);
await setmeta(page,'statsConsent',null);await page.reload();await H.sl(1500);
await H.tapText(page,'#dlgB button','Oui, aider');await H.sl(300);
T('accord enregistré',(await meta(page,'statsConsent'))==='oui');
T('identifiant aléatoire de 10 caractères',/^[0-9a-f]{10}$/.test(await meta(page,'statsId')||''));
await H.click(page,'#fab');await H.tapText(page,'#sMenu button','Saisie manuelle');await page.type('#f-name','Château Secretissime');await H.click(page,'#f-save');await H.sl(1200);
await page.evaluate(()=>document.querySelector('#bSet').click());await H.sl(500);
T('réglages : case cochée et bloc visible',(await page.$eval('#st-stats',e=>e.checked))&&(await page.$eval('#st-stats-w',e=>!e.hidden)));
await H.click(page,'#st-stats-show');await H.sl(300);
const pv=await H.txt(page,'#dlgX');const line=(pv.match(/v1\|\S+/)||[''])[0];
T('aperçu : ligne de 29 champs valide',RE.test(line),line);
T('aperçu : un vin ajouté à la main compté',line.split('|')[11]==='1'&&line.split('|')[7]==='1',line);
T('aperçu : aucun nom de vin',!/Secretissime/.test(pv));
const raw=JSON.stringify(await meta(page,'stats'));
T('stockage : aucun nom de vin',!/Secretissime/.test(raw));
T('aucun envoi pendant la semaine en cours',(await page.evaluate(()=>window.__posts.length))===0);
T('aucune erreur (accord)',errs.length===0,errs.join('|'));

// 3. envoi hebdomadaire : semaines passées seulement, une seule fois
await setmeta(page,'stats',past);
await page.reload();await H.sl(1800);
let posts=await page.evaluate(()=>window.__posts);
T('semaine passée envoyée une fois',posts.length===1,JSON.stringify(posts));
T('envoi : POST sans cookies ni retour',posts[0]&&posts[0].m==='POST'&&posts[0].mode==='no-cors'&&posts[0].cred==='omit');
const sent=posts[0]?decodeURIComponent(posts[0].body.replace(/\+/g,' ')).replace(/^entry\.42=/,''):'';
T('envoi : champ et format',posts[0]&&posts[0].body.startsWith('entry.42=')&&RE.test(sent),sent);
const f=sent.split('|');
T('envoi : compteurs de la semaine passée',f[2]==='2020-01-06'&&f[5]==='2'&&f[6]==='3'&&f[8]==='2'&&f[12]==='1'&&f[18]==='4',sent);
await page.reload();await H.sl(1500);
T('pas de doublon au rechargement',(await page.evaluate(()=>window.__posts.length))===0);
T('semaine marquée envoyée',((await meta(page,'stats')).sent||[]).includes('2020-01-06'));

// 4. hors connexion / échec : réessai à l'ouverture suivante
await setmeta(page,'stats',{weeks:{'2020-01-13':{n:{ouvertures:1},d:[]}},sent:[]});
await page.evaluateOnNewDocument(()=>{window.__fail=true});
await page.reload();await H.sl(1500);
T('échec réseau : rien d’envoyé, rien de perdu',(await page.evaluate(()=>window.__posts.length))===0&&!((await meta(page,'stats')).sent||[]).includes('2020-01-13'));
T('échec réseau : aucun message d’erreur gênant',errs.length===0,errs.join('|'));
await page.close();
({page,errs}=await mk());
await page.goto(H.URL0);await H.sl(1800);
posts=await page.evaluate(()=>window.__posts);
T('réessai réussi à l’ouverture suivante',posts.length===1&&/2020-01-13/.test(decodeURIComponent(posts[0].body)));

// 5. arrêt depuis les réglages : tout est effacé
await H.click(page,'#bSet');await H.sl(200);
await page.tap('#st-stats');await H.sl(500);
T('arrêt : accord retiré, identifiant et compteurs effacés',(await meta(page,'statsConsent'))==='non'&&!(await meta(page,'statsId'))&&Object.keys((await meta(page,'stats')).weeks).length===0);
T('aucune erreur (arrêt)',errs.length===0,errs.join('|'));
await page.close();
console.log(out.join('\n'));await b.close();srv.close();
