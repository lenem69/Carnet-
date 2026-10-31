// 1.41.0 : Worker « cave-stats » (réception quotidienne, API protégée, page du tableau de bord).
// La base D1 est simulée avec SQLite en mémoire ; aucun appel réel. La page du tableau est ensuite affichée dans le navigateur de test.
import {createRequire} from 'module';import path from 'path';import {pathToFileURL} from 'url';
import puppeteer from 'puppeteer-core';import * as H from './h.mjs';
const require=createRequire(import.meta.url);
const {DatabaseSync}=require('node:sqlite');
const {T,out}=H.suite('Worker statistiques');
const HERE=path.dirname(new URL(import.meta.url).pathname);
const worker=(await import(pathToFileURL(path.resolve(HERE,'..','relais','stats-worker.js')).href+'?t='+Date.now())).default;

// D1 simulée : prepare(sql).bind(...).run() / first() / all()
function d1(){const db=new DatabaseSync(':memory:');
  return {_db:db,prepare(sql){let args=[];const o={bind(...a){args=a;return o},async run(){db.prepare(sql).run(...args);return {success:true}},async first(){const r=db.prepare(sql).get(...args);return r?{...r}:null},async all(){return {results:db.prepare(sql).all(...args).map(r=>({...r}))}}};return o}}}
const env={STATS:d1(),ADMIN_KEY:'cle-de-test-0123456789-abcdef'};
const O='https://lenem69.github.io';
const jour=(dec=0)=>new Date(Date.now()+dec*864e5).toISOString().slice(0,10);
const body=(o={})=>({v:1,id:'abcdef0123',jour:jour(),app:'1.41.0',sem:jour(-10),o:'scan',vins:12,cles:1,sauv:3,n:{ouvertures:1,add_scan:2,conso:4,ia_ok:5,ia_limite:1,quoiboire:7},...o});
const post=(b,h={})=>worker.fetch(new Request('https://x.test/v1/jour',{method:'POST',headers:{Origin:O,'Content-Type':'text/plain;charset=UTF-8',...h},body:typeof b==='string'?b:JSON.stringify(b)}),env);
const get=(p,h={})=>worker.fetch(new Request('https://x.test'+p,{headers:h}),env);
const rows=()=>env.STATS._db.prepare('SELECT * FROM jours').all();

