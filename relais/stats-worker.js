/* Statistiques de « Ma cave » : Cloudflare Worker (gratuit) + base D1.
   Reçoit, une fois par jour et par appareil, des COMPTEURS anonymes (jamais de nom de vin, de photo, de clé ni d'adresse).
   L'adresse IP n'est ni lue ni enregistrée. Le tableau de bord (/tableau) est protégé par le secret « ADMIN_KEY ».
   Réglages Cloudflare : une base D1 liée sous le nom « STATS » ; un secret « ADMIN_KEY » (au moins 20 caractères).
   Rien de ce fichier n'est secret : aucune clé, aucune donnée. */
const ORIGINE = 'https://lenem69.github.io';
const MAX_CORPS = 4000;      // octets de requête au plus
const MAX_APPAREILS_JOUR = 500;
const CHAMPS = ['ouvertures', 'add_scan', 'add_photos', 'add_tableur', 'add_manuel', 'conso', 'fiches_ia', 'fiches_verif', 'quoiboire', 'plat',
  'ia_ok', 'ia_limite', 'ia_cle', 'ia_reseau', 'ia_relais', 'err_stockage', 'err_enreg', 'err_import', 'aide'];
const ORIGINES = ['', 'tableur', 'sauvegarde', 'scan', 'manuel'];

const cors = { 'Access-Control-Allow-Origin': ORIGINE, 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' };
const json = (obj, status = 200, extra = {}) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', ...extra } });

let tableOk = null;
function preparer(env) {
  if (!tableOk) {
    tableOk = env.STATS.prepare('CREATE TABLE IF NOT EXISTS jours (jour TEXT NOT NULL, id TEXT NOT NULL, app TEXT, sem TEXT, origine TEXT, vins INTEGER, cles INTEGER, sauv INTEGER, n TEXT, maj INTEGER, PRIMARY KEY (jour, id))').run()
      .catch(e => { tableOk = null; throw e; });
  }
  return tableOk;
}

const jourUTC = (d = new Date()) => d.toISOString().slice(0, 10);
const entier = (v, max) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 && n <= max ? n : 0; };

async function recevoir(req, env) {
  const origine = req.headers.get('Origin');
  if (origine && origine !== ORIGINE) return json({ ok: false, erreur: 'origine_refusee' }, 403, cors);
  const texte = await req.text();
  if (texte.length > MAX_CORPS) return json({ ok: false, erreur: 'trop_gros' }, 413, cors);
  let d;
  try { d = JSON.parse(texte); } catch (e) { return json({ ok: false, erreur: 'json_invalide' }, 400, cors); }
  if (!d || d.v !== 1 || typeof d.id !== 'string' || !/^[0-9a-f]{8,16}$/.test(d.id)) return json({ ok: false, erreur: 'appareil_inconnu' }, 400, cors);
  if (typeof d.jour !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d.jour)) return json({ ok: false, erreur: 'jour_invalide' }, 400, cors);
  const ecart = (Date.parse(d.jour) - Date.parse(jourUTC())) / 864e5;
  if (!(ecart >= -4 && ecart <= 1)) return json({ ok: false, erreur: 'jour_hors_limites' }, 400, cors);
  const app = typeof d.app === 'string' && /^\d{1,2}\.\d{1,3}\.\d{1,3}$/.test(d.app) ? d.app : '';
  const sem = typeof d.sem === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.sem) ? d.sem : '';
  const o = ORIGINES.includes(d.o) ? d.o : '';
  const n = {};
  for (const k of CHAMPS) n[k] = entier(d.n && d.n[k], 100000);
  try {
    await preparer(env);
    const deja = await env.STATS.prepare('SELECT COUNT(*) AS c FROM jours WHERE jour = ?').bind(d.jour).first();
    const existe = await env.STATS.prepare('SELECT 1 AS x FROM jours WHERE jour = ? AND id = ?').bind(d.jour, d.id).first();
    if (!existe && deja && deja.c >= MAX_APPAREILS_JOUR) return json({ ok: false, erreur: 'sature' }, 429, cors);
    await env.STATS.prepare('INSERT INTO jours (jour, id, app, sem, origine, vins, cles, sauv, n, maj) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ' +
      'ON CONFLICT(jour, id) DO UPDATE SET app = excluded.app, sem = excluded.sem, origine = excluded.origine, vins = excluded.vins, cles = excluded.cles, sauv = excluded.sauv, n = excluded.n, maj = excluded.maj')
      .bind(d.jour, d.id, app, sem, o, entier(d.vins, 100000), entier(d.cles, 20), Math.round(Number(d.sauv)) >= -1 ? Math.min(3650, Math.round(Number(d.sauv))) : -1, JSON.stringify(n), Date.now()).run();
  } catch (e) { return json({ ok: false, erreur: 'base_indisponible' }, 500, cors); }
  return json({ ok: true }, 200, cors);
}

