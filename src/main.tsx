import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {bridge, chooseFolder, openLoginUrl, getPlatform} from './desktop.ts';
import type {Notice} from './bridge.ts';
import './style.css';
import {RequestCard} from './Requests.tsx';
import {Icon} from './Icon.tsx';
import {Markdown} from './Markdown.ts';
import {updateAssistant, type ChatMessage} from './chat.ts';
import {codexUsage, mergeUsage, usageWindows, remaining, type UsageSnapshot} from './usage.ts';
import appIcon from '../assets/icon.png';
function App() {
  const [folder,setFolder]=useState('');
  const [chat,setChat]=useState('');
  const [turn,setTurn]=useState('');
  const [input,setInput]=useState('');
  const [messages,setMessages]=useState<ChatMessage[]>([]);
  const [settings,setSettings]=useState(false);
  const [leftOpen,setLeftOpen]=useState(false);
  const [rightOpen,setRightOpen]=useState(false);
  const [accountInfo,setAccountInfo]=useState<{type: string; email?: string; planType?: string} | null>(null);
  const [serverVersion,setServerVersion]=useState('');
  const [usage,setUsage]=useState<UsageSnapshot | null>(null);
  const [usageError,setUsageError]=useState('');
  const accountEpoch=useRef(0);
  const usageRevision=useRef(0);
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
  async function refreshUsage() {
    const epoch=accountEpoch.current;
    const revision=++usageRevision.current;
    try {
      const r=await bridge.getRateLimits();
      if(epoch!==accountEpoch.current || revision!==usageRevision.current)return;
      setUsage(codexUsage(r));setUsageError('');
    } catch(e) {
      if(epoch!==accountEpoch.current || revision!==usageRevision.current)return;
      setUsage(null);setUsageError(`사용량을 불러오지 못했습니다: ${String(e)}`);
    }
  }
  async function account() {
    const epoch=++accountEpoch.current;
    setUsage(null);setUsageError('');
    const r=await bridge.getAccount();
    if(epoch!==accountEpoch.current)return;
    const signedIn=!!r.account || r.requiresOpenaiAuth===false;
    setAccountInfo(r.account);setAuthenticated(signedIn);
    if(!signedIn) {setChat('');currentChat.current='';}
    if(r.account?.type==='chatgpt') void refreshUsage();
    else setUsageError(signedIn?'이 인증 방식에서는 ChatGPT 사용량을 제공하지 않습니다.':'로그인 후 사용량을 확인할 수 있습니다.');
    setStatus(signedIn?'폴더를 열고 하고 싶은 일을 말해 주세요.':'ChatGPT에 로그인해 주세요.');
  }
  async function connect() {
    ++accountEpoch.current;
    setConnected(false); setAuthenticated(false);setAccountInfo(null);setUsage(null);setServerVersion('');setMessages([]);
    setChat(''); currentChat.current=''; setTurn(''); setWorking(false);
    setRequests([]); setLoginId(''); setLoginUrl('');
    await bridge.connect(); setServerVersion(bridge.serverInfo.userAgent || '서버가 버전을 제공하지 않았습니다.');setConnected(true); await account();
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
      if(n.method==='item/agentMessage/delta') setMessages(m=>updateAssistant(m,n.params.itemId,n.params.delta,true));
      if(n.method==='item/completed' && n.params.item.type==='agentMessage') setMessages(m=>updateAssistant(m,n.params.item.id,n.params.item.text));
      if(n.method==='account/rateLimits/updated') {
        const snapshot=codexUsage(n.params);
        if(snapshot){++usageRevision.current;setUsage(previous=>mergeUsage(previous,snapshot));setUsageError('');}
      }
      if(n.method==='account/updated') void account().catch(e=>setError(String(e)));
      if(n.method==='turn/started') {setTurn(n.params.turn.id);setWorking(true);setStatus('작업 중');}
      if(n.method==='turn/completed') {setWorking(false);setTurn('');setRequests([]);setStatus(n.params.turn.status==='completed'?'작업 완료':n.params.turn.status==='interrupted'?'작업을 중지했습니다.':'작업이 완료되지 않았습니다.');if(n.params.turn.error)setError(JSON.stringify(n.params.turn.error));}
      if(n.method==='bridge/closed') {++accountEpoch.current;setUsage(null);setAccountInfo(null);setAuthenticated(false);setServerVersion('');setConnected(false);setWorking(false);setChat('');currentChat.current='';setTurn('');setRequests([]);setError(n.params.message);setStatus('Codex 연결이 끊겼습니다.');}
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
    setFolder(path);setChat(r.thread.id);currentChat.current=r.thread.id;setMessages([]);setItems({});setStatus('요청을 입력하세요.');
  }
  async function login() {
    const r=await bridge.startLogin();
    setLoginId(r.loginId);setLoginUrl(r.authUrl);
    await openLoginUrl(r.authUrl);setStatus('브라우저에서 로그인을 마치면 자동으로 연결됩니다.');
  }
  async function respond(n:Notice,result:unknown) {await bridge.respond(n.id!,result);setRequests(q=>q.filter(r=>r.id!==n.id));}
  return <main className={`app-shell ${leftOpen?'left-open':''} ${rightOpen?'right-open':''}`}>
    <aside id="workspace-sidebar" className="sidebar workspace-sidebar" aria-label="Workspace">
      <div className="brand"><img className="brand-icon" src={appIcon} alt=""/><div><h1>Clerk</h1><span className="brand-caption">나의 로컬 작업 공간</span></div></div>
      <div className="sidebar-group">
        <h2 className="eyebrow">WORKSPACE</h2>
        <div className="folder-name"><Icon name="folder"/><strong>{folder.split(/[\\/]/).filter(Boolean).at(-1)||folder||'선택한 폴더 없음'}</strong></div>
        <p className="folder-path" title={folder||undefined}>{folder||'폴더를 선택해 시작하세요'}</p>
        <button disabled={busy||!connected||!authenticated} onClick={()=>void run(open)}>{folder?'폴더 변경':'폴더 열기'}</button>
      </div>
      <div className="sidebar-group files-area"><h2 className="eyebrow">FILES</h2><p className="sidebar-note">파일 트리는 아직 지원하지 않습니다.<br/>작업 파일은 파일 탐색기에서 확인해 주세요.</p></div>
      <footer><span><Icon name="lock"/>파일은 이 PC에서 작업합니다.</span><span>Clerk 0.3.0</span></footer>
    </aside>
    {(leftOpen||rightOpen)&&<button className="sidebar-backdrop" aria-label="사이드바 닫기" onClick={()=>{setLeftOpen(false);setRightOpen(false);}}/>}
    <div className="main-workspace">
      <div className="workspace-heading">
        <button className="sidebar-toggle left-toggle" aria-controls="workspace-sidebar" aria-expanded={leftOpen} onClick={()=>{setLeftOpen(v=>!v);setRightOpen(false);}}>Workspace</button>
        <h2>Conversation</h2>
        <button className="sidebar-toggle right-toggle" aria-controls="status-sidebar" aria-expanded={rightOpen} onClick={()=>{setRightOpen(v=>!v);setLeftOpen(false);}}>Codex 상태</button>
      </div>
      <div className="chat-scroll" tabIndex={0} aria-label="대화 및 작업 내역">
        <div className="chat-content">

    {error&&<section className="error-card" role="alert"><p>{/auth|로그인|401|token/i.test(error)?'로그인을 확인해 주세요.':/permission|권한|denied/i.test(error)?'폴더 접근 권한 또는 작업 환경 준비를 확인해 주세요.':'작업을 진행하지 못했습니다. 연결 상태와 아래 오류 정보를 확인해 주세요.'}</p><button disabled={pending} onClick={()=>void run(connect)}>다시 연결</button><details><summary>오류 상세 보기</summary><pre>{error}</pre></details></section>}
    {!connected&&!pending&&!error&&<button onClick={()=>void run(connect)}>다시 연결</button>}
    <article className={`conversation ${messages.length?'has-messages':''}`} aria-label="채팅 내용" aria-live="polite">
      {messages.length?messages.map(message=><div key={message.id} className={`chat-message ${message.role}`}>
        <div className="message-author">{message.role==='user'?'나':'Codex'}</div>
        {message.role==='assistant'?<Markdown text={message.text}/>:<p className="user-text">{message.text}</p>}
        {message.failed&&<small role="alert">전송을 확인하지 못했습니다. 오류 정보를 확인해 주세요.</small>}
      </div>):<div className="empty-state"><img className="welcome-icon" src={appIcon} alt="Clerk"/><span className="eyebrow">작은 시작, 가벼운 하루</span><h2>어떤 일을 도와드릴까요?</h2><p>폴더를 열고, 하고 싶은 일을 말해 주세요.<br/>파일을 정리하고 문서를 만드는 일을 함께합니다.</p><div className="example-prompt"><Icon name="folder"/><span>“이 폴더에 오늘 할 일을 정리한 문서를 만들어줘.”</span></div></div>}
    </article>
    {requests.map(n=><RequestCard key={n.id} request={n} item={items[n.params.itemId]} reply={result=>respond(n,result)} reject={async()=>{await bridge.unsupported(n.id!);setRequests(q=>q.filter(r=>r.id!==n.id));}}/>)}
        </div>
      </div>
    <div className="composer-dock">
    <form className="composer" onSubmit={e=>{e.preventDefault();const message=input.trim();if(!message||busy||!chat)return;void run(async()=>{setStatus('요청을 전달하고 있습니다…');const id=crypto.randomUUID();setMessages(m=>[...m,{id,role:'user',text:message}]);
        try {await bridge.sendMessage(chat,message);setInput('');}
        catch(e){setMessages(m=>m.map(item=>item.id===id?{...item,failed:true}:item));throw e;}});}}>
      <label htmlFor="task-input" className="composer-label">하고 싶은 일</label><textarea id="task-input" value={input} onChange={e=>setInput(e.target.value)} disabled={!chat||busy} placeholder={chat?"선택한 폴더에서 어떤 작업을 할까요?":"폴더를 선택하면 요청을 입력할 수 있어요."}/>
      <div className="composer-bottom"><span className="composer-hint">{busy?'작업을 진행하고 있어요':'요청은 선택한 폴더에서 진행됩니다'}</span><div className="composer-actions">
      <button type="button" disabled={!turn||pending} onClick={()=>void run(async()=>{await bridge.interrupt(chat,turn);})}><Icon name="stop"/>작업 중지</button>
      <button className="primary" disabled={!chat||busy||!input.trim()}>보내기<Icon name="arrow"/></button>
      </div></div>
    </form>
    </div>
    </div>
    <aside id="status-sidebar" className="sidebar status-sidebar" aria-label="Codex 상태">
      <div className="sidebar-group"><h2 className="eyebrow">CODEX</h2>
        <p className={`connection ${connected?'is-connected':''}`}><span className="status-dot"/>{connected?'Codex 연결됨':'연결 안 됨'}</p>
      </div>
    {!authenticated&&connected&&<section><h2>ChatGPT로 시작하기</h2><p>Codex를 사용할 수 있는 계정이 필요합니다. 로그인 정보는 이 PC의 Codex가 관리합니다.</p><button disabled={pending||!!loginId} onClick={()=>void run(login)}>ChatGPT 로그인</button>{loginId&&<><button disabled={pending} onClick={()=>void run(async()=>{await bridge.cancelLogin(loginId);setLoginId('');setLoginUrl('');})}>로그인 취소</button><button disabled={pending} onClick={()=>void run(()=>openLoginUrl(loginUrl))}>로그인 페이지 다시 열기</button></>}</section>}
      <div className="sidebar-group"><h2 className="eyebrow">USAGE</h2>
    <div className="usage-panel" aria-label="Codex 사용량">
      {usageWindows(usage).map(({label,window})=>{const left=remaining(window);return <div className="usage-card" key={label}>
        <div><strong>{label}</strong><span>{left===null?'정보 없음':`${Math.round(left)}% 남음`}</span></div>
        <progress max={100} value={left??0} aria-label={`${label} 남은 비율`}/>
        <small>{window?.resetsAt ? `${new Date(window.resetsAt*1000).toLocaleString()} 초기화` : '초기화 시간 정보 없음'}</small>
      </div>;})}
      <button disabled={pending||!connected||accountInfo?.type!=='chatgpt'} onClick={()=>void run(refreshUsage)}>사용량 새로고침</button>
      {usageError&&<p className="usage-note" role="status">{usageError}</p>}
    </div>
      </div>
      <div className="sidebar-group"><h2 className="eyebrow">STATUS</h2>
    <p className="session-status" role="status"><span className={`status-dot ${busy?'is-busy':''}`}/>{status}</p>
      </div>
      <div className="sidebar-group settings-group">
        <button aria-expanded={settings} aria-controls="settings-panel" onClick={()=>setSettings(v=>!v)}>설정</button>
    {settings&&<section id="settings-panel" aria-label="설정">
      <h2>설정</h2>
      <h3>Codex 계정</h3>
      <p>{accountInfo?.type==='chatgpt' ? `${accountInfo.email || 'ChatGPT 계정'} · ${accountInfo.planType || '플랜 정보 없음'}` : accountInfo ? `인증 방식: ${accountInfo.type}` : authenticated ? '외부 공급자 인증 사용' : '로그인되지 않았습니다.'}</p>
      <p>로그인 정보는 이 PC의 Codex가 관리하며, 로그아웃하면 같은 로그인 정보를 사용하는 Codex에도 적용됩니다.</p>
      <button disabled={busy||!connected} onClick={()=>void run(account)}>계정 새로고침</button>
      {accountInfo&&<button disabled={busy||!connected} onClick={()=>void run(async()=>{await bridge.logout();setMessages([]);setChat('');currentChat.current='';await account();})}>로그아웃</button>}
      {!authenticated&&<button disabled={busy||!connected||!!loginId} onClick={()=>void run(login)}>ChatGPT 로그인</button>}
      <h3>버전 정보</h3><p>Clerk 0.3.0</p><p className="version-info">Codex: {serverVersion || '연결 후 확인할 수 있습니다.'}</p>
      <p>{windows?'내장 Codex는 Clerk 설치 파일을 업데이트하면 함께 갱신됩니다.':'PATH에 설치된 Codex를 사용합니다. CLI 업데이트 후 다시 연결해 주세요.'}</p>
      <button disabled={busy} onClick={()=>void run(connect)}>다시 연결 · 버전 확인</button>
    </section>}
    {windows&&connected&&<details className="setup-help"><summary>처음 실행하거나 명령 실행이 안 되나요?</summary><p>Codex의 Windows 작업 보호 환경을 준비합니다. Windows 권한 확인 창이 표시될 수 있습니다.</p><button disabled={busy} onClick={()=>void run(async()=>{await bridge.prepareWindows(folder);setStatus('작업 환경을 준비하고 있습니다. Windows 권한 창을 확인해 주세요.');})}>작업 환경 준비</button></details>}
      </div>
    </aside>
  </main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
