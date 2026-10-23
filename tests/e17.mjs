// Fenêtres : croix, glisser vers le bas (moitié haute), confirmation avant d’abandonner une saisie.
import {start} from './server.mjs';import * as H from './h.mjs';
H.deploy();const srv=await start(8123);const b=await H.browser();
const S=H.suite('Fenêtres');const T=S.T;
const r=await H.newPage(b);const page=r.page;
const errs=[];page.on('pageerror',e=>errs.push(e.message));
await page.goto(H.URL0);await H.sl(900);
await page.evaluate(()=>{const s=document.querySelector('#sBienv');if(s)s.classList.remove('show');});
const rect=sel=>page.evaluate(sel=>{const x=document.querySelector(sel+' .sheet').getBoundingClientRect();return {top:x.top,bottom:x.bottom}},sel);
const swipe=async(x,y0,dy)=>{const cdp=await page.createCDPSession();
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:y0}]});
  for(let i=1;i<=10;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y0+dy*i/10}]});await H.sl(16);}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();await H.sl(450);};
const ouvrirReglages=async()=>{await H.click(page,'#bSet');await H.sl(450);};

await ouvrirReglages();
T('croix présente dans les fenêtres',await page.$eval('#sSet .sheet',e=>!!e.querySelector('.sx')));
await page.click('#sSet .sx');await H.sl(350);
T('croix : ferme la fenêtre',!(await H.shown(page,'#sSet')));

await ouvrirReglages();
let R=await rect('#sSet');
await swipe(195,R.top+60,220);
T('glisser depuis la moitié haute : ferme',!(await H.shown(page,'#sSet')));

await ouvrirReglages();R=await rect('#sSet');
await swipe(195,R.top+60,40);
T('petit glissement : reste ouverte',await H.shown(page,'#sSet'));

R=await rect('#sSet');
await swipe(195,R.bottom-40,250);
T('glisser depuis la moitié basse : reste ouverte',await H.shown(page,'#sSet'));
await page.click('#sSet .sx');await H.sl(350);

// saisie non enregistrée
await H.click(page,'#fab');await H.sl(400);
await page.evaluate(()=>document.querySelector('#sMenu [data-m=man]').click());await H.sl(450);
T('saisie : fenêtre ouverte',await H.shown(page,'#sForm'));
await page.click('#sForm .sx');await H.sl(350);
T('saisie vide : fermée sans question',!(await H.shown(page,'#sForm'))&&!(await H.shown(page,'#sDlg')));

await H.click(page,'#fab');await H.sl(400);
await page.evaluate(()=>document.querySelector('#sMenu [data-m=man]').click());await H.sl(450);
await page.type('#f-name','Vin test');await H.sl(150);
await page.click('#sForm .sx');await H.sl(400);
T('saisie non enregistrée : demande confirmation',await H.shown(page,'#sDlg'));
await H.tapText(page,'#sDlg button','Continuer');await H.sl(400);
T('« Continuer » : la saisie reste ouverte',await H.shown(page,'#sForm')&&!(await H.shown(page,'#sDlg')));
await page.click('#sForm .sx');await H.sl(400);
await H.tapText(page,'#sDlg button','Abandonner');await H.sl(400);
T('« Abandonner » : la saisie est fermée',!(await H.shown(page,'#sForm')));

T('aucune erreur JavaScript',errs.length===0,errs.join(' | '));
await page.close();
console.log(S.out.join('\n'));await b.close();srv.close();
