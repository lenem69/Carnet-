// Lance tous les tests (unitaires puis navigateur) et s'arrête en erreur au moindre échec.
import {execFileSync} from 'child_process';import fs from 'fs';
fs.mkdirSync(new URL('./.site',import.meta.url),{recursive:true});
let pass=0,fail=[];
for(const f of ['unit.mjs','e1.mjs','e2.mjs','e3.mjs','e4.mjs','e5.mjs','e6.mjs','e7.mjs','e8.mjs','e9.mjs','e10.mjs','e11.mjs','e12.mjs','e13.mjs','e14.mjs','e15.mjs','e16.mjs','e17.mjs','e18.mjs','e19.mjs','e20.mjs','e21.mjs','e22.mjs','e23.mjs','e24.mjs','e25.mjs','e26.mjs','e27.mjs','e28.mjs','e29.mjs','e30.mjs','e31.mjs','e32.mjs','e33.mjs','e34.mjs','e35.mjs']){
  let out='';try{out=execFileSync('node',[f],{cwd:new URL('.',import.meta.url).pathname,encoding:'utf8',timeout:300000,stdio:['ignore','pipe','pipe']})}catch(e){out=(e.stdout||'')+'\n'+(e.stderr||'');fail.push(f+' : plantage → '+String(e.stderr||e.message).split('\n').slice(0,3).join(' '))}
  for(const l of out.split('\n')){if(l.startsWith('PASS'))pass++;else if(l.startsWith('FAIL'))fail.push(l)}
  console.log(f.padEnd(10),'ok');
}
console.log(`\n${pass} réussis, ${fail.length} échec(s)`);fail.forEach(l=>console.log(l));process.exit(fail.length?1:0);
