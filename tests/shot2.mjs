import {start} from './server.mjs';import * as H from './h.mjs';
H.deploy();const srv=await start(8123);const b=await H.browser();
for(const w of [320,390]){const {page}=await H.newPage(b,{width:w});
await page.emulateMediaFeatures([{name:'prefers-color-scheme',value:'dark'}]);
await page.goto(H.URL0);await H.sl(1200);
await page.evaluate(()=>{document.querySelector('#updBar').innerHTML='<div class="upd"><span class="ic" aria-hidden="true">⬆️</span><div class="tx"><b>Nouvelle version prête</b><span>Touchez le bouton pour l’installer</span></div><button class="btn" data-b="upd">Mettre à jour</button></div>'});
await page.screenshot({path:`.site/u${w}.png`,clip:{x:0,y:0,width:w,height:260}});await page.close()}
await b.close();srv.close();
