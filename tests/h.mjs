import puppeteer from 'puppeteer-core';import fs from 'fs';import path from 'path';
const HERE=path.dirname(new URL(import.meta.url).pathname);const APP=path.resolve(HERE,'..');const SITE=path.join(HERE,'.site','www');
export const URL0='http://localhost:8123/cave/';
// Copie uniquement les fichiers de l'appli (racine du dépôt, hors dossiers et fichiers de dev)
export function deploy(version){fs.rmSync(SITE,{recursive:true,force:true});fs.mkdirSync(path.join(SITE,'cave'),{recursive:true});
  for(const f of fs.readdirSync(APP)){const p=path.join(APP,f);if(fs.statSync(p).isDirectory()||/^(CLAUDE\.md|\.gitignore|README.*)$/.test(f))continue;fs.copyFileSync(p,path.join(SITE,'cave',f))}
  {const ap=path.join(SITE,'cave','app.js');fs.writeFileSync(ap,fs.readFileSync(ap,'utf8').replace(/const STATS_POST = '[^']*';/,"const STATS_POST = '';"))}
  if(version)fs.writeFileSync(path.join(SITE,'cave','version.js'),`self.APP_VERSION = '${version}';\n`)}
async function exe(){if(process.env.CHROME_PATH)return {p:process.env.CHROME_PATH,args:[]};if(fs.existsSync('/opt/pw-browsers/chromium'))return {p:'/opt/pw-browsers/chromium',args:[]};const c=(await import('@sparticuz/chromium')).default;return {p:await c.executablePath(),args:c.args}}
export async function browser(){const e=await exe();return puppeteer.launch({executablePath:e.p,args:[...e.args,'--no-sandbox'],headless:true})}
export async function newPage(b,{ai,width=390,height=780}={}){
  const ctx=null;const page=await b.newPage();
  await page.setViewport({width,height,isMobile:true,hasTouch:true,deviceScaleFactor:2});
  const errs=[];page.on('pageerror',e=>errs.push('PAGEERR '+e.message));page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errs.push('CONSOLE '+m.text())});
  page.on('dialog',d=>{errs.push('NATIVE DIALOG '+d.message());d.dismiss()});
  const calls=[];
  await page.exposeFunction('__aiMock',async(url,headers,body)=>{const c={url,headers,body:body?JSON.parse(body):null};calls.push(c);const r=ai?await ai(c):{status:500,json:{}};return {status:r.status||200,body:JSON.stringify(r.json??{}),delay:r.delay||0}});
  await page.evaluateOnNewDocument(()=>{window.__AUTO_DELAY=1e9;window.__AUTO_EVERY=1e9});
  await page.evaluateOnNewDocument(()=>{
    window.__dl=[];
    const of=window.fetch.bind(window);
    window.fetch=async(input,init={})=>{const url=typeof input==='string'?input:input.url;
      if(/googleapis\.com|anthropic\.com|api\.example-ai\.com/.test(url)){
        const sig=init.signal;if(sig&&sig.aborted)throw new DOMException('aborted','AbortError');
        const r=await window.__aiMock(url,init.headers||{},init.body||null);
        await new Promise((res,rej)=>{const t=setTimeout(res,r.delay);if(sig)sig.addEventListener('abort',()=>{clearTimeout(t);rej(new DOMException('aborted','AbortError'))},{once:true})});
        return new Response(r.body,{status:r.status,headers:{'content-type':'application/json'}})}
      return of(input,init)};
    const oc=HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click=function(){if(this.download){const n=this.download;fetch(this.href).then(r=>r.text()).then(t=>window.__dl.push({name:n,text:t}));return}return oc.call(this)};
  });
  return {page,errs,calls,ctx};
}
export const sl=ms=>new Promise(r=>setTimeout(r,ms));
export function suite(name){const out=[];return {T:(n,c,x='')=>out.push((c?'PASS ':'FAIL ')+name+' | '+n+(c?'':' → '+String(x).slice(0,300))),out}}
export const txt=(p,s)=>p.$eval(s,e=>e.innerText);
export const shown=(p,s)=>p.$eval(s,e=>e.classList.contains('show'));
export async function tapText(p,sel,text){const ok=await p.evaluate((sel,text)=>{const el=[...document.querySelectorAll(sel)].find(e=>e.offsetParent!==null&&e.textContent.includes(text));if(!el)return false;el.click();return true},sel,text);if(!ok)throw new Error('introuvable: '+sel+' '+text);await sl(120)}
export async function click(p,sel){await p.waitForSelector(sel,{visible:true,timeout:4000});await p.tap(sel);await sl(120)}
export async function pickFiles(p,trigger,files){const [fc]=await Promise.all([p.waitForFileChooser({timeout:5000}),trigger()]);await fc.accept(files)}
export async function setAI(p,provider='gemini',key='AIzaTEST',extra={}){await p.evaluate((v)=>localStorage.setItem('cave-ai',JSON.stringify(v)),{provider,key,...extra})}
