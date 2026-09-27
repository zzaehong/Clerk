// Opt-in live test. Not part of npm test. Uses the user's local Codex account.
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {mkdir, mkdtemp, readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {CodexBridge} from '../src/bridge.ts';
let child;
const notices = [];
const changes = new Map();
const bridge = new CodexBridge({
  async start(receive) {
    child = spawn('codex', ['app-server', '--listen', 'stdio://'], {stdio:['pipe','pipe','pipe']});
    createInterface({input:child.stdout}).on('line', line => {try {receive({kind:'message', message:JSON.parse(line)});} catch {}});
    child.stderr.on('data', () => {});
    child.on('exit', code => receive({kind:'closed', text:`exit ${code}`}));
    await new Promise((ok, fail) => {child.once('spawn',ok); child.once('error',fail);});
  },
  async write(message) {child.stdin.write(JSON.stringify(message)+'\n');},
  async stop() {child?.kill();},
}, 90_000);
let complete;
bridge.onNotice = n => {
  notices.push(n.method);
  if (n.method === "item/started" && n.params.item.type === "fileChange") { changes.set(n.params.item.id, n.params.item.changes); console.log("CHANGES",JSON.stringify(n.params.item.changes)); }
  if (n.id !== undefined) {
    console.log('REQUEST', n.method, JSON.stringify(n.params));
    // Only the explicitly opted-in test.md patch can be accepted; all commands are denied.
    if (n.method.endsWith('/requestApproval')) {
      const files = changes.get(n.params.itemId);
      const allowed = process.argv.includes('--allow-test-file') && n.method === 'item/fileChange/requestApproval' && files?.length === 1 && resolve(files[0].path) === resolve(workspace, 'test.md');
      console.log('DECISION', allowed ? 'accept test.md only' : 'decline');
      void bridge.respond(n.id, {decision:allowed ? 'accept' : 'decline'});
    }
    else void bridge.unsupported(n.id);
  }
  if (n.method === 'turn/completed') complete?.(n.params.turn);
  if (n.method === 'error') console.log('CODEX_ERROR', JSON.stringify(n.params));
};
await mkdir(resolve('.local'),{recursive:true});
const workspace = await mkdtemp(resolve('.local/smoke-'));
console.log('workspace',workspace);
try {
  await bridge.connect();
  const account = await bridge.getAccount(); console.log('account', account.account?.type, !!account.account);
  // This opt-in approval test deliberately overrides policy; the app inherits Codex settings.
  const chat = await bridge.call('thread/start', {cwd:workspace, sandbox:'read-only', approvalPolicy:'on-request', approvalsReviewer:'user'}); console.log('chat', chat.thread.id);
  const done = new Promise((ok, fail) => {complete=ok; const timer=setTimeout(() => fail(new Error('turn timeout')),180_000); timer.unref();});
  await bridge.sendMessage(chat.thread.id, '이 폴더에 test.md를 만들고 오늘 할 일을 3개 적어줘. apply_patch로 작성해줘. 다른 파일은 변경하지 마.');
  const turn = await done; console.log('turn',turn.status, turn.error);
  assert.equal(turn.status,'completed');
  if (process.argv.includes('--allow-test-file')) {
    const content=await readFile(resolve(workspace,'test.md'),'utf8');
    assert.equal(content.split('\n').filter(line=>/^[-*] /.test(line)).length,3);
    assert.ok(notices.includes('item/fileChange/requestApproval'));
    assert.ok(notices.includes('item/agentMessage/delta'));
    console.log('test.md',content);
  } else {
    await assert.rejects(readFile(resolve(workspace,'test.md'),'utf8'),{code:'ENOENT'});
    console.log('denied: file was not created');
  }
  console.log('streaming',notices.includes('item/agentMessage/delta'));
  await bridge.disconnect();
} finally {await bridge.disconnect();}