let r=await worker.fetch(new Request('https://x.test/v1/jour',{method:'OPTIONS',headers:{Origin:O}}),env);
T('préparation CORS : 204, origine de l’appli seulement',r.status===204&&r.headers.get('Access-Control-Allow-Origin')===O);
r=await post(body());let j=await r.json();
T('envoi valide : 200 et {ok:true}',r.status===200&&j.ok===true,JSON.stringify(j));
T('CORS sur la réponse (l’appli peut lire le résultat)',r.headers.get('Access-Control-Allow-Origin')===O);
T('une ligne enregistrée',rows().length===1&&rows()[0].id==='abcdef0123');
await post(body({n:{ouvertures:1,add_scan:2,conso:9}}));
T('même appareil, même jour : remplacé, pas dupliqué',rows().length===1&&JSON.parse(rows()[0].n).conso===9);
await post(body({id:'0123abcdef',jour:jour(-1)}));
T('autre appareil / autre jour : lignes séparées',rows().length===2);
r=await post(body(),{Origin:'https://autre.example'});
T('origine étrangère : refusée (403)',r.status===403&&(await r.json()).erreur==='origine_refusee');
r=await post(body({id:'Z;DROP TABLE'}));T('identifiant invalide : 400',r.status===400);
r=await post(body({jour:'2020-01-01'}));T('jour trop ancien : 400',r.status===400);
r=await post(body({jour:jour(5)}));T('jour dans le futur : 400',r.status===400);
r=await post('pas du json');T('JSON invalide : 400',r.status===400);
r=await post(body({junk:'x'.repeat(5000)}));T('requête trop grande : 413',r.status===413);
r=await post(body({id:'1111111111',n:{ouvertures:1,nom_du_vin:'Secretissime',conso:'abc',add_scan:-4,ia_ok:1e12}}));
const stocke=rows().find(x=>x.id==='1111111111');const n=JSON.parse(stocke.n);
T('champs inconnus jetés, valeurs absurdes ramenées à 0',!('nom_du_vin' in n)&&n.conso===0&&n.add_scan===0&&n.ia_ok===0&&n.ouvertures===1,JSON.stringify(n));
T('aucun nom de vin dans la base',!/Secretissime/.test(JSON.stringify(rows())));
await post(body({id:'2222222222',o:'pirate',app:'<script>'}),{'CF-Connecting-IP':'203.0.113.77','X-Forwarded-For':'203.0.113.77'});
const l2=rows().find(x=>x.id==='2222222222');
T('origine inconnue et version invalide neutralisées',l2.origine===''&&l2.app==='');
T('adresse IP jamais enregistrée',!/203\.0\.113\.77/.test(JSON.stringify(rows())));
r=await get('/api/resume');T('API sans clé : 401',r.status===401);
r=await get('/api/resume',{Authorization:'Bearer mauvaise-cle-mauvaise-cle'});T('API avec mauvaise clé : 401',r.status===401);
r=await worker.fetch(new Request('https://x.test/api/resume',{headers:{Authorization:'Bearer court'}}),{...env,ADMIN_KEY:'court'});
T('clé secrète trop courte côté Cloudflare : refus (500)',r.status===500&&(await r.json()).erreur==='cle_non_configuree');
r=await get('/api/resume',{Authorization:'Bearer '+env.ADMIN_KEY});const res=await r.json();
T('API avec la bonne clé : lignes et total',r.status===200&&res.total===4&&res.lignes.length===4&&res.aujourdhui===jour(),JSON.stringify(res).slice(0,200));
T('API : compteurs rendus en objet',res.lignes.every(x=>typeof x.n==='object')&&res.lignes.find(x=>x.id==='abcdef0123'&&x.jour===jour()).n.conso===9);
T('API : réponse non mise en cache et non indexable',/no-store/.test(r.headers.get('Cache-Control'))&&/noindex/.test(r.headers.get('X-Robots-Tag')));
r=await get('/tableau');const html=await r.text();
T('page du tableau : HTML, noindex, sans cache, CSP stricte',r.status===200&&/text\/html/.test(r.headers.get('Content-Type'))&&/noindex/.test(r.headers.get('X-Robots-Tag'))&&/no-store/.test(r.headers.get('Cache-Control'))&&/default-src 'none'/.test(r.headers.get('Content-Security-Policy')));
T('page du tableau : noindex et pas de référent dans le HTML',/name="robots" content="noindex,nofollow"/.test(html)&&/name="referrer" content="no-referrer"/.test(html));
T('page du tableau : aucune clé ni donnée dans le HTML',!html.includes(env.ADMIN_KEY)&&!/abcdef0123/.test(html));
r=await get('/nimporte');T('adresse inconnue : 404',r.status===404);
r=await worker.fetch(new Request('https://x.test/v1/jour',{method:'POST',headers:{Origin:O},body:'{}'}),{ADMIN_KEY:'x'});
T('base non liée : erreur claire (500)',r.status===500&&(await r.json()).erreur==='base_non_liee');

