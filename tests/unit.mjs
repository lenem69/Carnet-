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
console.log(out.join('\n'));
const mw=L.normalizeWine({name:'Chassagne-Montrachet',dom:'Paul Jouard',year:2012,loc:'Casier B'});
console.log([['montra',true],['jou mont',true],['12',false],['2012',true],['xyz',false],['',true]].map(([q,e])=>(L.matchesQuery(mw,q)===e?'PASS':'FAIL')+' recherche « '+q+' »').join('\n'));
