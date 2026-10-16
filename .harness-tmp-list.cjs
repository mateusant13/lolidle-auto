const {execSync}=require('child_process');
let out=execSync('cmd /c grep -rn "### TK-" docs/tickets',{encoding:'utf8',cwd:'I:/!lolidle.com'});
const lines=out.split('\n').filter(l=>/P0/.test(l));
console.log(lines.length);
lines.forEach(l=>console.log(l.replace(/^.*### /,'').trim()));