// Saturation : au-delà de 500 appareils par jour, un nouvel appareil est refusé, un appareil connu est encore accepté.
const env2={STATS:d1(),ADMIN_KEY:env.ADMIN_KEY};
env2.STATS._db.exec('CREATE TABLE IF NOT EXISTS jours (jour TEXT NOT NULL, id TEXT NOT NULL, app TEXT, sem TEXT, origine TEXT, vins INTEGER, cles INTEGER, sauv INTEGER, n TEXT, maj INTEGER, PRIMARY KEY (jour, id))');
await worker.fetch(new Request('https://x.test/v1/jour',{method:'POST',headers:{Origin:O},body:JSON.stringify(body({id:'00000aaaaa'}))}),env2);
env2.STATS._db.exec(`WITH RECURSIVE s(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM s WHERE i<500) INSERT INTO jours (jour,id,app,sem,origine,vins,cles,sauv,n,maj) SELECT '${jour()}', printf('%010x', i+100000), '', '', '', 0, 0, 0, '{}', 0 FROM s`);
let r3=await worker.fetch(new Request('https://x.test/v1/jour',{method:'POST',headers:{Origin:O},body:JSON.stringify(body({id:'ffffffffff'}))}),env2);
T('journée saturée : nouvel appareil refusé (429)',r3.status===429&&(await r3.json()).erreur==='sature');
r3=await worker.fetch(new Request('https://x.test/v1/jour',{method:'POST',headers:{Origin:O},body:JSON.stringify(body({id:'00000aaaaa'}))}),env2);
T('journée saturée : appareil déjà connu encore accepté',r3.status===200);

// Page du tableau de bord affichée dans le navigateur de test, avec les vraies réponses du Worker.
const b=await H.browser();const page=await b.newPage();
await page.setViewport({width:390,height:780,isMobile:true});
const errs=[];page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await page.setRequestInterception(true);
page.on('request',async rq=>{const u=new URL(rq.url());
  if(u.host==='tableau.test'){const rr=await worker.fetch(new Request('https://x.test'+u.pathname+u.search,{headers:rq.headers()}),env);
    rq.respond({status:rr.status,headers:Object.fromEntries(rr.headers),contentType:rr.headers.get('Content-Type')||'text/plain',body:await rr.text()})}
  else rq.abort()});
await page.goto('http://tableau.test/tableau');await H.sl(500);
T('tableau : demande la clé au premier passage',await page.evaluate(()=>!document.querySelector('#acces').hidden&&document.querySelector('#tab').hidden));
await page.type('#cle','mauvaise-cle-mauvaise-cle');await page.click('#ok');await H.sl(600);
T('tableau : clé refusée, message clair et clé oubliée',await page.evaluate(()=>/refusée/.test(document.querySelector('#err').textContent)&&!localStorage.getItem('cave-stats-cle')));
await page.$eval('#cle',e=>e.value='');await page.type('#cle',env.ADMIN_KEY);await page.click('#ok');await H.sl(800);
const txt=await page.evaluate(()=>document.querySelector('#tab').innerText);
T('tableau : affiché avec la bonne clé',await page.evaluate(()=>!document.querySelector('#tab').hidden&&document.querySelector('#acces').hidden));
T('tableau : chiffres clés (appareils actifs, total, ajoutés, bues)',/appareils actifs/.test(txt)&&/appareils au total/.test(txt)&&/vins ajoutés/.test(txt)&&/bouteilles bues/.test(txt),txt.slice(0,200));
T('tableau : sections attendues',['Appareils ayant ouvert','Santé de l’assistant IA','Fonctions utilisées','Comment les caves démarrent','Santé technique','Par appareil'].every(t=>txt.includes(t)),txt);
const k=await page.evaluate(()=>[...document.querySelectorAll('.k div')].map(d=>d.querySelector('b').textContent));
T('tableau : valeurs calculées justes (4 actifs sur 48 h, 4 au total, 6 vins ajoutés, 17 bouteilles bues)',JSON.stringify(k)===JSON.stringify(['4','4','6','17']),JSON.stringify(k));
T('tableau : rien d’identifiant (4 premiers caractères seulement)',!/abcdef0123/.test(txt)&&/abcd…/.test(txt));
T('tableau : pas de défilement horizontal en 390 px',await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
await page.reload();await H.sl(800);
T('tableau : la clé retenue évite de la redemander',await page.evaluate(()=>!document.querySelector('#tab').hidden));
T('aucune erreur dans la page',errs.length===0,errs.join('|'));
await b.close();
console.log(out.join('\n'));
