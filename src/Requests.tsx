import {useState} from 'react';
import type {Notice} from './bridge.ts';
import type {ToolRequestUserInputParams} from './protocol/v2/ToolRequestUserInputParams';
export function RequestCard({request, item, reply, reject}: {
  request: Notice; item?: unknown;
  reply: (result: unknown) => Promise<void>; reject: () => Promise<void>;
}) {
  const [sending,setSending]=useState(false);
  const [error,setError]=useState('');
  const question=request.method==='item/tool/requestUserInput';
  const command=request.method==='item/commandExecution/requestApproval';
  const file=request.method==='item/fileChange/requestApproval';
  const params=request.params;
  async function submit(action:()=>Promise<void>) {
    if(sending) return;
    setSending(true); setError('');
    try {await action();} catch(e) {setError(String(e)); setSending(false);}
  }
  return <section aria-label={question?'Codex의 질문':'승인 요청'}>
    <h2>{question?'Codex의 질문':file?'파일 변경을 허용할까요?':command?'명령 실행을 허용할까요?':'지원하지 않는 요청입니다'}</h2>
    {params.reason && <p>{params.reason}</p>}
    {command && <><p>설치 명령인 경우 컴퓨터 환경이 변경될 수 있습니다. 아래 명령을 확인하세요.</p><pre>{params.command || '실행 명령이 제공되지 않았습니다.'}</pre><p>작업 폴더: {params.cwd || '정보 없음'}</p></>}
    {file && <pre>{item ? JSON.stringify(item,null,2) : '변경 정보가 아직 도착하지 않았습니다. 상세 정보가 없으면 거부할 수 있습니다.'}</pre>}
    {question ? <form onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget); const answers=Object.fromEntries((params as ToolRequestUserInputParams).questions.map(q=>[q.id,{answers:[String(data.get(q.id)||'')]}])); void submit(()=>reply({answers}));}}>
      {(params as ToolRequestUserInputParams).questions.map(q=><label key={q.id}>{q.question}
        {q.options && <ul>{q.options.map(o=><li key={o.label}><strong>{o.label}</strong>: {o.description}</li>)}</ul>}
        <input name={q.id} type={q.isSecret?'password':'text'} required disabled={sending} list={`options-${request.id}-${q.id}`} autoComplete="off"/>
        <datalist id={`options-${request.id}-${q.id}`}>{q.options?.map(o=><option key={o.label} value={o.label}/>)}</datalist>
      </label>)}<button disabled={sending}>답변 보내기</button>
    </form> : (command || file) ? <><button disabled={sending} onClick={()=>void submit(()=>reply({decision:'decline'}))}>거부</button><button disabled={sending} onClick={()=>void submit(()=>reply({decision:'accept'}))}>이번만 허용</button></> : <button disabled={sending} onClick={()=>void submit(reject)}>요청 거부</button>}
    <details><summary>요청 상세 보기</summary><pre>{JSON.stringify(params,null,2)}</pre></details>
    {error && <p role="alert">응답을 전달하지 못했습니다. {error}</p>}
  </section>;
}
