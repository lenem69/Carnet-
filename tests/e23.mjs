// Avis d’équilibre structuré et analyse poussée : résumé chiffré envoyé (sans nom de vin), blocs lisibles, texte échappé, ancien format toujours lu.
import {start} from './server.mjs';import * as H from './h.mjs';
H.deploy();const srv=await start(8123);const b=await H.browser();
const S=H.suite('Avis structuré');const T=S.T;
let prompt='';
const G=o=>({json:{candidates:[{content:{parts:[{text:JSON.stringify(o)}]}}]}});
const ai=async c=>{
  const p=JSON.stringify(c.body);
  if(!p.includes('Voici le résumé chiffré'))return G({});
  prompt=c.body.contents[0].parts[0].text;
  return G({court:'Cave très rouge : 80 % de rouges, il manque des blancs.',cles:['80 % de rouges','Aucun blanc de garde','Pic en 2027'],
    solide:['Douze bouteilles prêtes à boire sur 17.','Beau socle rhodanien : 60 % de la cave.'],
    manque:['Aucune bulle ni liquoreux.','Années creuses en 2031 et 2032 <b>gras</b>.'],
    priorite:['Un grand blanc de garde (Riesling d’Alsace) pour boire entre 2030 et 2040.','Quelques bulles pour l’apéritif.'],
    complet:'Premier paragraphe d’analyse.\n\nSecond paragraphe : accords et achats.'});
};
const r=await H.newPage(b,{ai});const page=r.page;
const errs=[];page.on('pageerror',e=>errs.push(e.message));
await page.goto(H.URL0);await H.sl(900);
await H.setAI(page,'gemini','AIzaTEST');
const base={src:{from:'user',to:'user'},dom:'Domaine Secret',color:'Rouge',region:'Cornas',grape:'Syrah',price:20,created:1,updated:1,story:'x',pairings:['a'],check:false,conf:'',sources:[],note:'',loc:'',tastings:[]};
await page.evaluate(async(base)=>{const s=await import('./store.js');
  await s.replaceAll([{...base,id:'a',name:'Cuvée Mystère',year:2018,qty:2,from:2020,to:2035},{...base,id:'b',name:'Autre Vin',color:'Blanc',region:'Chablis',grape:'Chardonnay',year:2020,qty:1,from:2024,to:2030}]);
  await s.setMeta('bienvenue',{prenom:'Jeff',date:1});},base);
await page.reload();await H.sl(4500);
await H.tapText(page,'.tab','Magic');await H.sl(600);

T('résumé envoyé : calendrier à boire, années creuses, couleurs absentes, parts en %',['calendrier_a_boire','annees_creuses_sur_12_ans','couleurs_absentes','"pct"','statuts','appellations','millesimes_par_decennie'].every(k=>prompt.includes(k)),prompt.slice(0,400));
T('résumé envoyé : aucun nom de vin ni de domaine',!/Mystère|Autre Vin|Domaine Secret/.test(prompt));
T('consigne : chiffres cités, rien d’inventé, pas de nom de cuvée ni de prix',/Cite au moins un chiffre/.test(prompt)&&/N’invente aucun vin/.test(prompt)&&/jamais de nom de cuvée ni de prix/.test(prompt));
const v=await page.evaluate(()=>{const q=s=>[...document.querySelectorAll(s)].map(e=>e.textContent.trim());return {lead:q('#avisIA .avis-lead')[0],cles:q('#avisIA .cles li'),ok:q('#avisIA .ab-ok li'),wa:q('#avisIA .ab-wa li'),pr:q('#avisIA .ab-pr li'),titres:q('#avisIA .ab h4'),summary:q('#avisIA .avis-complet summary')[0],complet:document.querySelector('#avisIA .avis-complet p')?.textContent,html:document.querySelector('#avisIA').innerHTML};});
T('message clé affiché en tête',v.lead==='Cave très rouge : 80 % de rouges, il manque des blancs.',v.lead);
T('3 messages clés en repères',v.cles.length===3&&v.cles[2]==='Pic en 2027',JSON.stringify(v.cles));
T('trois blocs : solide, manque, priorité',v.ok.length===2&&v.wa.length===2&&v.pr.length===2,JSON.stringify([v.ok,v.wa,v.pr]));
T('titres des blocs',v.titres.join('|')==='Ce qui est solide|Ce qui manque|À acheter ou faire en priorité',v.titres.join('|'));
T('accès « Avis complet » conservé, texte intact',v.summary==='Avis complet'&&v.complet==='Premier paragraphe d’analyse.\n\nSecond paragraphe : accords et achats.',JSON.stringify(v.complet));
T('texte de l’IA échappé (pas de HTML injecté)',!v.html.includes('<b>gras</b>')&&v.wa[1].includes('<b>gras</b>'),v.wa[1]);
T('mention « impression, sans vérification » conservée',v.html.includes('impression, sans vérification'));
T('aucune erreur JavaScript de page',errs.length===0,errs.join(' / '));
S.out.forEach(l=>console.log(l));
console.log(`\n${S.out.filter(l=>l.startsWith('PASS')).length} réussis, ${S.out.filter(l=>l.startsWith('FAIL')).length} échec(s)`);
await b.close();srv.close?.();process.exit(S.out.some(l=>l.startsWith('FAIL'))?1:0);
