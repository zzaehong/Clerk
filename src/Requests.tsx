import {useState} from 'react';
import type {Notice} from './bridge.ts';
import type {ToolRequestUserInputParams} from './protocol/v2/ToolRequestUserInputParams';
import {fileApprovalDetails, commandApprovalDetails} from './approvalDetails.ts';
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
  const changes=fileApprovalDetails(item,params.itemId);
  const execution=commandApprovalDetails(params,item);
  async function submit(action:()=>Promise<void>) {
    if(sending) return;
    setSending(true); setError('');
    try {await action();} catch(e) {setError(String(e)); setSending(false);}
  }
  return <section className="request-card" aria-label={question?'Codex의 질문':'승인 요청'}>
    <h2>{question?'Codex의 질문':file?'파일 변경을 허용할까요?':command?'명령 실행을 허용할까요?':'지원하지 않는 요청입니다'}</h2>
    {(command||file)&&<p className="approval-reason"><strong>승인 요청 이유</strong><br/>{params.reason || 'Codex가 현재 권한 설정에 따라 승인을 요청했습니다. 구체적인 이유는 제공되지 않았습니다.'}</p>}
    {question&&params.reason&&<p>{params.reason}</p>}
    {command && <>
      {execution.host&&<p><strong>네트워크 연결 대상</strong>: {execution.protocol ? `${execution.protocol}://` : ''}{execution.host}</p>}
      <p><strong>실행할 명령</strong></p><pre>{execution.command || '실행 명령이 제공되지 않았습니다.'}</pre>
      <p><strong>작업 폴더</strong>: {execution.cwd || '정보 없음'}</p>
      {execution.descriptions.length ? <ul>{execution.descriptions.map((description,index)=><li key={index}>{description}</li>)}</ul> : !execution.host&&<p>이 명령의 수정·삭제 대상 파일 목록은 제공되지 않았습니다. 실행 명령을 확인하세요.</p>}
    </>}
    {file && <>
      {changes.length ? <><p><strong>변경할 파일 {changes.length}개</strong></p><ul className="approval-files">{changes.map((change,index)=><li key={index}>
        <div><strong className={`change-kind ${change.action==='삭제'?'is-delete':''}`}>{change.action}</strong> <code>{change.path}</code></div>
        {change.destination&&<p>이동할 위치: <code>{change.destination}</code></p>}
        <details open><summary>{change.action==='삭제'?'삭제할 내용':'변경 내용'}</summary><pre>{change.diff || '상세 내용이 제공되지 않았습니다.'}</pre></details>
      </li>)}</ul></> : <p>변경할 파일 정보가 아직 도착하지 않았습니다. 정보가 도착하면 여기에 표시됩니다.</p>}
      {params.grantRoot&&<p><strong>추가 쓰기 권한 요청 경로</strong>: <code>{params.grantRoot}</code></p>}
    </>}
    {question ? <form onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget); const answers=Object.fromEntries((params as ToolRequestUserInputParams).questions.map(q=>[q.id,{answers:[String(data.get(q.id)||'')]}])); void submit(()=>reply({answers}));}}>
      {(params as ToolRequestUserInputParams).questions.map(q=><label key={q.id}>{q.question}
        {q.options && <ul>{q.options.map(o=><li key={o.label}><strong>{o.label}</strong>: {o.description}</li>)}</ul>}
        <input name={q.id} type={q.isSecret?'password':'text'} required disabled={sending} list={`options-${request.id}-${q.id}`} autoComplete="off"/>
        <datalist id={`options-${request.id}-${q.id}`}>{q.options?.map(o=><option key={o.label} value={o.label}/>)}</datalist>
      </label>)}<button className="primary" disabled={sending}>답변 보내기</button>
    </form> : (command || file) ? <><button disabled={sending} onClick={()=>void submit(()=>reply({decision:'decline'}))}>거부</button><button className="primary" disabled={sending} onClick={()=>void submit(()=>reply({decision:'accept'}))}>이번만 허용</button></> : <button disabled={sending} onClick={()=>void submit(reject)}>요청 거부</button>}
    <details><summary>요청 원문 보기</summary><pre>{JSON.stringify({params,item},null,2)}</pre></details>
    {error && <p role="alert">응답을 전달하지 못했습니다. {error}</p>}
  </section>;
}
