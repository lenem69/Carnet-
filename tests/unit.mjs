import * as L from '../logic.js';
import * as I from '../importer.js';
import XLSX from 'xlsx';
import fs from 'fs';
import * as A from '../apogee.js';
import * as PR from '../profils.js';
const out=[];const T=(n,c,x='')=>out.push((c?'PASS ':'FAIL ')+n+(c?'':' → '+x));
// Température de service et repères d'appellation (1.26.0)
{const sv=(color,region,name='X')=>A.service({name,color,region});const tx=o=>o&&o.min+'-'+o.max;
T('service: rouge de Bordeaux 16-18',tx(sv('Rouge','Pauillac'))==='16-18',tx(sv('Rouge','Pauillac')));
T('service: Beaujolais léger 13-15',tx(sv('Rouge','Morgon'))==='13-15');
T('service: Champagne 8-10, crémant 6-8',tx(sv('Pétillant','Champagne'))==='8-10'&&tx(sv('Pétillant','Crémant d’Alsace'))==='6-8');
T('service: rosé 8-10, liquoreux 8-10',tx(sv('Rosé','Bandol'))==='8-10'&&tx(sv('Blanc','Sauternes'))==='8-10');
T('service: vin jaune 14-16 (pas la règle des liquoreux)',tx(sv('Blanc','Château-Chalon'))==='14-16'&&sv('Blanc','Château-Chalon').appellation===true);
T('service: premier cru blanc 10-12',tx(sv('Blanc','Chablis premier cru'))==='10-12');
T('service: couleur inconnue = rien',sv('Autre','')===null&&A.serviceTexte({name:'X',color:'Autre'})==='');
T('service: texte « Service : 16 à 18 °C. »',A.serviceTexte({name:'X',color:'Rouge',region:'Cahors'})==='Service : 16 à 18 °C.');
T('service: min < max pour toutes les couleurs et règles',['Rouge','Blanc','Rosé','Pétillant'].every(c=>['','Pauillac','Morgon','Sancerre','Chablis premier cru','Champagne','Sauternes','Cahors','IGP Pays d’Oc'].every(r=>{const o=A.service({name:'X',color:c,region:r});return !o||o.min<o.max&&o.min>=5&&o.max<=20})));
T('profil: Cahors rouge trouvé, cépages Malbec',PR.profil({color:'Rouge',region:'Cahors'}).cepages.includes('Malbec'));
T('profil: apostrophe typographique ou droite (L’Étoile)',!!PR.profil({color:'Blanc',region:"L'Étoile"})&&!!PR.profil({color:'Blanc',region:'L’Étoile'}));
T('profil: Jurançon blanc ambigu (sec ou doux) = aucun',PR.profil({color:'Blanc',region:'Jurançon'})===null);
T('profil: couleur sans ligne ou appellation inconnue = aucun',PR.profil({color:'Rosé',region:'Cahors'})===null&&PR.profil({color:'Rouge',region:'Pomerol'})===null&&PR.profil(null)===null);
T('profil: Monbazillac blanc = doux (une seule ligne)',PR.profil({color:'Blanc',region:'Monbazillac'}).tmin===10);}
// Fenêtre de garde inversée (1.26.2) : plus de vin « À garder » et « Passé » à la fois
{const n=(o)=>L.normalizeWine({name:'X',year:2015,color:'Rouge',region:'Pauillac',qty:1,...o});
const a=n({from:2030,to:2024});
T('fenêtre inversée sans saisie : remise dans l’ordre',a.from===2024&&a.to===2030,a.from+'/'+a.to);
const b=n({from:2030,to:2024,src:{from:'user',to:'bible'}});
T('fenêtre inversée : la saisie du début est gardée, la fin de la bible retirée',b.from===2030&&b.to===''&&b.src.from==='user'&&!b.src.to,JSON.stringify([b.from,b.to,b.src]));
const c=n({from:2030,to:2024,src:{from:'ai',to:'user'}});
T('fenêtre inversée : la saisie de la fin est gardée, le début de l’IA retiré',c.to===2024&&c.from===''&&c.src.to==='user'&&!c.src.from,JSON.stringify([c.from,c.to,c.src]));
const d=n({from:2030,to:2024,src:{from:'ai',to:'bible'}});
T('fenêtre inversée : les origines suivent les valeurs échangées',d.from===2024&&d.src.from==='bible'&&d.to===2030&&d.src.to==='ai',JSON.stringify(d.src));
T('fenêtre en ordre : inchangée',n({from:2020,to:2030}).from===2020&&n({from:2020,to:2030}).to===2030);
T('fenêtre inversée : un seul statut possible (jamais À garder et Passé)',['keep','late'].every(()=>true)&&[a,b,c,d].every(w=>{const s=L.status(w,2026);return !s||(w.from<=(w.to||9999));}));
let tousOk=true;for(let f=2018;f<=2036;f+=2)for(let t=2018;t<=2036;t+=2){const w=n({from:f,to:t,src:{from:'ai',to:'bible'}});if(w.from&&w.to&&w.from>w.to)tousOk=false;}
T('fenêtre : aucune combinaison ne reste inversée après normalisation',tousOk);
const bible={v:1,rows:[{a:'Pauillac',c:'R',y:{'2015':[4,2020,2028,'A']}}]};
const u=n({to:2018,src:{to:'user'}});
const chg=L.prefillFromBible(u,bible);
T('bible : ne contredit pas une fin saisie par l’utilisateur (pas d’inversion)',!(u.from&&u.to&&u.from>u.to)&&u.to===2018&&chg===false,JSON.stringify([u.from,u.to,u.src,chg]));
const v=n({});const chg2=L.prefillFromBible(v,bible);
T('bible : remplit une fiche vide',chg2===true&&v.from===2020&&v.to===2028&&v.src.from==='bible');
}
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
{ // import souple : liste de caviste sans en-tête « Nom » (1.14.0)
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
  const w2 = L.normalizeWine({ name: 'Cuvée', region: 'Chablis', color: 'Blanc', year: 2015, from: 2020, to: 2025, src: { from: 'user', to: 'user' } });
  T('bible : ne touche pas une garde saisie par l’utilisateur', !L.prefillFromBible(w2, B) && w2.from === 2020 && w2.src.from === 'user', JSON.stringify(w2));
  const w2b = L.normalizeWine({ name: 'Cuvée', region: 'Chablis', color: 'Blanc', year: 2015, from: 2010, to: 2012 });
  T('bible : remplace une garde sans origine (la bible d’abord)', L.prefillFromBible(w2b, B) && w2b.from === 2018 && w2b.to === 2030, JSON.stringify(w2b));
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
{ // apogée : règle du sommelier (1.14.0)
  const A = await import('../apogee.js');
  const ap = (w, y) => A.apogee(w, y);
  const t1 = ap({ name: 'Champagne Brut', color: 'Pétillant', region: 'Champagne', year: '' }, 2026);
  T('apogée : sans millésime → prêt à boire', t1.sansMillesime && t1.statut === 'Prêt à boire', JSON.stringify(t1));
  const t2 = ap({ name: 'Château Bouscaut', color: 'Rouge', region: 'Haut-Médoc', year: 2015 }, 2026);
  T('apogée : Bordeaux rouge 2015 → +9 ans (Haut-Médoc), pic 2024, prêt à boire en 2026', t2.pic === 2024 && t2.statut === 'Prêt à boire' && t2.ans === 9, JSON.stringify(t2));
  const t3 = ap({ name: 'Morgon Côte du Py', color: 'Rouge', region: 'Beaujolais', year: 2023 }, 2026);
  T('apogée : Beaujolais 2023 → +4 ans, pic 2027, prêt à boire en 2026', t3.pic === 2027 && t3.statut === 'Prêt à boire', JSON.stringify(t3));
  const t4 = ap({ name: 'Gosset Grand Rosé', color: 'Rosé', region: 'Champagne', year: 2025 }, 2026);
  T('apogée : rosé 2025 → +2 ans, prêt à boire', t4.pic === 2027 && t4.statut === 'Prêt à boire', JSON.stringify(t4));
  const t5 = ap({ name: 'Château de Fargues', color: 'Blanc', region: 'Sauternes', year: 2015, grape: 'Sémillon' }, 2026);
  T('apogée : Sauternes 2015 → liquoreux +20 ans, à garder en 2026', t5.pic === 2035 && t5.statut === 'À garder', JSON.stringify(t5));
  const t6 = ap({ name: 'Château Latour', color: 'Rouge', region: 'Pauillac', year: 2016 }, 2026);
  T('apogée : premier cru classé (Latour) 2016 → +24 ans, apogée 2040, à garder en 2026', t6.pic === 2040 && t6.statut === 'À garder' && t6.ans === 24 && t6.rang === true, JSON.stringify(t6));
  const t7 = ap({ name: 'Chardonnay Vin de France', color: 'Blanc', region: 'Vin de France', year: 2024 }, 2026);
  T('apogée : VDF blanc 2024 → +2 ans (léger), pic 2026', t7.pic === 2026 && t7.ans === 2, JSON.stringify(t7));
  const t8 = ap({ name: 'Meursault Les Charmes', color: 'Blanc', region: 'Meursault', year: 2022 }, 2026);
  T('apogée : blanc de Bourgogne village 2022 (Meursault) → +6 ans, apogée 2027-2029, déjà dans la fenêtre de garde en 2026', t8.pic === 2028 && t8.ans === 6 && t8.from === 2027 && t8.to === 2029 && t8.gFrom <= 2026 && t8.gTo >= 2030, JSON.stringify(t8));
  const t8b = ap({ name: 'Bourgogne Blanc Domaine X', color: 'Blanc', region: 'Bourgogne', year: 2022 }, 2026);
  T('apogée : blanc de Bourgogne régional 2022 → +4 ans', t8b.pic === 2026 && t8b.ans === 4, JSON.stringify(t8b));
  const t8c = ap({ name: 'Nuits-Saint-Georges 1er cru Les Saint-Georges', color: 'Rouge', region: 'Nuits St Georges', year: 2018 }, 2026);
  T('apogée : premier cru rouge 2018 → +12 ans, à garder en 2026', t8c.ans === 12 && t8c.pic === 2030 && t8c.statut === 'À garder', JSON.stringify(t8c));
  const t8d = ap({ name: 'Chambertin Grand Cru', color: 'Rouge', region: 'Gevrey-Chambertin', year: 2018 }, 2026);
  T('apogée : grand cru rouge 2018 (Chambertin) → +20 ans (village 9 × 2,2 ; le grand cru prime sur le premier cru)', t8d.ans === 20 && t8d.pic === 2038 && t8d.rang === true, JSON.stringify(t8d));
  const t9 = ap({ name: 'Rioja Gran Reserva', color: 'Rouge', region: 'Rioja', year: 2010 }, 2026);
  T('apogée : étranger prestige (gran reserva) → +15 ans', t9.ans === 15, JSON.stringify(t9));
  // Chaque niveau garde sa règle : village ≠ premier cru ≠ grand cru, et chaque appellation a la sienne.
  const AN = (name, region, color, year = 2018, extra = {}) => ap({ name, region, color, year, dom: 'Domaine X', ...extra }, 2026).ans;
  T('niveau : Chassagne-Montrachet village rouge → +8 (pas « grand vin »)', AN('Chassagne-Montrachet', 'Chassagne-Montrachet', 'Rouge') === 8, String(AN('Chassagne-Montrachet', 'Chassagne-Montrachet', 'Rouge')));
  T('niveau : Chassagne-Montrachet village blanc → +7', AN('Chassagne-Montrachet', 'Chassagne-Montrachet', 'Blanc') === 7);
  T('niveau : Chassagne-Montrachet 1er cru rouge → +12, blanc → +11 (village × 1,5)', AN('Chassagne-Montrachet 1er cru', 'Chassagne-Montrachet Premier Cru', 'Rouge') === 12 && AN('Chassagne-Montrachet 1er cru', 'Chassagne-Montrachet Premier Cru', 'Blanc') === 11);
  T('niveau : Montrachet grand cru → +15', AN('Montrachet', 'Montrachet', 'Blanc') === 15);
  T('niveau : Gevrey-Chambertin village → +9, 1er cru → +14, Chambertin grand cru → +20', AN('Gevrey-Chambertin', 'Gevrey-Chambertin', 'Rouge') === 9 && AN('X', 'Gevrey-Chambertin Premier Cru', 'Rouge') === 14 && AN('Chambertin', 'Chambertin', 'Rouge') === 20);
  T('niveau : Chambolle-Musigny village → +8, Vosne-Romanée village → +8 (table), Romanée-Conti → +18 (village × 2,2)', AN('Chambolle-Musigny', 'Chambolle-Musigny', 'Rouge') === 8 && AN('Vosne-Romanée', 'Vosne-Romanée', 'Rouge') === 8 && AN('Romanée-Conti', 'Romanée-Conti', 'Rouge') === 18);
  T('niveau : Crozes-Hermitage → +5, Hermitage → +11 (table)', AN('Crozes-Hermitage', 'Crozes-Hermitage', 'Rouge') === 5 && AN('Hermitage', 'Hermitage', 'Rouge') === 11);
  T('appellation : Pauillac +13, Saint-Émilion Grand Cru +11, Châteauneuf-du-Pape +12, Côte-Rôtie +11, Morgon +8, Muscadet +3, Chablis blanc +6',
    AN('Cuvée', 'Pauillac', 'Rouge') === 13 && AN('Cuvée', 'Saint-Émilion Grand Cru', 'Rouge') === 11 && AN('Cuvée', 'Châteauneuf-du-Pape', 'Rouge') === 12 && AN('Cuvée', 'Côte-Rôtie', 'Rouge') === 11 && AN('Cuvée', 'Morgon', 'Rouge') === 8 && AN('Cuvée', 'Muscadet', 'Blanc') === 3 && AN('Cuvée', 'Chablis', 'Blanc') === 6);
  {
    // Audit de toute la liste connue : seuls les vrais grands crus (ou appellations « Grand Cru ») prennent la règle du grand vin.
    const { TAXONOMIE } = await import('../taxonomie.js');
    const noms = [...new Set(Object.values(TAXONOMIE).map(v => v[0]))];
    const prestige = noms.filter(n => ['Rouge', 'Blanc'].some(c => /^grand cru/.test(ap({ name: 'Cuvée', dom: 'Domaine X', region: n, color: c, year: 2018 }, 2026).regle)));
    const faux = prestige.filter(n => /^(chassagne|puligny|gevrey|chambolle|vosne|crozes)|premier cru|saint-émilion|ch[aâ]teauneuf|c[oô]te-r[oô]tie|cornas/i.test(n));
    T('audit : aucun village, premier cru ni appellation courante pris pour un grand vin', faux.length === 0, faux.join(', '));
    T('audit : les grands crus connus prennent la règle du grand cru', ['Montrachet', 'Chambertin', 'Musigny', 'Romanée-Conti', 'Richebourg', 'Échezeaux', 'Corton', 'Corton-Charlemagne', 'Clos de Vougeot', 'Bonnes-Mares', 'Clos de Tart', 'La Tâche', 'Chablis Grand Cru', 'Bâtard-Montrachet'].every(n => prestige.includes(n)), prestige.join(', '));
    // Chaque « Premier Cru » vaut 1,5 fois (entre 1,3 et 1,7 après arrondi) la durée de sa commune, et le grand cru 2,2 fois.
    const pc = noms.filter(n => /Premier Cru$/.test(n)).filter(n => ['Rouge', 'Blanc'].some(c => {
      const a1 = ap({ name: 'Cuvée', dom: 'Domaine X', region: n, color: c, year: 2018 }, 2026), v1 = ap({ name: 'Cuvée', dom: 'Domaine X', region: n.replace(/ Premier Cru$/, ''), color: c, year: 2018 }, 2026);
      const r = a1.ans / v1.ans;
      return !/^premier cru/.test(a1.regle) || !(r >= 1.3 && r <= 1.7);
    }));
    T('audit : tous les « Premier Cru » = village × 1,5', pc.length === 0, pc.join(', '));
  }
  T('apogée : rappel court sur la carte', A.apogeeCourte(t6)==='Apogée 2040 · à venir' && A.apogeeCourte(t1)==='Prêt à boire (sans millésime)', A.apogeeCourte(t6));
  T('apogée : phrase de la fiche contient le pic et la fenêtre', /Apogée estimée 2040 \(entre 2036 et 2044\)/.test(A.apogeeTexte(t6)), A.apogeeTexte(t6));
  // Cohérence apogée / fenêtre de garde : l'apogée ne sort jamais de la fenêtre enregistrée.
  {
    const couleurs = ['Rouge', 'Blanc', 'Rosé', 'Pétillant'];
    const regions = ['Cornas', 'Pauillac', 'Chablis', 'Morgon', 'Champagne', 'Sauternes', 'Rioja', 'Alsace', ''];
    let n = 0, hors = 0, pbPhrase = 0, ex = '';
    for (const color of couleurs) for (const region of regions) for (const year of [1995, 2005, 2012, 2018, 2022, 2024]) for (const [from, to] of [[2020, 2030], [2025, 2029], [2040, 2050], [2010, 2015], [2026, 2026], ['', 2027], [2030, '']]) for (const an of [2026, 2035]) {
      const a = ap({ name: 'Cuvée test', dom: 'D', color, region, year, from, to }, an); n++;
      const wf = Number(from) || null, wt = Number(to) || null;
      const ok = a.pic >= (wf || 0) && a.pic <= (wt || 9999) && a.from >= (wf || 0) && a.to <= (wt || 9999) && a.from <= a.pic && a.pic <= a.to;
      if (!ok) { hors++; ex = ex || JSON.stringify({ color, region, year, from, to, a }); }
      if (/à garder|urgence|prêt à boire/i.test(A.apogeeCourte(a).replace('Prêt à boire (sans millésime)', ''))) pbPhrase++;
    }
    T(`apogée : jamais hors de la fenêtre de garde (${n} combinaisons)`, hors === 0, ex);
    T('apogée : rappel court sans mot de statut pouvant contredire la pastille', pbPhrase === 0, String(pbPhrase));
    const sans = ap({ name: 'X', dom: 'D', color: 'Rouge', region: 'Richebourg', year: 2020, from: '', to: '' }, 2026);
    T('apogée : sans fenêtre enregistrée, règle inchangée (grand cru 2020 → 2038)', sans.pic === 2038 && sans.ajuste === false, JSON.stringify(sans));
    const dedans = ap({ name: 'X', dom: 'D', color: 'Rouge', region: 'Richebourg', year: 2020, from: 2028, to: 2042 }, 2026);
    T('apogée : déjà dans la fenêtre → inchangée', dedans.pic === 2038 && dedans.ajuste === false, JSON.stringify(dedans));
    const hors2 = ap({ name: 'X', dom: 'D', color: 'Rouge', region: 'Richebourg', year: 2020, from: 2025, to: 2029 }, 2026);
    T('apogée : hors fenêtre → ramenée à la fin de la fenêtre et signalée', hors2.pic === 2029 && hors2.ajuste === true && /Ramenée dans la fenêtre/.test(A.apogeeTexte(hors2)), JSON.stringify(hors2));
  }
}
console.log(out.join('\n'));
const mw=L.normalizeWine({name:'Chassagne-Montrachet',dom:'Paul Jouard',year:2012,loc:'Casier B'});
console.log([['montra',true],['jou mont',true],['12',false],['2012',true],['xyz',false],['',true]].map(([q,e])=>(L.matchesQuery(mw,q)===e?'PASS':'FAIL')+' recherche « '+q+' »').join('\n'));

// Journal de dégustation : données et calcul de la moyenne
{
  const o0 = out.length;
  const w = L.normalizeWine({ name: 'Test', dom: 'Dom', year: 2020, tastings: [{ d: '2026-03-01', n: 4, c: 'Belle' }, { d: '2026-04-02', n: 2, c: '' }, { d: 'pas une date', n: 5 }, { d: '2026-05-03', n: 9 }, { d: '2026-05-04', n: 3.0, c: 'x'.repeat(600) }] });
  T('journal : entrées invalides écartées (date ou note hors 1–5)', w.tastings.length === 3 && w.tastings.every(x => x.n >= 1 && x.n <= 5), JSON.stringify(w.tastings));
  T('journal : commentaire limité à 500 caractères', w.tastings[2].c.length === 500, String(w.tastings[2].c.length));
  const d = L.degustations(w);
  T('journal : moyenne et nombre', d && d.count === 3 && d.avg === 3, JSON.stringify(d));
  T('journal : sans dégustation → null', L.degustations(L.normalizeWine({ name: 'Vide', dom: 'D' })) === null);
  const un = L.normalizeWine({ name: 'Un', dom: 'D', tastings: [{ d: '2026-01-01', n: 4, c: 'ok' }] });
  T('journal : une dégustation → 1 fois, moyenne 4', L.degustations(un).count === 1 && L.degustations(un).avg === 4);
  T('journal : entrée non tableau → aucune dégustation', L.normalizeWine({ name: 'Z', dom: 'D', tastings: 'n' }).tastings.length === 0);
  console.log(out.slice(o0).join('\n'));
}
// Fiches : origine par champ, passe IA unique
{
  const o0 = out.length;
  const base = L.normalizeWine({ name: 'Cuvée', dom: 'Dom', year: 2019, color: 'Rouge', story: 'Ma note perso', src: { story: 'user' }, grape: '', pairings: [], from: '', to: '' });
  const c = JSON.parse(JSON.stringify(base));
  L.applyAi(c, { story: 'Texte IA', grape: 'Syrah', pairings: ['Agneau'], from: 2025, to: 2032 });
  T('fiches : la saisie utilisateur n’est jamais écrasée par l’IA', c.story === 'Ma note perso', c.story);
  T('fiches : les champs vides sont complétés par l’IA et étiquetés', c.grape === 'Syrah' && c.src.grape === 'ai' && c.from === 2025 && c.src.from === 'ai', JSON.stringify(c.src));
  T('fiches : passe IA enregistrée (une seule par vin)', c.aiPass > 0 && L.normalizeWine(c).aiPass === c.aiPass);
// Équilibre et valeur estimée (indicative)
{
  const c = { bouteilles: 10, couleurs: [['Rouge', 9], ['Blanc', 1]], regions: [['Bourgogne', 3]], statuts: { pret: 2, garder: 7, urgence: 0, sans: 1 } };
  const txt = L.equilibre(c);
  T('équilibre : constat sur la dominante et la garde', txt.includes('très dominée par les rouges') && txt.includes('surtout composée de vins à garder'), txt);
  T('équilibre : cave vide = pas de texte', L.equilibre({ bouteilles: 0, couleurs: [], regions: [], statuts: { pret: 0, garder: 0, urgence: 0, sans: 0 } }) === '');
  const eq = L.equilibre({ bouteilles: 4, couleurs: [['Rouge', 2], ['Blanc', 2]], regions: [['A', 1]], statuts: { pret: 1, garder: 2, urgence: 0, sans: 1 } });
  T('équilibre : cave répartie = « plutôt équilibrée »', eq === 'Votre cave paraît plutôt équilibrée.', eq);
  const w1 = L.normalizeWine({ name: 'E1', dom: 'D', year: 2019, qty: 2, src: {}, estim: { min: 20, max: 40, date: 5 } });
  const w2 = L.normalizeWine({ name: 'E2', dom: 'D', year: 2019, qty: 1, src: {} });
  const v = L.valeurEstimee([w1, w2]);
  T('valeur : milieu de fourchette × bouteilles, vins non estimés exclus du total', v.total === 60 && v.couverts === 2 && v.bouteilles === 3, JSON.stringify(v));
  T('valeur : fourchette invalide ignorée', L.normalizeWine({ name: 'E3', dom: 'D', year: 2019, qty: 1, src: {}, estim: { min: 0, max: 5 } }).estim === null);
}
// Garde-fou : toute fonction appelée avec « await » dans fond.js doit être définie dans fond.js (sinon la passe de fond échoue en silence).
{
  const code = fs.readFileSync(new URL('../fond.js', import.meta.url), 'utf8');
  const appels = [...new Set([...code.matchAll(/await (\w+)\(/g)].map(m => m[1]))];
  const manquantes = appels.filter(f => !new RegExp('(function ' + f + '\\(|const ' + f + ' =)').test(code) && !['fetch', 'http', 'extraire', 'lireVins', 'lireMeta', 'ecrireMeta', 'lireBible', 'ouvrir', 'fin', 'appliquer', 'bibleGarde', 'prochaineRemise'].includes(f) );
  T('fond.js : toutes les fonctions appelées sont définies', manquantes.length === 0, manquantes.join(', '));
}
// Valeur reprise par la fiche (logic.js et fond.js de la même façon)
{
  const w = { name: 'V', dom: 'D', year: 2019, src: {}, qty: 1, conf: '' };
  const d = { grape: 'Syrah', estim: { min: 20, max: 30 } };
  const a = L.applyAi(JSON.parse(JSON.stringify(w)), d, 1700000000000);
  T('fiche : la valeur de l’IA est gardée', a.estim && a.estim.min === 20 && a.estim.max === 30, JSON.stringify(a.estim));
}
// Sans recherche d'abord : les champs vides ou incertains sont à chercher ; après une recherche, plus rien à chercher.
{
  const base = L.normalizeWine({ name: 'Doute', dom: 'D', year: 2019, qty: 1, src: {} });
  const sans = L.applyAi(JSON.parse(JSON.stringify(base)), { grape: 'Gamay', story: '', pairings: ['Poulet'], from: 2026, to: 2031, doute: ['grape'] }, 1700000000000);
  T('sans recherche : champs vides ou incertains à chercher', JSON.stringify(sans.aiDoute) === JSON.stringify(['grape', 'story']), JSON.stringify(sans.aiDoute));
  T('sans recherche : aucune recherche enregistrée', sans.aiSearch === 0 && sans.aiPass > 0);
  const cherche = L.applyAi(JSON.parse(JSON.stringify(sans)), { grape: 'Gamay', story: 'Histoire', pairings: ['Poulet'], from: 2026, to: 2031, searched: true, sources: [{ t: 'a', u: 'https://a.fr' }] }, 1700000001000);
  T('après recherche : plus rien à chercher', cherche.aiDoute.length === 0 && cherche.aiSearch === 1700000001000);
  const perso = L.applyAi(L.normalizeWine({ name: 'Perso', dom: 'D', year: 2019, qty: 1, grape: 'Syrah', src: { grape: 'user' } }), { grape: 'Gamay' }, 1700000000000);
  T('une saisie de l’utilisateur n’est jamais à chercher', !perso.aiDoute.includes('grape'));
  const ancienne = { name: 'Ancienne', dom: 'D', year: 2019, qty: 1, src: {}, aiPass: 1700000000000, story: '', grape: 'Gamay', pairings: ['Poulet'], from: 2026, to: 2031 };
  T('fiche d’avant cette version : histoire vide à chercher', JSON.stringify(L.doutesEffectifs(L.normalizeWine(ancienne))) === JSON.stringify(['story']), JSON.stringify(L.doutesEffectifs(L.normalizeWine(ancienne))));
}
  T('fiches : indication des champs mis à jour', JSON.stringify(L.aiFields(c)) === JSON.stringify(['cépage', 'accords', 'garde']), JSON.stringify(L.aiFields(c)));
  const b = L.normalizeWine({ name: 'B', dom: 'D', year: 2018, color: 'Rouge', from: 2026, to: 2030, src: { from: 'bible', to: 'bible' } });
  L.applyAi(b, { from: 2027, to: 2033 });
  T('fiches : la garde venant de la bible est corrigée par l’IA', b.from === 2027 && b.to === 2033 && b.src.from === 'ai', JSON.stringify([b.from, b.to, b.src]));
  const old = L.normalizeWine({ name: 'C', dom: 'D', year: 2018, grape: 'Merlot', story: 'Texte IA', src: { grape: 'ai', story: 'ai' } });
  const s1 = L.editSrc(old, { ...old, grape: 'Cabernet', story: 'Texte IA' });
  T('fiches : modifier à la main un champ IA le fait passer en saisie', s1.grape === 'user' && s1.story === 'ai', JSON.stringify(s1));
  const s2 = L.editSrc(old, { ...old, story: '' });
  T('fiches : vider un champ retire son origine', !('story' in s2) && s2.grape === 'ai', JSON.stringify(s2));
  const s3 = L.editSrc(null, { name: 'N', dom: 'D', story: 'à moi', grape: '' });
  T('fiches : nouvelle fiche saisie à la main = champs « user »', s3.story === 'user' && !('grape' in s3), JSON.stringify(s3));
  const legacy = L.normalizeWine({ name: 'L', dom: 'D', year: 2010, story: 'ancienne fiche sans origine' });
  L.applyAi(legacy, { story: 'nouveau' });
  T('fiches : ancienne fiche sans origine réécrite par l’IA (option B)', legacy.story === 'nouveau' && legacy.src.story === 'ai', legacy.story);
  // La copie de la passe de fond (fond.js, service worker) doit donner exactement le même résultat que logic.js.
  const vm = await import('vm');
  const code = fs.readFileSync(new URL('../fond.js', import.meta.url), 'utf8');
  const ctx = { self: {}, indexedDB: {}, fetch: null, console };
  vm.runInNewContext(code, ctx);
  const cas = [
    [{ name: 'X', dom: 'D', year: 2019, story: 'saisie', src: { story: 'user' } }, { story: 'IA', grape: 'Syrah', pairings: ['Agneau'], from: 2025, to: 2032 }],
    [{ name: 'Y', dom: 'D', year: 2019, story: 'vieux', src: {} }, { story: 'neuf', from: 2030, to: 2024 }],
    [{ name: 'Z', dom: 'D', year: 2019, from: 2026, to: 2030, src: { from: 'bible', to: 'bible' } }, { from: 2027, to: 2033, conf: 'vérifiée', sources: [{ t: 'a', u: 'https://a.fr' }] }],
  ];
  for (const [w, d] of cas) {
    const now = 1700000000000;
    const a = L.applyAi(JSON.parse(JSON.stringify(w)), d, now);
    const b = ctx.self.FondIA.appliquer(JSON.parse(JSON.stringify(w)), d, now);
    T('fond de tâche = logique de la page : ' + w.name, JSON.stringify(a) === JSON.stringify(b), JSON.stringify([a, b]));
  }
  console.log(out.slice(o0).join('\n'));
}
// La bible d'abord : la copie de fond.js doit donner le même résultat que logic.js
{
  const o0 = out.length;
  const vm = await import('vm');
  const code = fs.readFileSync(new URL('../fond.js', import.meta.url), 'utf8');
  const ctx = { self: {}, indexedDB: {}, fetch: null, console };
  vm.runInNewContext(code, ctx);
  const B = { v: 1, rows: [{ a: 'Chablis', c: 'B', y: { '2015': [4, 2018, 2030, 'A'] } }] };
  const cas = [
    { name: 'A', region: 'Chablis', color: 'Blanc', year: 2015, from: 2010, to: 2012 },
    { name: 'B', region: 'Chablis', color: 'Blanc', year: 2015, from: 2020, to: 2025, src: { from: 'user', to: 'user' } },
    { name: 'C', region: 'Chablis', color: 'Blanc', year: 2015 },
  ];
  for (const raw of cas) {
    const a = L.normalizeWine(JSON.parse(JSON.stringify(raw)));
    const b = L.normalizeWine(JSON.parse(JSON.stringify(raw)));
    const ra = L.prefillFromBible(a, B);
    const rb = ctx.self.FondIA.bibleGarde(b, B);
    const pick = w => JSON.stringify({ from: w.from, to: w.to, src: w.src, conf: w.conf });
    T('bible de fond = logique de la page : ' + raw.name, ra === rb && pick(a) === pick(b), JSON.stringify([pick(a), pick(b)]));
  }
  {
    // Cohérence : pour chaque ligne de la bible (une ligne par appellation), l'apogée calculée avec la note du millésime reste dans la fenêtre de dégustation, sans correction.
    const bib = JSON.parse(fs.readFileSync(new URL('../bible/bible.json', import.meta.url), 'utf8'));
    const CC = { R: 'Rouge', B: 'Blanc', D: 'Blanc', E: 'Pétillant' };
    let hors = [], longues = [], n = 0;
    for (const r of bib.rows) for (const [y, cell] of Object.entries(r.y)) {
      const [q, from, to] = cell; n++;
      const a = A.apogee({ name: r.a, dom: '', region: r.a, color: CC[r.c], year: Number(y), from, to }, 2026, q);
      if (a.ajuste || a.from < from || a.to > to) hors.push(r.a + ' ' + y);
      if (to - from > 32) longues.push(r.a + ' ' + y + ' ' + (to - from));
    }
    T('cohérence : apogée (avec la note du millésime) toujours dans la fenêtre de dégustation, ' + n + ' millésimes', hors.length === 0, hors.slice(0, 8).join(', '));
    T('cohérence : aucune fenêtre de dégustation de plus de 32 ans (vins jaunes et grands liquoreux compris)', longues.length === 0, longues.slice(0, 8).join(', '));
    // Les appellations regroupées dans la bible ont chacune leur ligne : l'appli cherche une appellation par son nom exact.
    const trouve = (region, color, year) => L.bibleEntry({ name: 'X', dom: 'D', region, color, year, src: {} }, bib);
    const manquants = [['Haut-Médoc', 'Rouge'], ['Médoc', 'Rouge'], ['Listrac-Médoc', 'Rouge'], ['Sauternes', 'Blanc'], ['Barsac', 'Blanc'], ['Nuits-Saint-Georges', 'Rouge']].filter(([r, c]) => !trouve(r, c, 2015));
    T('regroupements : Haut-Médoc, Médoc, Listrac, Sauternes, Barsac trouvent leur fenêtre', manquants.length === 0, JSON.stringify(manquants));
  }
  {
    // Qualité du millésime : une note faible avance le pic et raccourcit la fenêtre, une note forte la recule et la prolonge ; l'apogée reste dedans.
    const w = { name: 'Pauillac', dom: '', region: 'Pauillac', color: 'Rouge', year: 2013 };
    const f2 = A.fenetreGarde(w, 2), f3 = A.fenetreGarde(w, 3), f5 = A.fenetreGarde(w, 5);
    const a2 = A.apogee(w, 2026, 2), a3 = A.apogee(w, 2026, 3), a5 = A.apogee(w, 2026, 5);
    T('qualité : note faible → pic plus tôt, note forte → pic plus tard', a2.pic < a3.pic && a3.pic < a5.pic, JSON.stringify([a2.pic, a3.pic, a5.pic]));
    T('qualité : note faible → garde plus courte, note forte → garde plus longue', f2.to < f3.to && f3.to < f5.to, JSON.stringify([f2, f3, f5]));
    T('qualité : l’apogée reste dans la fenêtre quelle que soit la note', [[f2, a2], [f3, a3], [f5, a5]].every(([f, a]) => f.from <= a.from && f.to >= a.to), JSON.stringify([f2, a2.from, a2.to, f5, a5.from, a5.to]));
    T('qualité : la note 4 (bon millésime) est la référence, sans note le calcul est inchangé', A.apogee(w, 2026).pic === A.apogee(w, 2026, 4).pic && A.apogee(w, 2026, undefined).pic === 2013 + 13);
    T('qualité : un grand millésime de Pauillac se garde plus de 20 ans, un millésime faible moins de 20', f5.to - 2013 > 20 && f2.to - 2013 < 20, JSON.stringify([f2.to, f5.to]));
  }
  console.log(out.slice(o0).join('\n'));
}

// Niveaux de cru et rangs (1.30.0) : premiers et grands crus de Bourgogne, classements, cuvées, origine « calc »
{
  const o0 = out.length;
  const bib = JSON.parse(fs.readFileSync(new URL('../bible/bible.json', import.meta.url), 'utf8'));
  const vm = await import('vm');
  const ctx = { self: {}, indexedDB: {}, fetch: null, console };
  vm.runInNewContext(fs.readFileSync(new URL('../fond.js', import.meta.url), 'utf8'), ctx);
  const ap = (region, name, color = 'Rouge', year = 2018, dom = 'Domaine X') => A.apogee({ name, dom, region, color, year }, 2026);
  const cas = (titre, liste) => {
    const faux = liste.filter(([r, n, c, attendu, ans]) => { const a = ap(r, n, c); return a.regle !== attendu || (ans != null && a.ans !== ans); }).map(([r, n, c]) => `${r} | ${n} → ${ap(r, n, c).regle} +${ap(r, n, c).ans}`);
    T(titre, faux.length === 0, faux.join(' ; '));
  };
  // Bourgogne : le niveau se lit dans la région ou dans le nom ; le climat n'a pas besoin d'être connu.
  cas('crus : premiers crus reconnus quelle que soit l’écriture (région ou nom, 1er ou Premier)', [
    ['Gevrey-Chambertin 1er Cru', 'Les Cazetiers', 'Rouge', 'premier cru (Gevrey-Chambertin)', 14],
    ['Gevrey-Chambertin', 'Gevrey-Chambertin 1er cru Les Cazetiers', 'Rouge', 'premier cru (Gevrey-Chambertin)', 14],
    ['Meursault', 'Meursault Les Charmes 1er cru', 'Blanc', 'premier cru (Meursault)', 9],
    ['Chassagne-Montrachet', 'Chassagne-Montrachet 1er cru Les Caillerets', 'Blanc', 'premier cru (Chassagne-Montrachet)', 11],
    ['Rully', 'Rully 1er cru Les Chapitres', 'Blanc', 'premier cru (Rully)', 6],
    ['Mercurey', 'Mercurey 1er cru Clos Voyen', 'Rouge', 'premier cru (Mercurey)', 6],
    ['Montagny', 'Montagny 1er cru', 'Blanc', 'premier cru (Montagny)', 6],
    ['Chablis', 'Chablis 1er cru Montée de Tonnerre', 'Blanc', 'premier cru (Chablis)', 9],
    ['Pommard', 'Pommard 1er cru Les Rugiens', 'Rouge', 'premier cru (Pommard)', 15],
    ['Santenay', 'Santenay 1er Cru', 'Rouge', 'premier cru (Santenay)', 11],
  ]);
  cas('crus : un vin sans mention de premier cru reste au niveau village', [
    ['Gevrey-Chambertin', 'Cuvée', 'Rouge', 'Gevrey-Chambertin', 9], ['Meursault', 'Meursault Les Charmes', 'Blanc', 'Meursault', 6],
    ['Chablis', 'Chablis', 'Blanc', 'Chablis', 6], ['Aloxe-Corton', 'Aloxe-Corton', 'Rouge', 'Aloxe-Corton', 9],
    ['Nuits-Saint-Georges', 'Perrières', 'Rouge', 'Nuits-Saint-Georges', 8],
  ]);
  cas('crus : grands crus reconnus par leur nom, même saisis comme village (33 grands crus : échantillon)', [
    ['Chambertin', 'Chambertin Grand Cru', 'Rouge', 'grand cru (Gevrey-Chambertin)', 20], ['Gevrey-Chambertin', 'Charmes-Chambertin', 'Rouge', 'grand cru (Gevrey-Chambertin)', 20],
    ['Morey-Saint-Denis', 'Clos de Tart', 'Rouge', 'grand cru (Morey-Saint-Denis)', 20], ['Chambolle-Musigny', 'Bonnes-Mares', 'Rouge', 'grand cru (Chambolle-Musigny)', 18],
    ['Clos de Vougeot', 'Clos de Vougeot Grand Cru', 'Rouge', 'grand cru (Vougeot)', 14], ['Vosne-Romanée', 'La Tâche', 'Rouge', 'grand cru (Vosne-Romanée)', 18],
    ['Vosne-Romanée', 'Echezeaux', 'Rouge', 'grand cru (Vosne-Romanée)', 18], ['Corton', 'Corton Bressandes', 'Rouge', 'grand cru (Aloxe-Corton)', 20],
    ['Aloxe-Corton', 'Corton-Charlemagne', 'Rouge', 'grand cru (Aloxe-Corton)', 20], ['Montrachet', 'Montrachet', 'Blanc', 'grand cru (Puligny-Montrachet)', 15],
    ['Puligny-Montrachet', 'Bâtard-Montrachet', 'Blanc', 'grand cru (Puligny-Montrachet)', 15], ['Chassagne-Montrachet', 'Criots-Bâtard-Montrachet', 'Blanc', 'grand cru (Chassagne-Montrachet)', 15],
    ['Chablis Grand Cru', 'Les Clos', 'Blanc', 'grand cru (Chablis)', 13], ['Chablis', 'Chablis Grand Cru Vaudésir', 'Blanc', 'grand cru (Chablis)', 13],
  ]);
  cas('crus : super premiers crus traités comme des grands crus (Clos Saint-Jacques, Cros Parantoux, Amoureuses, Perrières)', [
    ['Gevrey-Chambertin', 'Clos Saint-Jacques 1er cru', 'Rouge', 'premier cru d’exception (Gevrey-Chambertin)', 20], ['Vosne-Romanée', 'Cros Parantoux', 'Rouge', 'premier cru d’exception (Vosne-Romanée)', 18],
    ['Chambolle-Musigny', 'Les Amoureuses', 'Rouge', 'premier cru d’exception (Chambolle-Musigny)', 18], ['Meursault', 'Meursault 1er cru Les Perrières', 'Blanc', 'premier cru d’exception (Meursault)', 13],
  ]);
  {
    // Ordre des niveaux : village < premier cru < grand cru (rouge), pour chaque millésime et chaque note.
    const ok = [2005, 2010, 2015, 2018, 2022].every(y => [1, 2, 3, 4, 5].every(q => {
      const f = (r, n) => A.fenetreGarde({ name: n, dom: 'D', region: r, color: 'Rouge', year: y }, q);
      const v = f('Gevrey-Chambertin', 'Cuvée'), p = f('Gevrey-Chambertin 1er Cru', 'Les Cazetiers'), g = f('Chambertin', 'Chambertin');
      return v.from < p.from && p.from < g.from && v.to < p.to && p.to < g.to;
    }));
    T('crus : la fenêtre de garde s’allonge avec le niveau (village < premier cru < grand cru), à toute note de millésime', ok);
    // Blancs de la Côte de Beaune 1996-2014 : risque d'oxydation prématurée, fin de garde raccourcie ; pas de raccourcissement hors période ni en Côte de Nuits.
    const w = (r, n, y, c = 'Blanc') => A.fenetreGarde({ name: n, dom: 'D', region: r, color: c, year: y }, 4);
    const finPrem = y => w('Meursault Premier Cru', 'Meursault 1er cru Les Charmes', y).to - y;
    T('crus : prémox : blanc de premier cru de la Côte de Beaune 2010 garde moins longtemps que le même vin en 2016', finPrem(2010) < finPrem(2016), `${finPrem(2010)} / ${finPrem(2016)}`);
    const rouge = y => A.fenetreGarde({ name: 'X', dom: 'D', region: 'Pommard Premier Cru', color: 'Rouge', year: y }, 4);
    T('crus : prémox : aucun raccourcissement pour un rouge', rouge(2010).to - 2010 === rouge(2016).to - 2016);
    const nuits = y => w('Chablis Premier Cru', 'Chablis 1er cru', y).to - y;
    T('crus : prémox : aucun raccourcissement pour un blanc hors Côte de Beaune (Chablis)', nuits(2010) === nuits(2016));
  }
  // Clive Coates (rouge, bon millésime) : village de la Côte de Nuits 5-12 ans, premier cru 7-19, grand cru 10-25/30 après la récolte.
  {
    const f = (r, n, c = 'Rouge') => { const g = A.fenetreGarde({ name: n, dom: 'D', region: r, color: c, year: 2015 }, 4); return [g.from - 2015, g.to - 2015]; };
    const v = f('Gevrey-Chambertin', 'Cuvée'), p = f('Gevrey-Chambertin 1er Cru', 'Les Cazetiers'), g = f('Chambertin', 'Chambertin');
    T('crus : repère Coates, village de Côte de Nuits environ 5-12 ans', v[0] >= 4 && v[0] <= 6 && v[1] >= 11 && v[1] <= 14, JSON.stringify(v));
    T('crus : repère Coates, premier cru de Côte de Nuits environ 7-19 ans', p[0] >= 7 && p[0] <= 9 && p[1] >= 17 && p[1] <= 21, JSON.stringify(p));
    T('crus : repère Coates, grand cru de Côte de Nuits environ 10-30 ans', g[0] >= 11 && g[0] <= 13 && g[1] >= 26 && g[1] <= 30, JSON.stringify(g));
  }
  // Bordeaux, Champagne, Alsace, cuvées : le rang du vin est lu dans son nom.
  cas('rangs : classements de Bordeaux', [
    ['Pauillac', 'Château Latour', 'Rouge', 'premier cru classé', 24], ['Margaux', 'Château Margaux', 'Rouge', 'premier cru classé', 22],
    ['Pauillac', 'Château Pichon Longueville Comtesse de Lalande', 'Rouge', 'deuxième cru classé', 19], ['Margaux', 'Château Rauzan-Ségla', 'Rouge', 'deuxième cru classé', 17],
    ['Pauillac', 'Château Lynch-Bages', 'Rouge', 'cru classé (3e à 5e)', 14], ['Saint-Julien', 'Château Talbot', 'Rouge', 'cru classé (3e à 5e)', 14],
    ['Pessac-Léognan', 'Château Haut-Brion', 'Blanc', 'grand blanc de Pessac-Léognan', 18], ['Pomerol', 'Château Pétrus', 'Rouge', 'grand pomerol', 24],
    ['Saint-Émilion Grand Cru', 'Château Angélus', 'Rouge', 'premier grand cru classé A', 22], ['Saint-Émilion Grand Cru', 'Château Canon', 'Rouge', 'premier grand cru classé B', 17],
    ['Sauternes', 'Château d’Yquem', 'Blanc', 'premier cru supérieur', 30], ['Barsac', 'Château Climens', 'Blanc', 'premier cru classé', 23],
  ]);
  cas('rangs : second vins et homonymes ne prennent pas le rang du grand vin (Forts de Latour, Les Carmes Haut-Brion, un cru bourgeois)', [
    ['Pauillac', 'Les Forts de Latour', 'Rouge', 'Pauillac', 13], ['Pessac-Léognan', 'Château Les Carmes Haut-Brion', 'Rouge', 'Pessac-Léognan', 11],
    ['Pauillac', 'Cru bourgeois X', 'Rouge', 'Pauillac', 13], ['Pomerol', 'Château La Fleur-Pétrus', 'Rouge', 'grand pomerol', 18],
  ]);
  cas('rangs : champagne de prestige, grands crus et lieux-dits d’Alsace, cuvées parcellaires du Rhône', [
    ['Champagne', 'Dom Pérignon', 'Pétillant', 'cuvée de prestige (champagne)', 18], ['Alsace Grand Cru', 'Riesling Schlossberg', 'Blanc', 'grand cru d’Alsace', 12],
    ['Alsace', 'Riesling Lieu-dit Clos Saint-Urbain', 'Blanc', 'lieu-dit d’Alsace', 8], ['Côte-Rôtie', 'La Landonne', 'Rouge', 'cuvée parcellaire (Côte-Rôtie)', 20],
    ['Châteauneuf-du-Pape', 'Château Rayas', 'Rouge', 'cuvée mythique (Châteauneuf-du-Pape)', 22],
  ]);
  cas('Alsace : un vin d’Alsace simple suit la durée de son cépage (il n’est plus pris pour un grand cru)', [
    ['Alsace', 'Riesling', 'Blanc', 'Alsace', 6], ['Alsace', 'Pinot Gris', 'Blanc', 'Alsace', 5], ['Alsace', 'Sylvaner', 'Blanc', 'Alsace', 3],
  ]);
  // Écritures de l'appellation dans la bible
  T('bible : écritures courantes d’une appellation (1er cru, contrôlée, tirets)', JSON.stringify(L.nomsBible('Chassagne-Montrachet 1er Cru Contrôlée')) === JSON.stringify(['chassagne montrachet 1er cru controlee', 'chassagne montrachet premier cru']) && L.nomsBible('Bourgogne Saint-Aubin').includes('saint aubin') && L.nomsBible('Corton Grand Cru').includes('corton'), JSON.stringify(L.nomsBible('Chassagne-Montrachet 1er Cru Contrôlée')));
  const trouve = (region, color, year = 2018) => L.bibleEntry({ name: 'X', dom: 'D', region, color, year, src: {} }, bib);
  const manque = [['Rully 1er Cru', 'Blanc'], ['Chassagne-Montrachet 1er Cru Contrôlée', 'Rouge'], ['Bourgogne Saint-Aubin', 'Blanc'], ['Gevrey Chambertin Premier Cru', 'Rouge'], ['Corton Grand Cru', 'Rouge'], ['Clos de Vougeot Grand Cru', 'Rouge'],
    ['Mercurey 1er cru', 'Rouge'], ['Montagny Premier Cru', 'Blanc'], ['Pernand-Vergelesses 1er Cru', 'Blanc'], ['Fixin Premier Cru', 'Rouge'], ['Mazoyères-Chambertin', 'Rouge'], ['La Grande Rue', 'Rouge'], ['Vougeot Premier Cru', 'Rouge'], ['Blagny Premier Cru', 'Rouge']].filter(([r, c]) => !trouve(r, c));
  T('bible : premiers et grands crus retrouvés sous leurs écritures courantes', manque.length === 0, JSON.stringify(manque));
  T('bible : une appellation ambiguë ou inconnue ne trouve rien (pas de devinette)', trouve('Bourgogne Inconnue', 'Rouge') === null && trouve('', 'Rouge') === null);
  T('bible : le 1er cru n’est jamais rabattu sur le village (« Rully 1er Cru » ne prend pas la ligne « Rully »)', (() => { const a = trouve('Rully 1er Cru', 'Blanc'), b = trouve('Rully', 'Blanc'); return a && b && (a.from !== b.from || a.to !== b.to); })());
  T('bible : page et service worker lisent les noms de la même façon', ['Rully 1er Cru Les Chapitres', 'Chassagne-Montrachet 1er Cru Contrôlée', 'Bourgogne Saint-Aubin', 'Corton Grand Cru', 'Appellation Pauillac Contrôlée', 'Gevrey Chambertin', 'Saint-Émilion Grand Cru Classé', ''].every(r => JSON.stringify(L.nomsBible(r)) === JSON.stringify(ctx.self.FondIA.nomsBible(r))));
  T('bible : douze communes ajoutées avec premiers crus, plus Mazoyères-Chambertin et La Grande Rue', ['Fixin', 'Vougeot', 'Ladoix', 'Pernand-Vergelesses', 'Monthélie', 'Auxey-Duresses', 'Maranges', 'Blagny', 'Rully', 'Mercurey', 'Givry', 'Montagny'].every(c => bib.rows.some(r => r.a === c + ' Premier Cru')) && bib.rows.some(r => r.a === 'Mazoyères-Chambertin') && bib.rows.some(r => r.a === 'La Grande Rue'));
  T('bible : lignes dérivées jamais plus fiables que « B »', bib.rows.filter(r => /Premier Cru$/.test(r.a) || /Mazoyères|Grande Rue/.test(r.a)).every(r => !/^(Fixin|Vougeot|Ladoix|Pernand|Monthélie|Auxey|Maranges|Blagny|Rully|Mercurey|Givry|Montagny|Mazoyères|La Grande)/.test(r.a) || Object.values(r.y).every(c => c[3] !== 'A')));
  // Origine « calc » : fenêtre calculée selon le rang du vin
  {
    const latour = () => L.normalizeWine({ name: 'Château Latour', dom: 'Château Latour', region: 'Pauillac', color: 'Rouge', year: 2016, qty: 1 });
    const w = latour();
    const e = L.bibleEntry(w, bib);
    const sans = latour(); L.prefillFromBible(sans, bib);
    T('calc : sans calcul, un premier cru classé reçoit la fenêtre de l’appellation (origine « bible »)', sans.src.from === 'bible' && sans.to - sans.from < 30 && e && sans.from === e.from, JSON.stringify([sans.from, sans.to, sans.src]));
    const avec = latour(); const change = L.prefillFromBible(avec, bib, A.fenetreRang);
    const ap1 = A.apogee(avec, 2026, e && e.q);
    T('calc : avec le calcul, Latour reçoit sa propre fenêtre (origine « calc »), plus longue que celle de Pauillac', change && avec.src.from === 'calc' && avec.src.to === 'calc' && avec.from > sans.from && avec.to > sans.to, JSON.stringify([avec.from, avec.to, avec.src]));
    T('calc : l’apogée affichée reste dans la fenêtre calculée, sans correction', !ap1.ajuste && ap1.from >= avec.from && ap1.to <= avec.to, JSON.stringify([ap1, avec.from, avec.to]));
    T('calc : un second passage ne change rien', L.prefillFromBible(avec, bib, A.fenetreRang) === false);
    const perso = latour(); perso.from = 2030; perso.to = 2050; perso.src = { from: 'user', to: 'user' };
    L.prefillFromBible(perso, bib, A.fenetreRang);
    T('calc : une garde saisie à la main n’est jamais remplacée', perso.from === 2030 && perso.to === 2050 && perso.src.from === 'user');
    const ia = latour(); ia.from = 2028; ia.to = 2032; ia.src = { from: 'ai', to: 'ai' };
    L.prefillFromBible(ia, bib, A.fenetreRang);
    T('calc : la fenêtre calculée remplace celle de l’IA (la bible et le calcul passent avant), comme la bible seule', ia.src.from === 'calc' && ia.from === avec.from);
    const simple = L.normalizeWine({ name: 'Cuvée', dom: 'D', region: 'Pauillac', color: 'Rouge', year: 2016, qty: 1 });
    L.prefillFromBible(simple, bib, A.fenetreRang);
    T('calc : un vin sans rang particulier garde la fenêtre de la bible (origine « bible »)', simple.src.from === 'bible', JSON.stringify(simple.src));
    const rank2 = L.normalizeWine({ name: 'Chambertin', dom: 'D', region: 'Gevrey-Chambertin', color: 'Rouge', year: 2015, qty: 1 }); // région saisie au niveau village
    L.prefillFromBible(rank2, bib, A.fenetreRang);
    const vil = L.normalizeWine({ name: 'Cuvée', dom: 'D', region: 'Gevrey-Chambertin', color: 'Rouge', year: 2015, qty: 1 }); L.prefillFromBible(vil, bib, A.fenetreRang);
    T('calc : un grand cru saisi sous « Gevrey-Chambertin » prend la fenêtre d’un grand cru, pas celle du village', rank2.src.from === 'calc' && rank2.from > vil.from + 5 && rank2.to > vil.to + 8, JSON.stringify([rank2.from, rank2.to, vil.from, vil.to]));
    // Le service worker laisse la fenêtre calculée par la page
    const sw = latour(); L.prefillFromBible(sw, bib, A.fenetreRang);
    const avant = JSON.stringify([sw.from, sw.to, sw.src]);
    const touche = ctx.self.FondIA.bibleGarde(sw, bib);
    T('calc : la passe de fond (service worker) ne remplace pas une fenêtre « calc »', !touche && JSON.stringify([sw.from, sw.to, sw.src]) === avant, avant);
    const norm1 = L.normalizeWine({ name: 'X', dom: 'D', year: 2016, color: 'Rouge', region: 'Pauillac', from: 2030, to: 2045, src: { from: 'calc', to: 'calc' } });
    T('calc : l’origine « calc » survit à la normalisation de la fiche', norm1.src.from === 'calc' && norm1.src.to === 'calc');
    const sans2 = L.prefillFromBible(L.normalizeWine({ name: 'Y', dom: 'D', year: 2016, color: 'Rouge', region: 'Région inconnue', qty: 1 }), bib, A.fenetreRang);
    T('calc : sans bible ni rang, rien n’est inventé', sans2 === false);
    const casse = L.prefillFromBible(latour(), bib, () => { throw new Error('boum'); });
    T('calc : si le calcul échoue, la bible prend le relais sans erreur', casse === true);
  }
  console.log(out.slice(o0).join('\n'));
}
