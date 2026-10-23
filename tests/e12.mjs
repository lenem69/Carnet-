import {start} from './server.mjs';import * as H from './h.mjs';
H.deploy();const srv=await start(8123);const b=await H.browser();
const {T,out}=H.suite('Écran d’accueil (première visite)');
const IOS='Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const AND='Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';
const errs=[];
{const r=await H.newPage(b);const page=r.page;page.on('pageerror',e=>errs.push(e.message));
 await page.setUserAgent(IOS);await page.goto(H.URL0);await H.sl(1200);
 T('iPhone (Safari) : écran d’accueil affiché avec le pas-à-pas',!(await page.$eval('#landing',e=>e.hidden))&&!(await page.$eval('#ld-ios',e=>e.hidden))&&(await page.$eval('#ld-and',e=>e.hidden)));
 await page.evaluate(()=>document.querySelector('#ld-skip').click());await H.sl(300);
 T('« Continuer sans installer » ouvre l’appli',await page.$eval('#landing',e=>e.hidden)&&await page.$eval('#vCave',e=>!e.hidden));
 await page.reload();await H.sl(1000);
 T('après « Continuer », l’écran ne revient pas',await page.$eval('#landing',e=>e.hidden));
 await page.close();}
{const r=await H.newPage(b);const page=r.page;page.on('pageerror',e=>errs.push(e.message));
 await page.setUserAgent(AND);await page.evaluateOnNewDocument(()=>{try{localStorage.removeItem('cave-landing-ok')}catch(e){}});await page.goto(H.URL0);await H.sl(1200);
 T('Android : écran d’accueil affiché, étapes du menu du navigateur',!(await page.$eval('#landing',e=>e.hidden))&&!(await page.$eval('#ld-and',e=>e.hidden))&&(await page.$eval('#ld-ios',e=>e.hidden)));
 await page.close();}
{const r=await H.newPage(b);const page=r.page;page.on('pageerror',e=>errs.push(e.message));
 await page.goto(H.URL0);await H.sl(1000);
 T('ordinateur : pas d’écran d’accueil',await page.$eval('#landing',e=>e.hidden));
 await page.close();}
T('aucune erreur JavaScript',errs.length===0,errs.join('|'));
console.log(out.join('\n'));await b.close();srv.close();
