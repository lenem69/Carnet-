// 1.42.0 : réflexion courte, plafond de sortie et schéma de réponse par tâche ; repli si le service les refuse ; mesure locale des jetons.
import {start} from './server.mjs';import * as H from './h.mjs';
H.deploy();const srv=await start(8123);const b=await H.browser();
const S=H.suite('Économie de jetons Gemini');const T=S.T;
let mode='ok';
const G=(o,u)=>({json:{candidates:[{content:{parts:[{text:JSON.stringify(o)}]}}],usageMetadata:u===undefined?{promptTokenCount:120,candidatesTokenCount:30,thoughtsTokenCount:7}:u}});
const ai=async c=>{
  if(!c.url.includes('googleapis'))return G({});
  const gc=c.body.generationConfig||{};
  if(mode==='refus'&&(gc.responseSchema||gc.thinkingConfig||gc.maxOutputTokens))return {status:400,json:{error:{message:'Invalid JSON payload received. Unknown name "responseSchema"'}}};
  const t=c.body.contents[0].parts[0].text;
  if(t.includes('Contrôle de la fenêtre de garde'))return G({items:[{id:'a',f:2022,t:2030}]});
  if(t.includes('prix de marché'))return G({items:[{id:'a',min:10,max:20}]});
  if(t.includes('Pour chaque vin'))return G({items:[{id:'a',g:'Gamay',s:'Histoire.',f:2026,t:2031,p:['Poulet'],u:[],c:'estimée'}]});
  if(t.includes('Plat prévu'))return G({items:[{id:'a',why:'Bon accord.'}]});
  return G({});
};
const {page,errs,calls}=await H.newPage(b,{ai,web:null});
await page.goto(H.URL0);await H.sl(900);
await page.evaluate(async()=>{localStorage.setItem('cave-gratuit','off');localStorage.setItem('cave-ai',JSON.stringify({provider:'gemini',key:'AIzaPERSO',model:'gemini-3.5-flash-lite'}))});
await page.reload();await H.sl(1200);
const w={id:'a',name:'Vin a',dom:'Dom a',year:2018,color:'Rouge',region:'Cahors',from:2020,to:2030,grape:'',pairings:[]};
const run=(fn)=>page.evaluate(async(fn,w)=>{const AI=await import('./ai.js');const f={garde:()=>AI.verifGarde([w],{only:'gemini',noRelais:true}),valeur:()=>AI.estimeValeur([w],{only:'gemini',noRelais:true}),fiche:()=>AI.makeFiches([w],{only:'gemini',noRelais:true}),plat:()=>AI.pickForDish('poulet',[{...w,pairings:[]}],{only:'gemini',noRelais:true})}[fn];const r=await f();return [...(r instanceof Map?r:r)].length},fn,w);
const dernier=()=>calls.filter(c=>c.url.includes('googleapis')).pop().body.generationConfig;

await run('garde');let g=dernier();
T('garde : réflexion minimale',g.thinkingConfig&&g.thinkingConfig.thinkingLevel==='minimal',JSON.stringify(g));
T('garde : plafond de sortie proportionnel au lot (800 + 60 par vin)',g.maxOutputTokens===860,JSON.stringify(g));
T('garde : schéma de réponse (entiers f et t obligatoires)',g.responseSchema&&g.responseSchema.type==='OBJECT'&&g.responseSchema.properties.items.items.properties.f.type==='INTEGER'&&g.responseMimeType==='application/json',JSON.stringify(g.responseSchema));
await run('valeur');g=dernier();
T('valeur : réflexion minimale, plafond 860 et schéma',g.thinkingConfig.thinkingLevel==='minimal'&&g.maxOutputTokens===860&&!!g.responseSchema,JSON.stringify(g));
await run('fiche');g=dernier();
T('fiche : réflexion « low », plafond 1200 + 500 par vin et schéma',g.thinkingConfig.thinkingLevel==='low'&&g.maxOutputTokens===1700&&!!g.responseSchema,JSON.stringify(g));
await run('plat');g=dernier();
T('plat : réflexion « low », plafond 1500 et schéma',g.thinkingConfig.thinkingLevel==='low'&&g.maxOutputTokens===1500&&!!g.responseSchema,JSON.stringify(g));

const m=await page.evaluate(async()=>{const AI=await import('./ai.js');return AI.jetonsLus()});
T('mesure locale : un appel noté par type, avec entrée, sortie et réflexion',m&&m.t.garde&&m.t.garde.n===1&&m.t.garde.ent===120&&m.t.garde.sor===30&&m.t.garde.ref===7&&m.t.fiche.n===1&&m.t.valeur.n===1&&m.t.plat.n===1,JSON.stringify(m));
T('mesure : aucune donnée de vin dans ce qui est gardé',!/Vin a|Dom a|Cahors/.test(JSON.stringify(m)));

// Réglages : la ligne s'affiche
await page.evaluate(()=>document.querySelector('#bSet')&&document.querySelector('#bSet').click());await H.sl(600);
const ligne=await page.evaluate(()=>{const e=document.querySelector('#ai-jetons');return e?e.textContent:null});
T('réglages : la ligne des jetons affiche le contrôle de garde et la date de départ',ligne&&/Contrôle de garde : 1 appel/.test(ligne)&&/Depuis le \d{4}-\d\d-\d\d/.test(ligne),ligne);

// Repli : le service refuse la réflexion, le plafond ou le schéma → même demande refaite sans, et le résultat est bon
mode='refus';const n0=calls.filter(c=>c.url.includes('googleapis')).length;
const r=await run('garde');
const nouveaux=calls.filter(c=>c.url.includes('googleapis')).slice(n0);
T('repli : première demande refusée, seconde sans réflexion ni plafond ni schéma, résultat obtenu',r===1&&nouveaux.length===2&&nouveaux[1].body.generationConfig.responseSchema===undefined&&nouveaux[1].body.generationConfig.thinkingConfig===undefined&&nouveaux[1].body.generationConfig.maxOutputTokens===undefined,JSON.stringify(nouveaux.map(c=>Object.keys(c.body.generationConfig))));
mode='ok';
T('erreurs de page : aucune',errs.length===0,JSON.stringify(errs));
await b.close();srv.close?.();
console.log(S.out.join('\n'));
