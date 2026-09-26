// Build-time only. End users receive the verified runtime inside the installer.
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const version='0.157.0';
const sha256='5aeaec2ce000e0b5d1c9b3d5751bc47743f231a806f8f4084138aaf876b84b5b';
const url=`https://github.com/openai/codex/releases/download/rust-v${version}/codex-app-server-package-x86_64-pc-windows-msvc.tar.gz`;
await mkdir('.local',{recursive:true});
let bytes;
try {bytes=await readFile('.local/codex-windows.tar.gz');} catch {}
if(!bytes || createHash('sha256').update(bytes).digest('hex')!==sha256){
 const response=await fetch(url);if(!response.ok)throw new Error(`Codex download: ${response.status}`);
 bytes=Buffer.from(await response.arrayBuffer());
 if(createHash('sha256').update(bytes).digest('hex')!==sha256)throw new Error('Codex SHA-256 mismatch');
 await writeFile('.local/codex-windows.tar.gz',bytes);
}
await mkdir('src-tauri/resources/codex',{recursive:true});
execFileSync('tar',['-xzf','.local/codex-windows.tar.gz','-C','src-tauri/resources/codex'],{stdio:'inherit'});
console.log(`Verified Codex ${version}: ${sha256}`);
