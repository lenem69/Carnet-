// Plan B des appels Gemini (clé personnelle) : recherche web refusée → sans recherche ; modèle économique refusé → modèle précis ; détail de l'erreur.
import {start} from './server.mjs';import * as H from './h.mjs';
H.deploy();const srv=await start(8123);const b=await H.browser();
const S=H.suite('Plan B Gemini');const T=S.T;
const G=o=>({json:{candidates:[{content:{parts:[{text:JSON.stringify(o)}]}}]}});
let mode='ok';
const ai=async c=>{
  if(!c.url.includes('googleapis'))return G({ok:1});
  const avecRecherche=!!(c.body&&c.body.tools);
  if(mode==='recherche429'&&avecRecherche)return {status:429,json:{error:{message:'search quota'}}};
  if(mode==='lite429'&&c.url.includes('flash-lite'))return {status:429,json:{error:{message:'lite quota'}}};
  if(mode==='tout429')return {status:429,json:{error:{message:'Resource has been exhausted (e.g. check quota).'}}};
  return G({ok:1});};
const r=await H.newPage(b,{ai});const page=r.page,calls=r.calls,errs=r.errs;
await page.goto(H.URL0);await H.sl(1200);
const prep=async model=>{await page.evaluate(async model=>{localStorage.setItem('cave-gratuit','off');localStorage.setItem('cave-ai',JSON.stringify(model?{provider:'gemini',key:'AIzaTEST_0123456789abcdefghij',model}:{provider:'gemini',key:'AIzaTEST_0123456789abcdefghij'}));localStorage.removeItem('cave-ai-cool')},model);await page.reload();await H.sl(1200);await page.evaluate(async()=>{(await import('./ai.js')).cfg.retryDelay=30});};
const run=async(opts)=>page.evaluate(async opts=>{const m=await import('./ai.js');const out=opts.search?{wantSearch:true}:{};try{const d=await m.callJson('p',{out});return {ok:true,d,out}}catch(e){return {ok:false,code:e.code,txt:m.errText(e)}}},opts);
const nm=u=>(u.match(/models\/([^:]+):/)||[])[1];

await prep();
mode='recherche429';let n0=calls.length;let x=await run({search:true});let cs=calls.slice(n0);
T('recherche web refusée (429) : la demande est refaite sans recherche et réussit',x.ok&&x.out.searched===false&&cs.length===2&&!!cs[0].body.tools&&!cs[1].body.tools,JSON.stringify([x.ok,cs.length]));

mode='lite429';n0=calls.length;x=await run({});cs=calls.slice(n0);
T('modèle économique refusé (429) : essai avec le modèle précis, réussite',x.ok&&cs.length===2&&/flash-lite/.test(nm(cs[0].url))&&nm(cs[1].url)==='gemini-3.8-flash',JSON.stringify([x.ok,cs.map(c=>nm(c.url))]));

mode='tout429';n0=calls.length;const t0=Date.now();x=await run({});cs=calls.slice(n0);
T('tout refusé : erreur de limite avec la phrase du service, sans longue attente',!x.ok&&x.code==='rate_limited'&&x.txt.includes('Limite d’utilisation')&&x.txt.includes('Détail du service : Resource has been exhausted')&&(Date.now()-t0)<5000,JSON.stringify([x.code,x.txt.slice(0,200),Date.now()-t0]));
T('tout refusé : les deux modèles ont été essayés',new Set(cs.map(c=>nm(c.url))).size===2,cs.map(c=>nm(c.url)).join());

await prep('gemini-choisi-a-la-main');
mode='tout429';n0=calls.length;x=await run({});cs=calls.slice(n0);
T('modèle choisi à la main : jamais remplacé',!x.ok&&cs.length>0&&cs.every(c=>nm(c.url)==='gemini-choisi-a-la-main'),cs.map(c=>nm(c.url)).join());

mode='recherche429';await prep();
const f=await page.evaluate(async()=>{const m=await import('./ai.js');const out={wantSearch:true};await m.callJson('p',{out});return {fb:out.fallback,why:out.fallbackWhy}});
T('recherche refusée : la raison du service est conservée pour le message',f.fb===true&&f.why==='search quota',JSON.stringify(f));
T('aucune erreur de page',errs.length===0,errs.join(' | '));
await b.close();srv.close();
console.log(S.out.join('\n'));
