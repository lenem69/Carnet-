import * as L from '../logic.js';
import * as I from '../importer.js';
import XLSX from 'xlsx';
import fs from 'fs';
const out=[];const T=(n,c,x='')=>out.push((c?'PASS ':'FAIL ')+n+(c?'':' → '+x));
// normalizeWine
const w=L.normalizeWine({name:' Morgon ',dom:'Lapierre',year:'2023',color:'rouge',qty:'0',price:'12,50 €',pairings:'Poulet, Charcuterie',from:'2025',to:2032});
T('normalize: champs',w.name==='Morgon'&&w.year===2023&&w.color==='Rouge'&&w.qty===0&&w.price===12.5&&w.pairings.length===2&&w.from===2025,JSON.stringify(w));
T('normalize: qty absente = 1',L.normalizeWine({name:'x'}).qty===1);
T('normalize: sans nom ni domaine = null',L.normalizeWine({year:2020})===null&&L.normalizeWine(null)===null);
T('normalize: domaine seul devient nom',L.normalizeWine({dom:'Ch. X'}).name==='Ch. X');
T('normalize: ancienne fiche v1 (prix texte, ids numériques)',L.normalizeWine({id:1792646574850,name:'A',price:'',qty:2}).id==='1792646574850');
// status
const Y=2026;
T('status garder',L.status({from:2028,to:2035},Y).code==='keep');
T('status passé',L.status({from:2010,to:2020},Y).code==='late');
T('status vite',L.status({from:2020,to:2027},Y).code==='soon');
T('status à boire',L.status({from:2020,to:2032},Y).code==='ready');
T('status inconnu',L.status({},Y)===null);
T('urgent ignore stock 0',!L.urgent({qty:0,to:2025},Y)&&L.urgent({qty:1,to:2025},Y));
// local pairing
const cave=[
 L.normalizeWine({id:'a',name:'Morgon',color:'Rouge',qty:2,from:2024,to:2030,pairings:['Poulet rôti','Charcuterie']}),
 L.normalizeWine({id:'b',name:'Chablis',color:'Blanc',qty:1,from:2023,to:2027,pairings:['Huîtres','Poisson grillé']}),
 L.normalizeWine({id:'c',name:'Jeune Bordeaux',color:'Rouge',qty:3,from:2030,to:2045,pairings:['Magret de canard']}),
 L.normalizeWine({id:'d',name:'Champagne',color:'Pétillant',qty:0,pairings:['Apéritif']}),
];
let r=L.localPairing('poulet rôti aux herbes',cave,Y);T('local: poulet → Morgon en tête',r[0]&&r[0].w.id==='a',JSON.stringify(r.map(x=>[x.w.id,x.score])));
r=L.localPairing('huîtres et fruits de mer',cave,Y);T('local: huîtres → Chablis',r[0]&&r[0].w.id==='b');
r=L.localPairing('magret de canard',cave,Y);T('local: vin trop jeune exclu',!r.some(x=>x.w.id==='c'),JSON.stringify(r.map(x=>x.w.id)));
r=L.localPairing('apéritif',cave,Y);T('local: stock 0 exclu',!r.some(x=>x.w.id==='d'));
T('local: explication fournie',L.localPairing('poulet',cave,Y)[0].why.includes('Poulet'));
// csv
const csv=L.toCsv([L.normalizeWine({name:'Château "Test"',dom:'É',price:12.5,pairings:['a','b']})]);
T('csv: BOM + guillemets échappés + virgule décimale',csv.startsWith('﻿')&&csv.includes('"Château ""Test"""')&&csv.includes('"12,5"'));
// backup
const bk=L.makeBackup(cave);const p=L.parseBackup(bk);T('backup aller-retour',p.wines.length===4&&p.skipped===0);
const v1=JSON.stringify({v:1,date:'x',wines:[{id:'1',name:'A',qty:1},{id:'1',name:'B'},{year:2020}]});const p1=L.parseBackup(v1);
T('backup v1 + ids dupliqués + lignes invalides',p1.wines.length===2&&p1.skipped===1&&p1.wines[0].id!==p1.wines[1].id);
let err='';try{L.parseBackup('pas du json')}catch(e){err=e.message}T('backup invalide: message clair',err.includes('JSON'));
// importer mapping
const m=I.mapHeaders(['Domaine','Cuvée','Millésime','Couleur','Appellation','Cépage','Début garde','Fin garde','Quantité','Emplacement','Confiance','Prix d’achat','Accords','Mes notes']);
T('colonnes reconnues (14)',Object.keys(m).length===14,JSON.stringify(m));
T('colonne Début/Fin garde',m['Début garde']==='from'&&m['Fin garde']==='to');
const rows=[{Domaine:'Lapierre',Cuvée:'Morgon',Millésime:2023,Quantité:1,Confiance:'haute'},{Domaine:'Lapierre',Cuvée:'Morgon',Millésime:2023,Quantité:2,Confiance:'haute'},{Domaine:'X',Cuvée:'Y',Millésime:'',Quantité:'',Confiance:'faible'},{Domaine:'',Cuvée:'',Millésime:2020,Quantité:3,Confiance:''},{Domaine:'',Cuvée:'',Millésime:'',Quantité:'',Confiance:''}];
const existing=[L.normalizeWine({id:'e1',name:'Y',dom:'X',qty:4})];
const res=I.rowsToWines(rows,existing);
T('import: doublons internes fusionnés',res.added.length===1&&res.added[0].qty===3,JSON.stringify(res.added));
T('import: fusion avec la cave existante sans la modifier',res.updated.length===1&&res.updated[0].qty===5&&existing[0].qty===4);
T('import: ligne sans nom comptée ignorée, ligne vide non comptée',res.skipped===1,String(res.skipped));
T('import: confiance faible → à vérifier',res.updated[0].check===false&&res.added[0].check===false);
const res2=I.rowsToWines([{Nom:'Z',Confiance:'moyenne'}],[]);T('import: confiance moyenne → à vérifier',res2.added[0].check===true);
// lecture réelle des fichiers de test avec la lib xlsx
const wb=XLSX.read(fs.readFileSync('fixtures/test.xlsx'));const rws=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:'',raw:true});
const r3=I.rowsToWines(rws,[]);T('modèle xlsx: 2 vins, 3 bouteilles, 1 à vérifier',r3.added.length===2&&r3.added.reduce((a,w)=>a+w.qty,0)===3&&r3.added.filter(w=>w.check).length===1,JSON.stringify(r3.added.map(w=>[w.name,w.qty,w.check,w.from,w.to])));
const text=fs.readFileSync('fixtures/big.csv','utf8');const wb2=XLSX.read(text,{type:'string',raw:true});const r4=I.rowsToWines(XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]],{defval:'',raw:true}),[]);
T('1030 lignes: 1000 vins, 1060 bouteilles',r4.added.length===1000&&r4.added.reduce((a,w)=>a+w.qty,0)===1060,r4.added.length+' / '+r4.added.reduce((a,w)=>a+w.qty,0));
T('accents préservés',r4.added.some(w=>w.color==='Rosé'));
{const ex=[{id:'a',name:'Morgon',dom:'Lapierre',year:2023,qty:2,color:'Rouge',pairings:[]}].map(w=>({...w,price:'',loc:'',from:'',to:'',grape:'',region:'',story:'',note:'',check:false,conf:'',created:1,updated:1}));
const rs=[{Domaine:'Lapierre',Cuvée:'Morgon',Millésime:2023,Quantité:1},{Domaine:'Dauvissat',Cuvée:'Chablis',Millésime:2021,Quantité:3}];
const a=I.rowsToWines(rs,ex);T('import mode somme : doublon additionné, 1 ligne existante comptée',a.added.length===1&&a.updated.length===1&&a.updated[0].qty===3&&a.existing===1);
const b=I.rowsToWines(rs,ex,'skip');T('import mode « seulement les nouveaux » : existant intact',b.added.length===1&&b.updated.length===0&&b.existing===1&&ex[0].qty===2);
const c=I.rowsToWines([...rs,rs[1]],ex,'skip');T('mode skip : doublon interne au fichier toujours additionné',c.added.length===1&&c.added[0].qty===6);}
{ // import souple : liste de caviste sans en-tête « Nom » (1.13.0)
  const mh=I.mapHeaders(['TVA*','tarif TTC','Millésime','Q disponible','Notes/commentaires vin','commentaires domaine']);
  T('import souple : « tarif TTC » = prix, « Q disponible » = quantité, commentaires jamais domaine',mh['tarif TTC']==='price'&&mh['Q disponible']==='qty'&&!Object.values(mh).includes('dom'),JSON.stringify(mh));
  const rs=I.lireFeuilleLibre([['ROUGE 75cl'],['X',20,'Bourgogne','Berthaut-Gerbet "les Prielles"',2023,10,'Note Cellar Tracker 91 : très beau vin de longue garde'],['X',27,'Hautes Cotes de Nuits','SYLVIE ESMONIN',2023,4,'Commentaire long']],'Bourgogne');
  T('import souple : région reconnue, nom du domaine, millésime, prix, quantité et couleur du titre',rs.length===2&&rs[0].Nom==='Berthaut-Gerbet "les Prielles"'&&rs[0].Région==='Bourgogne'&&rs[0].Millésime===2023&&rs[0].Prix===20&&rs[0].Quantité===10&&rs[0].Couleur==='Rouge',JSON.stringify(rs[0]));
  T('import souple : deuxième ligne, région reconnue même sans « X »',rs[1]&&rs[1].Nom==='SYLVIE ESMONIN'&&rs[1].Région==='Hautes Cotes de Nuits'&&rs[1].Quantité===4,JSON.stringify(rs[1]));
  const v=I.rowsToWines(rs,[]);T('import souple : lignes marquées « à vérifier », domaine absent sans erreur',v.added.length===2&&v.added.every(w=>w.check===true),JSON.stringify(v.added.map(w=>w.check)));
}
{const n=c=>L.normalizeWine({name:'A',conf:c});
T('fiabilité : « connue » (ancien format) → estimée',n('connue').conf==='estimée'&&n('estimée').conf==='estimée'&&n('vérifiée').conf==='vérifiée'&&n('x').conf==='');
const w=L.normalizeWine({name:'A',sources:[{t:'ok',u:'https://a.fr/x'},{t:'mauvais',u:'http://a.fr'},{t:'js',u:'javascript:alert(1)'},null,...Array(8).fill({t:'z',u:'https://z.fr'})]});
T('sources : https seulement, 5 au maximum',w.sources.length===5&&w.sources.every(x=>x.u.startsWith('https://')));
T('sources : absentes → liste vide (anciennes sauvegardes)',L.normalizeWine({name:'B'}).sources.length===0);}
// Ma cave en chiffres (chiffres.js)
{
  const C = await import('../chiffres.js');
  const { chiffres } = C;
  const ws=[
    L.normalizeWine({name:'A',region:'Margaux',grape:'Merlot',color:'Rouge',year:2015,qty:2,price:30,from:2020,to:2026}),
    L.normalizeWine({name:'B',region:'Margaux',grape:'Cabernet',color:'Rouge',year:2010,qty:1,price:50,from:2018,to:2030}),
    L.normalizeWine({name:'C',region:'Chablis',grape:'Chardonnay',color:'Blanc',year:2022,qty:3}),
    L.normalizeWine({name:'D',region:'Sancerre',grape:'Sauvignon',color:'Blanc',year:2021,qty:0,price:20,from:2021,to:2025}),
  ];
  const c=chiffres(ws,2026,20);
  T('chiffres : bouteilles et références (qty 0 exclue)',c.bouteilles===6&&c.references===3,JSON.stringify([c.bouteilles,c.references]));
  T('chiffres : portrait',c.portrait.includes('6 bouteilles')&&c.portrait.includes('3 références'),c.portrait);
  T('chiffres : répartition couleur',c.couleurs.find(x=>x[0]==='Rouge')[1]===3&&c.couleurs.find(x=>x[0]==='Blanc')[1]===3,JSON.stringify(c.couleurs));
  T('chiffres : régions = grandes régions (Bordeaux, Bourgogne), appellations dessous',c.regions.some(x=>x[0]==='Bordeaux'&&x[1]===3)&&c.regions.some(x=>x[0]==='Bourgogne'&&x[1]===3)&&c.appellations.some(x=>x[0]==='Margaux'&&x[1]===3&&x[2]==='Bordeaux'),JSON.stringify([c.regions,c.appellations]));
  T('chiffres : frise compte les bouteilles à boire chaque année',c.frise.find(x=>x[0]===2026)[1]===3&&c.frise.find(x=>x[0]===2030)[1]===1&&c.frise.find(x=>x[0]===2031)[1]===0,JSON.stringify(c.frise.slice(4,8)));
  T('chiffres : sans période de garde comptées à part',c.sansFenetre===3,String(c.sansFenetre));
  T('chiffres : valeur et bouteilles sans prix',c.valeur.total===2*30+1*50+0&&c.valeur.sansPrix===3,JSON.stringify(c.valeur));
  T('chiffres : cave vide',chiffres([],2026).portrait.includes('vide')&&chiffres([],2026).bouteilles===0);
  T('chiffres : statuts Prêt / À garder / Urgence / sans fenêtre',c.statuts.urgence===2&&c.statuts.pret===1&&c.statuts.garder===0&&c.statuts.sans===3,JSON.stringify(c.statuts));
  const ws2=[L.normalizeWine({name:'E',region:'Saint-Joseph',grape:'Syrah',color:'Rouge',year:2020,qty:1,from:2030,to:2040}),L.normalizeWine({name:'F',region:'Vin inconnu',grape:'100% Syrah',color:'Rouge',year:2020,qty:1,from:2024,to:2040})];
  const c2=chiffres(ws2,2026,20);
  T('chiffres : Saint-Joseph classé en Vallée du Rhône, à garder',c2.regions.some(x=>x[0]==='Vallée du Rhône')&&c2.statuts.garder===1,JSON.stringify([c2.regions,c2.statuts]));
  T('chiffres : appellation inconnue → Vin de France',c2.regions.some(x=>x[0]==='Vin de France'&&x[1]===1),JSON.stringify(c2.regions));
  T('chiffres : « 100% Syrah » et « Syrah » fusionnés',c2.cepages.length===1&&c2.cepages[0][0]==='Syrah'&&c2.cepages[0][1]===2,JSON.stringify(c2.cepages));
  T('cépage : variantes (Shiraz, Cab. Sauvignon, espaces, casse)',['Shiraz','100 % shiraz','SYRAH.'].every(v=>C.cepage(v).label==='Syrah')&&C.cepage('Cab. Sauvignon').label==='Cabernet sauvignon'&&C.cepage('  ')===null,JSON.stringify([C.cepage('Shiraz'),C.cepage('Cab. Sauvignon')]));
}
// Bible des vins : pré-remplissage de la garde (logic.js)
{
  const B = { v: 1, date: '2026-10-01', rows: [
    { a: 'Chablis', c: 'B', y: { '2015': [4, 2018, 2030, 'B'] } },
    { a: 'Jurançon sec', c: 'B', y: { '2015': [3, 2017, 2024, 'B'] } },
    { a: 'Jurançon sec', c: 'D', y: { '2015': [5, 2019, 2030, 'B'] } },
    { a: 'Ambiguë', c: 'B', y: { '2015': [3, 2017, 2020, 'B'] } },
    { a: 'Ambiguë', c: 'D', y: { '2015': [3, 2017, 2020, 'B'] } },
  ] };
  T('bible : format valide', L.bibleValid(B) && !L.bibleValid({ v: 2, rows: [] }) && !L.bibleValid(null));
  const w1 = L.normalizeWine({ name: 'Cuvée', region: 'Chablis', color: 'Blanc', year: 2015 });
  T('bible : pré-remplit la garde d’une fiche sans garde', L.prefillFromBible(w1, B) && w1.from === 2018 && w1.to === 2030 && w1.src.from === 'bible' && w1.conf === 'estimée', JSON.stringify(w1));
  const w2 = L.normalizeWine({ name: 'Cuvée', region: 'Chablis', color: 'Blanc', year: 2015, from: 2020, to: 2025 });
  T('bible : ne touche pas une garde déjà saisie', !L.prefillFromBible(w2, B) && w2.from === 2020 && !w2.src.from, JSON.stringify(w2));
  const w3 = L.normalizeWine({ name: 'Cuvée', region: 'Jurançon sec', color: 'Blanc', year: 2015 });
  T('bible : Blanc avec sec et doux pour la même appellation → ne devine pas', !L.prefillFromBible(w3, B) && !w3.to, JSON.stringify(w3));
  const w4 = L.normalizeWine({ name: 'Cuvée', region: 'Ambiguë', color: 'Blanc', year: 2015 });
  T('bible : deux lignes possibles pour une couleur → rien', !L.prefillFromBible(w4, B) && !w4.from, JSON.stringify(w4));
  const w5 = L.normalizeWine({ name: 'Cuvée', region: 'Chablis', color: 'Rouge', year: 2015 });
  T('bible : couleur non couverte (Rouge pour Chablis) → rien', !L.prefillFromBible(w5, B), JSON.stringify(w5));
  const w6 = L.normalizeWine({ name: 'Cuvée', region: 'Chablis', color: 'Blanc', year: 2016 });
  T('bible : millésime absent → rien', !L.prefillFromBible(w6, B) && !w6.from);
  T('bible : sans bible valable → rien', !L.prefillFromBible(L.normalizeWine({ name: 'Cuvée', region: 'Chablis', color: 'Blanc', year: 2015 }), null));
  const n = L.normalizeWine({ name: 'x', src: { from: 'bible', to: 'bible' } });
  T('origines : valeurs inconnues écartées, src conservé', JSON.stringify(n.src) === '{}' || (n.src && n.src.from === 'bible'), JSON.stringify(n.src));
}
// Quantité écrite dans le nom (import Excel)
{
  T('quantité dans le nom : « 2 bouteilles de blanc » → 2 et « blanc »', L.splitQty('2 bouteilles de blanc etc',1).qty===2 && L.splitQty('2 bouteilles de blanc etc',1).name==='blanc etc');
  T('quantité dans le nom : « 3 x Syrah » avec colonne vide → 3', L.splitQty('3 x Syrah','').qty===3 && L.splitQty('3 x Syrah','').name==='Syrah');
  T('quantité dans le nom : colonne différente et non 1 → colonne gardée', L.splitQty('2 bouteilles de Rouge',5).qty===5);
  T('quantité dans le nom : nom « 2 Hommes » non modifié', L.splitQty('Château 2 Hommes',1).name==='Château 2 Hommes');
  T('quantité dans le nom : seulement « 2 bouteilles » → inchangé', L.splitQty('2 bouteilles',1).name==='2 bouteilles');
  T('normalisation : fiche importée avec 2 bouteilles dans le nom', L.normalizeWine({name:'2 bouteilles de blanc etc',qty:1,color:'Blanc'}).qty===2);
}
// Tableau type « Inventaire vins » (colonnes Région / Appellation / Nombre de bouteille(s))
{
  const I = await import('../importer.js');
  const hd=['Pays','Région','Couleur','Effervescent','Appellation','Domaine','Millésime','Format','Nombre de bouteille(s)','Commentaires','Actions'];
  const m=I.mapHeaders(hd);
  T('import : « Nombre de bouteille(s) » = quantité (pas le nom)', m['Nombre de bouteille(s)']==='qty' && !Object.values(m).includes('name'), JSON.stringify(m));
  T('import : « Appellation » = appellation, « Région » ignorée', m['Appellation']==='region' && !m['Région'], JSON.stringify(m));
  const r=I.rowsToWines([{'Pays':'France','Région':'Beaujolais','Couleur':'Rouge','Effervescent':'Non','Appellation':'Morgon','Domaine':'Lapierre','Millésime':2023,'Format':'75cl','Nombre de bouteille(s)':2,'Commentaires':'Cadeau','Actions':''},{'Pays':'France','Région':'Alsace','Couleur':'Blanc','Effervescent':'Oui','Appellation':'Crémant','Domaine':'Foo','Millésime':'inconnu','Format':'1,5L','Nombre de bouteille(s)':1,'Commentaires':'','Actions':''}],[],'sum').added;
  T('import : quantité 2 et appellation Morgon', r[0].qty===2 && r[0].region==='Morgon' && r[0].name==='Lapierre', JSON.stringify(r[0]));
  T('import : effervescent → Pétillant, format 1,5 L au nom, année vide', r[1].color==='Pétillant' && r[1].name.includes('1,5L') && r[1].year==='', JSON.stringify(r[1]));
  const f=L.normalizeWine({name:'0',dom:'La Grange Tiphaine',year:2022,color:'Blanc',qty:1});
  T('réparation : ancien titre « 0 » → quantité 0 et nom = domaine', f.qty===0 && f.name==='La Grange Tiphaine' && f.dom==='', JSON.stringify(f));
  const g=L.normalizeWine({name:'1',dom:'Benoît Courault',year:2021,color:'Rouge',qty:1});
  T('réparation : « 1 » → quantité 1, nom = domaine', g.qty===1 && g.name==='Benoît Courault', JSON.stringify(g));
}
// Reconnaissance souple des appellations (Magic)
{
  const C = await import('../chiffres.js');
  T('appellations : « Volnay 1er cru » reconnue comme Volnay (Bourgogne)', C.reconnaitre('Volnay 1er cru')?.[2]==='Bourgogne', JSON.stringify(C.reconnaitre('Volnay 1er cru')));
  T('appellations : « Haut-Médoc Grand cru classé » reconnue (Bordeaux)', C.reconnaitre('Haut-Médoc Grand cru classé')?.[2]==='Bordeaux');
  T('appellations : « Côte du Rhône » (singulier) reconnue (Vallée du Rhône)', C.reconnaitre('Côte du Rhône')?.[2]==='Vallée du Rhône', JSON.stringify(C.reconnaitre('Côte du Rhône')));
  T('appellations : « Vin de France » non reconnue → Vin de France', C.reconnaitre('Vin de France')===null && C.chiffres([{qty:1,region:'Vin de France',color:'Rouge',grape:'',name:'x'}],2026).regions[0][0]==='Vin de France');
  T('appellations : « Alsance Grand Cru » (faute) → Alsace', C.reconnaitre('Alsance Grand Cru')?.[2]==='Grand Est'||C.reconnaitre('Alsance Grand Cru')?.[2]==='Alsace'||C.reconnaitre('Alsance Grand Cru')?.[2]==='Alsace', JSON.stringify(C.reconnaitre('Alsance Grand Cru')));
  T('appellations : « Mâcon Pierreclos » (début de nom) → Bourgogne', C.reconnaitre('Mâcon Pierreclos')?.[2]==='Bourgogne', JSON.stringify(C.reconnaitre('Mâcon Pierreclos')));
  T('appellations : « Hautes-côtes de Beaune - vieilles vigens » → Bourgogne', C.reconnaitre('Hautes-côtes de Beaune - vieilles vigens')?.[2]==='Bourgogne');
  T('vins étrangers : Riesling, Tokaji → Étranger', C.chiffres([{qty:1,region:'Riesling',color:'Blanc',grape:'',name:'a'},{qty:1,region:'Tokaji',color:'Blanc',grape:'',name:'b'}],2026).regions.some(x=>x[0]==='Étranger'&&x[1]===2));
}
{ const C = await import('../chiffres.js'); T('repérage : « Pays d’Hérault » → Languedoc-Roussillon, « Vin des Allobroges » → Savoie', C.chiffres([{qty:1,region:"Pays d’Hérault",color:'Rouge',grape:'',name:'a'},{qty:1,region:'Vin des Allobroges',color:'Rouge',grape:'',name:'b'}],2026).regions.map(x=>x[0]).sort().join('|')==='Languedoc-Roussillon|Sud-Ouest, Jura, Savoie'); }
{ // apogée : règle du sommelier (1.13.0)
  const A = await import('../apogee.js');
  const ap = (w, y) => A.apogee(w, y);
  const t1 = ap({ name: 'Champagne Brut', color: 'Pétillant', region: 'Champagne', year: '' }, 2026);
  T('apogée : sans millésime → prêt à boire', t1.sansMillesime && t1.statut === 'Prêt à boire', JSON.stringify(t1));
  const t2 = ap({ name: 'Château Bouscaut', color: 'Rouge', region: 'Pessac-Léognan', year: 2015 }, 2026);
  T('apogée : Bordeaux rouge 2015 → +8 ans, pic 2023, urgence en 2026', t2.pic === 2023 && t2.statut === 'Urgence' && t2.ans === 8, JSON.stringify(t2));
  const t3 = ap({ name: 'Morgon Côte du Py', color: 'Rouge', region: 'Beaujolais', year: 2023 }, 2026);
  T('apogée : Beaujolais 2023 → +4 ans, pic 2027, prêt à boire en 2026', t3.pic === 2027 && t3.statut === 'Prêt à boire', JSON.stringify(t3));
  const t4 = ap({ name: 'Gosset Grand Rosé', color: 'Rosé', region: 'Champagne', year: 2025 }, 2026);
  T('apogée : rosé 2025 → +2 ans, prêt à boire', t4.pic === 2027 && t4.statut === 'Prêt à boire', JSON.stringify(t4));
  const t5 = ap({ name: 'Château de Fargues', color: 'Blanc', region: 'Sauternes', year: 2015, grape: 'Sémillon' }, 2026);
  T('apogée : Sauternes 2015 → liquoreux +20 ans, à garder en 2026', t5.pic === 2035 && t5.statut === 'À garder', JSON.stringify(t5));
  const t6 = ap({ name: 'Château Latour', color: 'Rouge', region: 'Pauillac', year: 2016 }, 2026);
  T('apogée : premier grand cru 2016 → +15 ans, à garder en 2026', t6.pic === 2031 && t6.statut === 'À garder' && t6.ans === 15, JSON.stringify(t6));
  const t7 = ap({ name: 'Chardonnay Vin de France', color: 'Blanc', region: 'Vin de France', year: 2024 }, 2026);
  T('apogée : VDF blanc 2024 → +2 ans (léger), pic 2026', t7.pic === 2026 && t7.ans === 2, JSON.stringify(t7));
  const t8 = ap({ name: 'Meursault Les Charmes', color: 'Blanc', region: 'Meursault', year: 2022 }, 2026);
  T('apogée : blanc de Bourgogne 2022 → +8 ans, à garder en 2026', t8.pic === 2030 && t8.statut === 'À garder', JSON.stringify(t8));
  const t9 = ap({ name: 'Rioja Gran Reserva', color: 'Rouge', region: 'Rioja', year: 2010 }, 2026);
  T('apogée : étranger prestige (gran reserva) → +15 ans', t9.ans === 15, JSON.stringify(t9));
  T('apogée : phrase de la fiche contient le pic et la fenêtre', /Apogée estimée 2031 \(entre 2029 et 2033\)/.test(A.apogeeTexte(t6)), A.apogeeTexte(t6));
}
console.log(out.join('\n'));
const mw=L.normalizeWine({name:'Chassagne-Montrachet',dom:'Paul Jouard',year:2012,loc:'Casier B'});
console.log([['montra',true],['jou mont',true],['12',false],['2012',true],['xyz',false],['',true]].map(([q,e])=>(L.matchesQuery(mw,q)===e?'PASS':'FAIL')+' recherche « '+q+' »').join('\n'));

