import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {bridge, chooseFolder, openLoginUrl, getPlatform} from './desktop.ts';
import type {Notice} from './bridge.ts';
import './style.css';
import {RequestCard} from './Requests.tsx';
function App() {
  const [folder,setFolder]=useState('');
  const [chat,setChat]=useState('');
  const [turn,setTurn]=useState('');
  const [input,setInput]=useState('');
  const [text,setText]=useState('');
  const [status,setStatus]=useState('Codex에 연결하고 있습니다…');
  const [working,setWorking]=useState(false);
  const [pending,setPending]=useState(false);
  const [connected,setConnected]=useState(false);
  const [authenticated,setAuthenticated]=useState(false);
  const [loginId,setLoginId]=useState('');
  const [loginUrl,setLoginUrl]=useState('');
  const [windows,setWindows]=useState(false);
  const [error,setError]=useState('');
  const [requests,setRequests]=useState<Notice[]>([]);
  const [items,setItems]=useState<Record<string, unknown>>({});
  const lock=useRef(false);
  const currentChat=useRef('');
  const busy=working||pending;
  async function account() {
    const r=await bridge.getAccount();
    const signedIn=!!r.account || r.requiresOpenaiAuth===false;
    setAuthenticated(signedIn);
    setStatus(signedIn?'폴더를 열고 하고 싶은 일을 말해 주세요.':'ChatGPT에 로그인해 주세요.');
  }
  async function connect() {
    setConnected(false); setAuthenticated(false); setChat(''); currentChat.current=''; setTurn(''); setWorking(false);
    setRequests([]); setLoginId(''); setLoginUrl('');
    await bridge.connect(); setConnected(true); await account();
  }
  async function run(action:()=>Promise<void>) {
    if(lock.current) return;
    lock.current=true; setPending(true); setError('');
    try {await action();} catch(e) {setError(String(e));}
    finally {lock.current=false;setPending(false);}
  }
  useEffect(()=>{
    bridge.onNotice=n=>{
      if(n.params.threadId && currentChat.current && n.params.threadId!==currentChat.current) return;
      if(n.id!==undefined) {setRequests(q=>[...q,n]);return;}
      if(n.method==='item/started'||n.method==='item/completed') setItems(i=>({...i,[n.params.item.id]:n.params.item}));
      if(n.method==='serverRequest/resolved') setRequests(q=>q.filter(r=>r.id!==n.params.requestId));
      if(n.method==='item/agentMessage/delta') setText(t=>t+n.params.delta);
      if(n.method==='turn/started') {setTurn(n.params.turn.id);setWorking(true);setStatus('작업 중');}
      if(n.method==='turn/completed') {setWorking(false);setTurn('');setRequests([]);setStatus(n.params.turn.status==='completed'?'작업 완료':n.params.turn.status==='interrupted'?'작업을 중지했습니다.':'작업이 완료되지 않았습니다.');if(n.params.turn.error)setError(JSON.stringify(n.params.turn.error));}
      if(n.method==='bridge/closed') {setConnected(false);setWorking(false);setChat('');currentChat.current='';setTurn('');setRequests([]);setError(n.params.message);setStatus('Codex 연결이 끊겼습니다.');}
      if(n.method==='error') setError(JSON.stringify(n.params));
      if(n.method==='account/login/completed') {setLoginId('');setLoginUrl('');if(n.params.success)void account().catch(e=>setError(String(e)));else setError(n.params.error||'로그인을 완료하지 못했습니다.');}
      if(n.method==='windowsSandbox/setupCompleted') {setStatus(n.params.success?'작업 환경 준비가 완료되었습니다.':'작업 환경을 준비하지 못했습니다.');if(n.params.error)setError(n.params.error);}
    };
    void getPlatform().then(p=>setWindows(p==='windows')).catch(e=>setError(String(e)));
    void run(connect);
    return ()=>{void bridge.disconnect();};
  },[]);
  async function open() {
    const path=await chooseFolder();if(!path)return;
    const r=await bridge.startChat(path);
    setFolder(path);setChat(r.thread.id);currentChat.current=r.thread.id;setText('');setItems({});setStatus('요청을 입력하세요.');
  }
  async function login() {
    const r=await bridge.startLogin();
    setLoginId(r.loginId);setLoginUrl(r.authUrl);
    await openLoginUrl(r.authUrl);setStatus('브라우저에서 로그인을 마치면 자동으로 연결됩니다.');
  }
  async function respond(n:Notice,result:unknown) {await bridge.respond(n.id!,result);setRequests(q=>q.filter(r=>r.id!==n.id));}
  return <main><header><div><h1>Clerk</h1><small>폴더를 열고, 하고 싶은 일을 말하세요.</small></div><span className="connection">{connected?'Codex 연결됨':'연결 안 됨'}</span></header>
    <nav>
      <button disabled={busy||!connected||!authenticated} onClick={()=>void run(open)}>폴더 열기</button>
      <span>{folder||'선택한 폴더 없음'}</span>
    </nav>
    {!authenticated&&connected&&<section><h2>ChatGPT로 시작하기</h2><p>Codex를 사용할 수 있는 계정이 필요합니다. 로그인 정보는 이 PC의 Codex가 관리합니다.</p><button disabled={pending||!!loginId} onClick={()=>void run(login)}>ChatGPT 로그인</button>{loginId&&<><button disabled={pending} onClick={()=>void run(async()=>{await bridge.cancelLogin(loginId);setLoginId('');setLoginUrl('');})}>로그인 취소</button><button disabled={pending} onClick={()=>void run(()=>openLoginUrl(loginUrl))}>로그인 페이지 다시 열기</button></>}</section>}
    <p role="status">{status}</p>
    {error&&<section role="alert"><p>{/auth|로그인|401|token/i.test(error)?'로그인을 확인해 주세요.':/permission|권한|denied/i.test(error)?'폴더 접근 권한 또는 작업 환경 준비를 확인해 주세요.':'작업을 진행하지 못했습니다. 연결 상태와 아래 오류 정보를 확인해 주세요.'}</p><button disabled={pending} onClick={()=>void run(connect)}>다시 연결</button><details><summary>오류 상세 보기</summary><pre>{error}</pre></details></section>}
    {!connected&&!pending&&!error&&<button onClick={()=>void run(connect)}>다시 연결</button>}
    <article aria-label="채팅 내용" aria-live="polite"><pre>{text||'예: 이 폴더에 오늘 할 일을 정리한 문서를 만들어줘.'}</pre></article>
    {requests.map(n=><RequestCard key={n.id} request={n} item={items[n.params.itemId]} reply={result=>respond(n,result)} reject={async()=>{await bridge.unsupported(n.id!);setRequests(q=>q.filter(r=>r.id!==n.id));}}/>)}
    <form onSubmit={e=>{e.preventDefault();const message=input.trim();if(!message||busy||!chat)return;void run(async()=>{setStatus('요청을 전달하고 있습니다…');await bridge.sendMessage(chat,message);setInput('');setText(t=>`${t}\n나: ${message}\n\n`);});}}>
      <label>하고 싶은 일<textarea value={input} onChange={e=>setInput(e.target.value)} disabled={!chat||busy} placeholder="선택한 폴더에서 어떤 작업을 할까요?"/></label>
      <button className="primary" disabled={!chat||busy||!input.trim()}>보내기</button>
      <button type="button" disabled={!turn||pending} onClick={()=>void run(async()=>{await bridge.interrupt(chat,turn);})}>작업 중지</button>
    </form>
    {windows&&connected&&<details><summary>처음 실행하거나 명령 실행이 안 되나요?</summary><p>Codex의 Windows 작업 보호 환경을 준비합니다. Windows 권한 확인 창이 표시될 수 있습니다.</p><button disabled={busy} onClick={()=>void run(async()=>{await bridge.prepareWindows(folder);setStatus('작업 환경을 준비하고 있습니다. Windows 권한 창을 확인해 주세요.');})}>작업 환경 준비</button></details>}
    <footer>Clerk 0.1.0 · 파일은 이 PC에서 작업합니다. 요청 처리에는 인터넷 연결이 필요합니다.</footer>
  </main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