function egal(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function resume(req, env) {
  const cle = env.ADMIN_KEY || '';
  if (cle.length < 20) return json({ erreur: 'cle_non_configuree' }, 500);
  const donne = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!egal(donne, cle)) return json({ erreur: 'acces_refuse' }, 401);
  try {
    await preparer(env);
    const depuis = jourUTC(new Date(Date.now() - 20 * 864e5));
    const r = await env.STATS.prepare('SELECT jour, id, app, sem, origine, vins, cles, sauv, n, maj FROM jours WHERE jour >= ? ORDER BY jour, id').bind(depuis).all();
    const t = await env.STATS.prepare('SELECT COUNT(DISTINCT id) AS c FROM jours').first();
    const lignes = (r.results || []).map(x => ({ ...x, n: (() => { try { return JSON.parse(x.n); } catch (e) { return {}; } })() }));
    return json({ aujourdhui: jourUTC(), total: t ? t.c : 0, lignes });
  } catch (e) { return json({ erreur: 'base_indisponible' }, 500); }
}

const PAGE = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><meta name="color-scheme" content="light dark"><title>Ma cave en chiffres</title>
<style>
:root{--bg:#f6f5f1;--card:#fff;--ink:#1c1b19;--mut:#6b6a64;--line:#e3e1d9;--bar:#2a78d6;--ok:#1baf7a;--warn:#eda100;--net:#eb6834;--bad:#e34948}
@media(prefers-color-scheme:dark){:root{--bg:#161615;--card:#1f1f1d;--ink:#f0efec;--mut:#a9a89f;--line:#33322f;--bar:#3987e5}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,sans-serif;padding:14px;max-width:560px;margin-inline:auto}
h1{font-size:19px;font-weight:600;margin:0 0 2px}h2{font-size:14px;font-weight:600;margin:0 0 8px;color:var(--mut)}
.up{font-size:12px;color:var(--mut);margin:0 0 12px}.k{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}
.k div,.c{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px}.c{margin-bottom:12px}
.k b{display:block;font-size:24px;font-weight:600;font-variant-numeric:tabular-nums}.k span{font-size:12px;color:var(--mut)}
.row{display:flex;align-items:center;gap:8px;margin:6px 0;font-size:13px}.row .n{width:104px;color:var(--mut)}
.row .b{flex:1;height:8px;background:var(--line);border-radius:4px;overflow:hidden}.row .b i{display:block;height:100%;border-radius:4px}
.row .v{width:36px;text-align:right;font-variant-numeric:tabular-nums}
.dev{display:flex;justify-content:space-between;gap:8px;padding:8px 0;border-top:1px solid var(--line);font-size:13px}.dev:first-of-type{border-top:0}.dev small{color:var(--mut)}
.bars{display:flex;align-items:flex-end;gap:6px;height:90px}.bars div{flex:1;text-align:center;font-size:11px;color:var(--mut)}.bars i{display:block;background:var(--bar);border-radius:4px 4px 0 0;min-height:2px;margin-bottom:3px}
input,button{font:inherit;padding:10px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--ink);width:100%;margin-top:8px}button{cursor:pointer}
.err{color:var(--bad);font-size:13px;min-height:1.2em}
</style></head><body>
<div id="acces"><h1>Ma cave en chiffres</h1><p class="up">Entrez votre clé d'accès.</p><input id="cle" type="password" autocomplete="current-password" placeholder="Clé d'accès"><button id="ok" type="button">Afficher</button><p class="err" id="err"></p></div>
<div id="tab" hidden></div>
<script>
const $=s=>document.querySelector(s);
const LS='cave-stats-cle';
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!==undefined)e.textContent=x;return e};
const som=(l,k)=>l.reduce((s,r)=>s+(Number(r.n[k])||0),0);
function barre(nom,val,max,col){const r=el('div','row');r.append(el('span','n',nom));const b=el('span','b');const i=el('i');i.style.width=(max?Math.max(val?3:0,Math.round(100*val/max)):0)+'%';i.style.background=col;b.append(i);r.append(b,el('span','v',String(val)));return r}
function carte(titre){const c=el('div','c');c.append(el('h2','',titre));return c}
function jours(a,n){const o=[];const d=new Date(a+'T00:00:00Z');for(let i=n-1;i>=0;i--){const x=new Date(d.getTime()-i*864e5);o.push(x.toISOString().slice(0,10))}return o}
function afficher(d){
  const t=$('#tab');t.replaceChildren();
  const L=d.lignes,j7=jours(d.aujourdhui,7),j2=jours(d.aujourdhui,2);
  const l2=L.filter(r=>j2.includes(r.jour)),l7=L.filter(r=>j7.includes(r.jour));
  t.append(el('h1','','Ma cave en chiffres'),el('p','up','Mis à jour à '+new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})+' · 48 dernières heures · jours en UTC'));
  const k=el('div','k');
  const kp=(v,l)=>{const x=el('div');x.append(el('b','',String(v)),el('span','',l));k.append(x)};
  kp(new Set(l2.map(r=>r.id)).size,'appareils actifs (48 h)');kp(d.total,'appareils au total');
  kp(som(l2,'add_scan')+som(l2,'add_photos')+som(l2,'add_tableur')+som(l2,'add_manuel'),'vins ajoutés (48 h)');kp(som(l2,'conso'),'bouteilles bues (48 h)');
  t.append(k);
  let c=carte('Appareils ayant ouvert l’appli, par jour');
  const v=j7.map(x=>new Set(L.filter(r=>r.jour===x&&r.n.ouvertures>0).map(r=>r.id)).size),mx=Math.max(1,...v);
  const bars=el('div','bars');j7.forEach((x,i)=>{const b=el('div');const s=el('i');s.style.height=Math.round(70*v[i]/mx)+'px';b.append(s,el('span','',String(v[i])),el('br'),el('span','',x.slice(8)+'/'+x.slice(5,7)));bars.append(b)});
  c.append(bars);t.append(c);
  c=carte('Santé de l’assistant IA (7 jours)');
  const ia=[['Réussis',som(l7,'ia_ok'),'var(--ok)'],['Limite du jour',som(l7,'ia_limite'),'var(--warn)'],['Réseau',som(l7,'ia_reseau'),'var(--net)'],['Clé ou modèle',som(l7,'ia_cle'),'var(--bad)'],['Service gratuit',som(l7,'ia_relais'),'var(--warn)']];
  const mi=Math.max(1,...ia.map(x=>x[1]));ia.forEach(x=>c.append(barre(x[0],x[1],mi,x[2])));t.append(c);
  c=carte('Fonctions utilisées (7 jours)');
  const fo=[['Que boire',som(l7,'quoiboire')],['Plat',som(l7,'plat')],['Fiches IA',som(l7,'fiches_ia')],['Scan',som(l7,'add_scan')],['Photos multiples',som(l7,'add_photos')],['Import tableur',som(l7,'add_tableur')],['Saisie à la main',som(l7,'add_manuel')],['Aide',som(l7,'aide')]];
  const mf=Math.max(1,...fo.map(x=>x[1]));fo.forEach(x=>c.append(barre(x[0],x[1],mf,'var(--bar)')));t.append(c);
  const der={};L.forEach(r=>{der[r.id]=r});
  c=carte('Comment les caves démarrent');
  const og={tableur:0,sauvegarde:0,scan:0,manuel:0,inconnue:0};Object.values(der).forEach(r=>{og[r.origine||'inconnue']++});
  const no={tableur:'Tableur',sauvegarde:'Sauvegarde',scan:'Scan',manuel:'Saisie à la main',inconnue:'Inconnue'};
  const mo=Math.max(1,...Object.values(og));Object.keys(og).forEach(x=>c.append(barre(no[x],og[x],mo,'var(--bar)')));t.append(c);
  c=carte('Santé technique (7 jours)');
  c.append(barre('Erreurs de stockage',som(l7,'err_stockage'),Math.max(1,som(l7,'err_stockage')),'var(--bad)'),barre('Erreurs d’enregistrement',som(l7,'err_enreg'),Math.max(1,som(l7,'err_enreg')),'var(--bad)'),barre('Imports en échec',som(l7,'err_import'),Math.max(1,som(l7,'err_import')),'var(--bad)'));t.append(c);
  c=carte('Par appareil (identifiant aléatoire)');
  Object.values(der).sort((a,b)=>a.jour<b.jour?1:-1).forEach(r=>{
    const sm=k=>L.filter(x=>x.id===r.id&&j7.includes(x.jour)).reduce((s,x)=>s+(Number(x.n[k])||0),0);
    const x=el('div','dev'),g=el('div');g.append(el('b','',r.id.slice(0,4)+'…'),el('br'),el('small','',r.vins+' vins · '+sm('quoiboire')+' Que boire · '+sm('fiches_ia')+' fiches IA · sauvegarde '+(r.sauv<0?'jamais':'il y a '+r.sauv+' j')));
    const dr=el('div');dr.style.textAlign='right';dr.append(el('span','',r.jour.slice(8)+'/'+r.jour.slice(5,7)),el('br'),el('small','','v'+r.app));x.append(g,dr);c.append(x)});
  t.append(c);
  const b=el('button','','Actualiser');b.type='button';b.onclick=charger;t.append(b);
  const o=el('button','','Oublier la clé sur cet appareil');o.type='button';o.onclick=()=>{try{localStorage.removeItem(LS)}catch(e){}location.reload()};t.append(o);
}
async function charger(){
  let cle='';try{cle=localStorage.getItem(LS)||''}catch(e){}
  if(!cle){$('#acces').hidden=false;$('#tab').hidden=true;return}
  try{
    const r=await fetch('/api/resume',{headers:{Authorization:'Bearer '+cle},cache:'no-store'});
    if(r.status===401){try{localStorage.removeItem(LS)}catch(e){}$('#err').textContent='Clé refusée. Réessayez.';$('#acces').hidden=false;$('#tab').hidden=true;return}
    if(!r.ok){$('#err').textContent='Le serveur a répondu une erreur ('+r.status+'). Réessayez dans un instant.';$('#acces').hidden=false;return}
    afficher(await r.json());$('#acces').hidden=true;$('#tab').hidden=false;
  }catch(e){$('#err').textContent='Pas de connexion. Réessayez.';$('#acces').hidden=false}
}
$('#ok').onclick=()=>{const v=$('#cle').value.trim();if(!v){$('#err').textContent='Entrez votre clé.';return}try{localStorage.setItem(LS,v)}catch(e){}$('#err').textContent='';charger()};
charger();
</script></body></html>`;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!env.STATS) return json({ erreur: 'base_non_liee' }, 500);
    if (req.method === 'POST' && url.pathname === '/v1/jour') return recevoir(req, env);
    if (req.method === 'GET' && url.pathname === '/api/resume') return resume(req, env);
    if (req.method === 'GET' && (url.pathname === '/tableau' || url.pathname === '/tableau/')) {
      return new Response(PAGE, { headers: {
        'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'",
      } });
    }
    return json({ erreur: 'introuvable' }, 404);
  },
};
