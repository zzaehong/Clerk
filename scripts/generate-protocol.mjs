// Generate only the types this bridge uses from the installed official CLI.
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve,relative} from 'node:path';
const root=mkdtempSync(join(tmpdir(),'clerk-protocol-'));
execFileSync('codex',['app-server','generate-ts','--out',root]);
const wanted=['ThreadStartParams','ThreadResumeParams','TurnStartParams','ToolRequestUserInputParams','CommandExecutionRequestApprovalParams','FileChangeRequestApprovalParams','GetAccountRateLimitsResponse'];
const seen=new Set();
function copy(file){
 if(seen.has(file)) return; seen.add(file);
 const text=readFileSync(file,'utf8'); const target=join('src/protocol',relative(root,file)); mkdirSync(dirname(target),{recursive:true}); writeFileSync(target,text);
 for(const match of text.matchAll(/from "([^"]+)"/g)) copy(resolve(dirname(file),match[1]+'.ts'));
}
wanted.forEach(n=>copy(join(root,'v2',n+'.ts')));
writeFileSync('src/protocol/VERSION',execFileSync('codex',['--version'],{encoding:'utf8'}));
console.log(`Copied ${seen.size} official type files`);
