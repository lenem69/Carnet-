import {start} from './server.mjs';import * as H from './h.mjs';
H.deploy();const srv=await start(8123);const b=await H.browser();
const {T,out}=H.suite('IA');
let mode='ok', n=0;
const G=o=>({json:{candidates:[{content:{parts:[{text:JSON.stringify(o)}]}}]}});
const ai=async c=>{
  const isG=c.url.includes('googleapis');
  if(mode==='gem429'&&isG)return {status:429,json:{error:{message:'Resource exhausted'}}};
  if(mode==='429')return {status:429,json:{error:{message:'Resource exhausted'}}};
  if(mode==='429once'){mode='ok';return {status:429,json:{error:{message:'Resource exhausted'}}}}
  if(mode==='badkey')return {status:400,json:{error:{message:'API key not valid. Please pass a valid API key.'}}};
  if(mode==='slow')return {...G({name:'X'}),delay:4000};
  if(c.url.includes('anthropic'))return {json:{content:[{type:'text',text:'```json\n{"ok":true}\n```'}]}};
  if(c.url.includes('example-ai'))return {json:{choices:[{message:{content:'{"ok":true}'}}]}};
  const t=c.body.contents[0].parts[0].text;
  if(t.includes('{"ok":true}'))return G({ok:true});
  if(t.includes('photo d’une étiquette')){n++;
    if(mode==='nolabel')return G({error:true});
    const L=[{name:'Morgon',dom:'Marcel Lapierre',year:2023,color:'rouge',region:'Morgon',grape:'Gamay',lecture:'haute'},{name:'Chablis Premier Cru',dom:'Dauvissat',year:2021,color:'Blanc',region:'Chablis',grape:'Chardonnay',lecture:'moyenne'}];
    return G(L[(n-1)%2]);}
  if(t.includes('Pour chaque vin')){const ids=JSON.parse(t.slice(t.indexOf('Vins : ')+7,t.indexOf('. Réponds'))).map(x=>x.id);return G({items:ids.map(id=>({id,g:'Syrah',s:'Histoire courte.',f:2024,t:2030,p:['Gigot','Fromages'],c:'estimée'}))})}
  if(t.includes('Plat prévu')){const i=t.indexOf('accords) : ');const cat=JSON.parse(t.slice(i+11,t.indexOf('. Choisis')));return G({items:[{id:cat[0].id,why:'Accord classique et à boire maintenant.'}],_n:cat.length})}
  if(t.includes('omplète la fiche')){
    const fiche={grape:'Gamay',story:'Cuvée emblématique.',from:2025,to:2031,pairings:['Poulet rôti','Andouillette'],conf:'vérifiée'};
    if(c.body.tools){
      if(mode==='notools')return {status:400,json:{error:{message:'Search grounding is not supported'}}};
      const ch=mode==='nosrc'?[]:[{web:{uri:'https://www.vinatis.com/x',title:'vinatis.com'}},{web:{uri:'https://www.vinatis.com/y',title:'vinatis.com'}},{web:{uri:'https://forum.example.fr/morgon',title:'forum.example.fr'}},{web:{uri:'http://non-securise.fr',title:'mauvais'}}];
      return {json:{candidates:[{content:{parts:[{text:'```json\n'+JSON.stringify(fiche)+'\n```'}]},groundingMetadata:{groundingChunks:ch}}]}};
    }
    return G({...fiche,conf:'connue'});}
  return G({});
};
const {page,errs,calls}=await H.newPage(b,{ai});
await page.goto(H.URL0);await H.sl(1000);
const scan=async(files=['fixtures/lab.png'],btn='Scanner')=>{await H.click(page,'#fab');await H.pickFiles(page,()=>H.tapText(page,'#sMenu button',btn),files);await H.sl(900)};
// sans clé
await H.click(page,'#fab');await H.tapText(page,'#sMenu button','Scanner');await H.sl(300);
T('sans clé : réglages ouverts + message',await H.shown(page,'#sSet')&&(await H.txt(page,'#toasts')).includes('Aucune IA'));
T('sans clé : aucun appel réseau',calls.length===0);
T('sans clé : guide d’obtention de la clé visible',await page.$eval('#ai-guide',e=>!e.hidden));
T('sans clé : bouton Coller la clé présent',!!(await page.$('#ai-paste')));
// réglages + test
await page.type('#ai-key','AIzaTEST');await H.click(page,'#ai-test');await H.sl(500);
T('test de connexion réussi',(await H.txt(page,'#toasts')).includes('réussie'),await H.txt(page,'#toasts'));
const c0=calls[0];T('Gemini : clé en en-tête, pas dans l’URL, modèle par défaut',c0.headers['x-goog-api-key']==='AIzaTEST'&&!c0.url.includes('AIza')&&c0.url.includes('/models/gemini-3.5-flash-lite:generateContent'),c0.url);
await H.click(page,'#ai-save');await H.sl(300);T('réglages fermés',!(await H.shown(page,'#sSet')));
await page.evaluate(()=>document.querySelector('#bSet').click());await H.sl(400);T('avec clé : guide masqué',await page.$eval('#ai-guide',e=>e.hidden));await page.evaluate(()=>document.querySelector('#sSet [data-close]').click());await H.sl(300);
await page.evaluate(async()=>{const m=await import('./ai.js');m.cfg.retryDelay=300;});
// scan simple
await scan();
T('scan : fiche à vérifier ouverte',await H.shown(page,'#sForm')&&(await H.txt(page,'#fT')).includes('Vérifier'));
const last=calls[calls.length-1];T('scan : image JPEG réduite envoyée',last.body.contents[0].parts[1].inline_data.mime_type==='image/jpeg'&&last.body.contents[0].parts[1].inline_data.data.length>100);
T('scan : JSON demandé',last.body.generationConfig.responseMimeType==='application/json');
T('scan : champs + couleur normalisée',(await page.$eval('#f-name',e=>e.value))==='Morgon'&&(await page.$eval('#f-color',e=>e.value))==='Rouge'&&(await page.$eval('#f-grape',e=>e.value))==='Gamay');
await H.click(page,'#f-gen');await H.sl(500);
T('fiche générée dans le formulaire',(await page.$eval('#f-story',e=>e.value)).includes('emblématique')&&(await page.$eval('#f-to',e=>e.value))==='2031');
const cg=calls[calls.length-1];
T('fiche : recherche web Gemini demandée (outil de recherche, forums et vente en ligne cités)',!!cg.body.tools&&JSON.stringify(cg.body.tools).includes('google_search')&&cg.body.contents[0].parts[0].text.includes('Vinatis')&&cg.body.contents[0].parts[0].text.includes('forums'),JSON.stringify(cg.body.tools));
T('fiche : message « vérifiée » avec 2 sources',(await H.txt(page,'#toasts')).includes('Fiche vérifiée sur le web (2 sources)'),await H.txt(page,'#toasts'));
await H.click(page,'#f-save');await H.sl(400);
T('scan : enregistré',(await H.txt(page,'#list')).includes('Morgon 2023'));
T('carte : étiquette « fiche vérifiée »',(await page.$eval('#list',e=>e.textContent)).includes('fiche vérifiée'));
const lk=await page.$$eval('#list .src a',a=>a.map(x=>x.href+'|'+x.rel+'|'+x.target));
T('carte : sources cliquables (https, sans doublon, sans http)',lk.length===2&&lk.every(x=>x.startsWith('https://')&&x.includes('noopener')&&x.endsWith('_blank')),JSON.stringify(lk));
mode='nosrc';await page.evaluate(()=>document.querySelector('#list .w [data-a="e"]').click());await H.sl(300);
await page.evaluate(()=>{const f=document.querySelector('#f-story');f.value='';const p=document.querySelector('#f-pairings');p.value=''});
await H.click(page,'#f-gen');await H.sl(500);
T('fiche sans source web : estimée (jamais vérifiée sans sources)',(await H.txt(page,'#toasts')).includes('fiche estimée'),await H.txt(page,'#toasts'));
mode='notools';await H.click(page,'#f-gen');await H.sl(600);
T('recherche refusée par le service : repli sans recherche + message',(await H.txt(page,'#toasts')).includes('Recherche web indisponible'),await H.txt(page,'#toasts'));
mode='ok';await page.evaluate(()=>document.querySelector('#f-cancel').click());await H.sl(300);
// lot de 3 photos : nouveau douteux, doublon, nouveau
n=1;await scan(['fixtures/lab.png','fixtures/lab.png','fixtures/lab.png'],'Importer des photos');await H.sl(800);
const lg=await H.txt(page,'#lg');
T('lot : suivi photo par photo',await H.shown(page,'#sLog')&&(lg.match(/✅|➕/g)||[]).length===3,lg);
T('lot : doublon additionné',lg.includes('Déjà en cave'));
T('lot : lecture moyenne marquée à vérifier',lg.includes('(à vérifier)'));
await H.click(page,'#lgX');await H.sl(200);
T('filtre À vérifier présent',(await H.txt(page,'#chips')).includes('À vérifier'));
// erreurs
mode='badkey';await scan();T('clé refusée : message clair',(await H.txt(page,'#lg')).includes('Clé IA refusée'));
T('échec : bouton saisie manuelle',await page.$eval('#lgMan',e=>!e.hidden));await H.click(page,'#lgX');
mode='nolabel';await scan();T('pas une étiquette : message clair',(await H.txt(page,'#lg')).includes('Aucune étiquette'));await H.click(page,'#lgX');
mode='429once';await scan(['fixtures/lab.png','fixtures/lab.png'],'Importer des photos');await H.sl(1500);
T('limite par minute : nouvel essai automatique réussi',(await H.txt(page,'#lg')).match(/✅|➕/g)?.length===2,await H.txt(page,'#lg'));await H.click(page,'#lgX');
mode='429';await scan(['fixtures/lab.png','fixtures/lab.png'],'Importer des photos');await H.sl(1500);
const l429=await H.txt(page,'#lg');T('limite persistante : arrêt + message + photos restantes non traitées',l429.includes('Limite d’utilisation')&&l429.includes('Non traité'),l429);await H.click(page,'#lgX');
mode='slow';await H.click(page,'#fab');await H.pickFiles(page,()=>H.tapText(page,'#sMenu button','Importer des photos'),['fixtures/lab.png','fixtures/lab.png']);await H.sl(600);
await page.goBack();await H.sl(300);T('retour pendant traitement : suivi reste ouvert',await H.shown(page,'#sLog'));
await H.click(page,'#lgStop');await H.sl(600);
const ls=await H.txt(page,'#lg');T('arrêter : traitement interrompu proprement',ls.includes('Arrêté')&&await page.$eval('#lgX',e=>!e.hidden),ls);await H.click(page,'#lgX');
mode='ok';
// fiches par lots
const nb=await page.evaluate(()=>document.querySelectorAll('#list .w').length);
await H.click(page,'#fab');await H.tapText(page,'#sMenu button','Mettre à jour les fiches');await H.sl(300);
T('lots : confirmation avec estimation des appels',(await H.txt(page,'#dlgX')).includes('appel'));
const before=calls.length;await H.tapText(page,'#dlgB button','Lancer');await H.sl(1200);
T('lots : une recherche par vin, pas plus (Gemini)',calls.length-before>=1&&calls.length-before<=nb,String(calls.length-before));
T('lots : fiches complétées',(await H.txt(page,'#lg')).includes('complétée'));await H.click(page,'#lgX');
await H.tapText(page,'#list summary','Fiche');T('fiche affichée sur la carte',(await H.txt(page,'#list')).includes('Gigot')||(await H.txt(page,'#list')).includes('Poulet'));
// que boire avec un plat : IA puis local
await H.click(page,'.tab[data-t="boire"]');await H.tapText(page,'#bchips button','Avec un plat');
await page.type('#dish','poulet rôti');await H.click(page,'#go');await H.sl(600);
T('plat : choix de l’IA affiché',(await H.txt(page,'#blist')).includes('Accord classique'));
const pc=calls[calls.length-1];T('plat : l’IA ne reçoit que des vins prêts (≤40)',pc.body.contents[0].parts[0].text.length<20000);
mode='badkey';await H.click(page,'#go');await H.sl(600);
T('plat : IA en échec → suggestions locales',(await H.txt(page,'#blist')).includes('sans IA')&&(await H.txt(page,'#toasts')).includes('Clé IA refusée'));
mode='ok';
await H.tapText(page,'#bchips button','Cette année');T('cette année : liste',(await H.txt(page,'#blist')).includes('Morgon'));
// autres fournisseurs
await H.setAI(page,'anthropic','sk-ant-TEST',{model:'claude-haiku-5-5'});await page.evaluate(async()=>{const m=await import('./ai.js');return m.testKey()});
const ca=calls[calls.length-1];T('Claude : en-têtes et corps conformes',ca.url==='https://api.anthropic.com/v1/messages'&&ca.headers['x-api-key']==='sk-ant-TEST'&&ca.headers['anthropic-dangerous-direct-browser-access']==='true'&&ca.headers['anthropic-version']&&ca.body.model==='claude-haiku-5-5'&&ca.body.max_tokens>0,JSON.stringify(ca.headers));
await H.setAI(page,'openai','sk-TEST',{model:'gpt-x',base:'https://api.example-ai.com/v1'});const ok=await page.evaluate(async()=>{const m=await import('./ai.js');return m.testKey()});
const co=calls[calls.length-1];T('Compatible OpenAI : adresse, jeton, format JSON',ok&&co.url==='https://api.example-ai.com/v1/chat/completions'&&co.headers.Authorization==='Bearer sk-TEST'&&co.body.response_format.type==='json_object');
// plusieurs IA : choix automatique et relais
const MULTI={v:2,provider:'gemini',list:{gemini:{key:'AIzaTEST'},openai:{key:'sk-TEST',model:'gpt-x',base:'https://api.example-ai.com/v1'}}};
await page.evaluate(v=>{localStorage.removeItem('cave-ai-cool');localStorage.setItem('cave-ai',JSON.stringify(v))},MULTI);
mode='gem429';const c0n=calls.length;const t0=Date.now();
const okm=await page.evaluate(async()=>{const m=await import('./ai.js');return m.testKey()});
T('2 IA : Gemini épuisé → ChatGPT prend le relais aussitôt',okm&&calls.length-c0n===2&&calls[c0n].url.includes('googleapis')&&calls[c0n+1].url.includes('example-ai')&&Date.now()-t0<8000,String(calls.length-c0n));
T('2 IA : message de relais affiché',(await H.txt(page,'#toasts')).includes('prend le relais'),await H.txt(page,'#toasts'));
const c1n=calls.length;await page.evaluate(async()=>{const m=await import('./ai.js');return m.testKey()});
T('2 IA : Gemini mis de côté, appel direct à ChatGPT',calls.length-c1n===1&&calls[c1n].url.includes('example-ai'));
mode='ok';await page.evaluate(()=>localStorage.removeItem('cave-ai-cool'));
const c2n=calls.length;await page.evaluate(async()=>{const m=await import('./ai.js');return m.testKey()});
T('2 IA : ordre normal, Gemini d’abord',calls[c2n].url.includes('googleapis'));
await page.evaluate(()=>document.querySelector('#bSet').click());await H.sl(400);
const auto=await page.$eval('#ai-auto',e=>e.textContent);
T('réglages : phrase du choix automatique',auto.includes('Gemini')&&auto.includes('ChatGPT')&&auto.includes('→'),auto);
T('réglages : ✓ sur les IA configurées',(await page.$eval('#ai-prov',e=>e.textContent)).split('✓').length===3);
await page.select('#ai-prov','openai');await H.sl(200);
T('réglages : la configuration de chaque IA est conservée',(await page.$eval('#ai-model',e=>e.value))==='gpt-x'&&(await page.$eval('#ai-key',e=>e.value))==='sk-TEST');
await page.$eval('#ai-model',e=>{e.value='Chat gtp'});await page.evaluate(()=>document.querySelector('#ai-save').click());await H.sl(300);
T('réglages : nom de modèle avec espace refusé',(await H.txt(page,'#toasts')).includes('Nom de modèle invalide'),await H.txt(page,'#toasts'));
T('réglages : refus sans modification',JSON.parse(await page.evaluate(()=>localStorage.getItem('cave-ai'))).list.openai.model==='gpt-x');
await page.evaluate(()=>document.querySelector('#sSet .close').click());await H.sl(200);
T('aucune erreur navigateur',errs.length===0,errs.join(' | '));
console.log(out.join('\n'));await b.close();srv.close();
