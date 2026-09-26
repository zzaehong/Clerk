import type { ThreadStartParams } from './protocol/v2/ThreadStartParams';
import type { ThreadResumeParams } from './protocol/v2/ThreadResumeParams';
import type { TurnStartParams } from './protocol/v2/TurnStartParams';
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json | undefined };
export type Message = { id?: string | number; method?: string; params?: any; result?: any; error?: {code: number; message: string; data?: unknown} };
export type TransportEvent = {kind: 'message'; message: Message} | {kind: 'closed'; text: string} | {kind: 'diagnostic'; text: string};
export interface Transport {
  start(receive: (event: TransportEvent) => void): Promise<void>;
  write(message: Message): Promise<void>;
  stop(): Promise<void>;
}
export type Notice = {method: string; params: any; id?: string | number};
export class CodexBridge {
  private sequence = 0;
  private generation = 0;
  private pending = new Map<number, {resolve: (value: any) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout>}>();
  private requests = new Set<string | number>();
  private connected = false;
  private diagnostics: string[] = [];
  onNotice: (notice: Notice) => void = () => {};
  private transport: Transport;
  private timeout: number;
  constructor(transport: Transport, timeout = 60_000) { this.transport = transport; this.timeout = timeout; }
  private rejectPending(reason: string) {
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error(reason)); }
    this.pending.clear(); this.requests.clear();
  }
  async connect() {
    const generation = ++this.generation;
    this.connected = false;
    this.rejectPending('Codex connection replaced');
    this.diagnostics = [];
    await this.transport.start(event => {
      if (generation !== this.generation) return;
      if (event.kind === 'closed') {
        this.connected = false; this.rejectPending(event.text);
        this.onNotice({method: 'bridge/closed', params: {message: [event.text, ...this.diagnostics].join('\n')}}); return;
      }
      if (event.kind === 'diagnostic') { this.diagnostics = [...this.diagnostics.slice(-19), event.text.slice(0, 2000)]; this.onNotice({method: 'bridge/diagnostic', params: {message: event.text}}); return; }
      const message = event.message;
      if (message.method) {
        if (message.id !== undefined) this.requests.add(message.id);
        if (message.method === 'serverRequest/resolved') this.requests.delete(message.params.requestId);
        this.onNotice({method: message.method, params: message.params ?? {}, id: message.id});
      } else if (typeof message.id === 'number') {
        const p = this.pending.get(message.id);
        if (!p) return;
        clearTimeout(p.timer); this.pending.delete(message.id);
        if (message.error) p.reject(new Error(JSON.stringify(message.error)));
        else p.resolve(message.result);
      }
    });
    this.connected = true;
    try {
      await this.call('initialize', {clientInfo: {name:'clerk', title:'Clerk', version:'0.1.0'}, capabilities:{experimentalApi:true}});
      await this.transport.write({method:'initialized', params:{}});
    } catch (e) { this.connected = false; await this.transport.stop(); throw e; }
  }
  call<T = any>(method: string, params: object): Promise<T> {
    if (!this.connected) return Promise.reject(new Error('Codex is disconnected'));
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`Codex request timed out: ${method}. 실행 여부를 확인하려면 다시 연결하세요.`)); }, this.timeout);
      this.pending.set(id, {resolve, reject, timer});
      this.transport.write({id, method, params}).catch(e => { clearTimeout(timer); this.pending.delete(id); reject(e); });
    });
  }
  async respond(id: string | number, result: unknown) {
    if (!this.requests.has(id)) throw new Error('이미 종료된 요청입니다.');
    await this.transport.write({id, result}); this.requests.delete(id);
  }
  async unsupported(id: string | number) {
    await this.transport.write({id, error:{code:-32601, message:'Clerk does not support this request; no permission granted'}});
    this.requests.delete(id);
  }
  startLogin() { return this.call('account/login/start', {type:'chatgpt'}); }
  cancelLogin(loginId: string) { return this.call('account/login/cancel', {loginId}); }
  prepareWindows(cwd?: string) { return this.call('windowsSandbox/setupStart', {mode:'elevated', cwd:cwd || null}); }
  getAccount() { return this.call('account/read', {}); }
  getRateLimits() { return this.call('account/rateLimits/read', {}); }
  startChat(cwd: string) { return this.call('thread/start', {cwd, sandbox:'workspace-write', approvalPolicy:'untrusted', approvalsReviewer:'user'} satisfies ThreadStartParams); }
  resumeChat(threadId: string, cwd: string) { return this.call('thread/resume', {threadId, cwd, sandbox:'workspace-write', approvalPolicy:'untrusted', approvalsReviewer:'user'} satisfies ThreadResumeParams); }
  sendMessage(threadId: string, text: string) { return this.call('turn/start', {threadId, input:[{type:'text', text, text_elements:[]}] } satisfies TurnStartParams); }
  interrupt(threadId: string, turnId: string) { return this.call('turn/interrupt', {threadId, turnId}); }
  async disconnect() { ++this.generation; this.connected = false; this.rejectPending('Codex disconnected'); await this.transport.stop(); }
}
