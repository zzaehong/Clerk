import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CodexBridge, type Message, type TransportEvent} from '../src/bridge.ts';
function fake(timeout = 200) {
  let receive: (event:TransportEvent) => void;
  const sent: Message[] = [];
  const bridge = new CodexBridge({async start(fn) {receive=fn;}, async stop() {}, async write(message) {
    sent.push(message);
    if(message.method === 'initialize') queueMicrotask(() => receive({kind:'message',message:{id:message.id,result:{}}}));
  }},timeout);
  return {bridge,sent,emit(event:TransportEvent){receive(event);}};
}
test('initialization precedes calls; correct workspace and approval policy',async () => {
  const f=fake(); await f.bridge.connect();
  assert.deepEqual(f.sent.map(m=>m.method),['initialize','initialized']);
  const pending=f.bridge.startChat('/tmp/work'); const m=f.sent.at(-1)!;
  assert.equal(m.params.cwd,'/tmp/work'); assert.equal(m.params.approvalPolicy,'untrusted'); assert.equal(m.params.approvalsReviewer,'user');
  f.emit({kind:'message',message:{id:m.id,result:{thread:{id:'abc'}}}});
  assert.equal((await pending).thread.id,'abc'); await f.bridge.disconnect();
});
test('server request id zero is retained and never automatically approved',async () => {
  const f=fake(); await f.bridge.connect(); let request;
  f.bridge.onNotice=n=>{request=n;};
  f.emit({kind:'message',message:{id:0,method:'item/commandExecution/requestApproval',params:{command:'pip install example'}}});
  assert.equal(f.sent.length,2); assert.equal(request.id,0);
  await f.bridge.respond(0,{decision:'decline'}); assert.deepEqual(f.sent.at(-1),{id:0,result:{decision:'decline'}});
  await assert.rejects(f.bridge.respond(0,{})); await f.bridge.disconnect();
});
test('out of order responses and streaming notifications are independent',async () => {
  const f=fake(); await f.bridge.connect(); const events:string[]=[]; f.bridge.onNotice=n=>events.push(n.method);
  const a=f.bridge.getAccount(), aid=f.sent.at(-1)!.id;
  const b=f.bridge.getRateLimits(), bid=f.sent.at(-1)!.id;
  f.emit({kind:'message',message:{method:'item/agentMessage/delta',params:{delta:'hello'}}});
  f.emit({kind:'message',message:{id:bid,result:{usage:20}}}); f.emit({kind:'message',message:{id:aid,result:{account:'ok'}}});
  assert.deepEqual(await b,{usage:20}); assert.deepEqual(await a,{account:'ok'}); assert.deepEqual(events,['item/agentMessage/delta']); await f.bridge.disconnect();
});
test('process exit rejects waiting requests and subsequent calls',async () => {
  const f=fake(); await f.bridge.connect(); const p=f.bridge.getAccount();
  f.emit({kind:'closed',text:'exit 1'}); await assert.rejects(p,/exit 1/); await assert.rejects(f.bridge.getAccount(),/disconnected/);
});
test('raw protocol errors and timeouts are visible',async () => {
  const f=fake(10); await f.bridge.connect(); const p=f.bridge.getAccount();
  f.emit({kind:'message',message:{id:f.sent.at(-1)!.id,error:{code:-1,message:'Permission denied'}}});
  await assert.rejects(p,/Permission denied/); await assert.rejects(f.bridge.getRateLimits(),/timed out/); await f.bridge.disconnect();
});
test('unsupported server requests fail closed',async () => {
  const f=fake(); await f.bridge.connect(); f.emit({kind:'message',message:{id:'x',method:'unknown',params:{}}});
  await f.bridge.unsupported('x'); assert.equal(f.sent.at(-1)!.error!.code,-32601); await f.bridge.disconnect();
});
test('user question responses preserve the original string id and per-question answers',async () => {
  const f=fake(); await f.bridge.connect();
  f.emit({kind:'message',message:{id:'question-1',method:'item/tool/requestUserInput',params:{questions:[{id:'format'}]}}});
  const answers={format:{answers:['Markdown']}};
  await f.bridge.respond('question-1',{answers});
  assert.deepEqual(f.sent.at(-1),{id:'question-1',result:{answers}}); await f.bridge.disconnect();
});
test('resolved requests cannot be approved after cancellation',async () => {
  const f=fake(); await f.bridge.connect();
  f.emit({kind:'message',message:{id:42,method:'item/fileChange/requestApproval',params:{}}});
  f.emit({kind:'message',message:{method:'serverRequest/resolved',params:{requestId:42}}});
  await assert.rejects(f.bridge.respond(42,{decision:'accept'}),/종료/); await f.bridge.disconnect();
});
test('reconnect ignores old process events and rejects outstanding requests',async () => {
  const sinks:((event:TransportEvent)=>void)[]=[];
  const b=new CodexBridge({async start(fn){sinks.push(fn);},async stop(){},async write(m){if(m.method==='initialize') sinks.at(-1)!({kind:'message',message:{id:m.id,result:{}}});}});
  await b.connect(); const pending=b.getAccount(); const rejection=assert.rejects(pending,/replaced/);
  await b.connect(); await rejection;
  const events:string[]=[]; b.onNotice=n=>events.push(n.method);
  sinks[0]({kind:'closed',text:'old process'}); assert.deepEqual(events,[]); await b.disconnect();
});
test('login and Windows setup use official APIs without changing global configuration',async()=>{
  const f=fake();await f.bridge.connect();
  for(const [call,method,params] of [
    [()=>f.bridge.startLogin(),'account/login/start',{type:'chatgpt'}],
    [()=>f.bridge.cancelLogin('login-1'),'account/login/cancel',{loginId:'login-1'}],
    [()=>f.bridge.prepareWindows('C:\\Docs'),'windowsSandbox/setupStart',{mode:'elevated',cwd:'C:\\Docs'}],
  ] as const){
    const pending=call();const m=f.sent.at(-1)!;
    assert.equal(m.method,method);assert.deepEqual(m.params,params);
    f.emit({kind:'message',message:{id:m.id,result:{}}});await pending;
  }
  await f.bridge.disconnect();
});
