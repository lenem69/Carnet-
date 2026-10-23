import {start} from './server.mjs';import * as H from './h.mjs';
H.deploy();const srv=await start(8123);const b=await H.browser();
const {T,out}=H.suite('Ma cave en chiffres');
const r=await H.newPage(b);const page=r.page;
const errs=[];page.on('pageerror',e=>errs.push(e.message));
await page.goto(H.URL0);await H.sl(900);
await page.evaluate(async()=>{const s=await import('./store.js');
  await s.replaceAll([
    {id:'a',name:'Château A',dom:'A',year:2015,color:'Rouge',region:'Margaux',grape:'Merlot',qty:2,price:30,from:2020,to:2026,created:1,updated:1},
    {id:'b',name:'Domaine B',dom:'B',year:2022,color:'Blanc',region:'Chablis',grape:'Chardonnay',qty:1,price:18,created:2,updated:2}]);});
await page.reload();await H.sl(1200);
T('onglet « Magic » présent',(await page.$$('.tab[data-t="chiffres"]')).length===1);
await H.tapText(page,'.tab','Magic');await H.sl(500);
T('écran des chiffres affiché, autres vues masquées',await page.$eval('#vChiffres',e=>!e.hidden)&&await page.$eval('#vCave',e=>e.hidden));
const t=await H.txt(page,'#vChiffres');
T('portrait : 3 bouteilles pour 2 références',t.includes('3 bouteilles')&&t.includes('2 références'),t.slice(0,200));
T('régions (anneaux) et statuts affichés',t.includes('Bordeaux')&&t.includes('Bourgogne')&&t.includes('Prêt à boire')&&t.includes('À garder')&&t.includes('Urgence'),t.slice(0,300));
T('appellations affichées avec leur région',t.includes('Margaux')&&t.includes('Chablis'),t.slice(0,300));
T('pas de « En résumé » ni de citation',!t.includes('En résumé'),t.slice(0,80));
T('valeur d’achat connue : 78 €',t.includes('78'),t.slice(0,400));
await H.tapText(page,'.tab','Ma cave');await H.sl(400);
T('retour à Ma cave',await page.$eval('#vCave',e=>!e.hidden)&&await page.$eval('#vChiffres',e=>e.hidden));
T('aucune erreur JavaScript',errs.length===0,errs.join('|'));
await page.close();
console.log(out.join('\n'));await b.close();srv.close();
