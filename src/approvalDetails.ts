type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue => value !== null && typeof value === 'object' ? value as RecordValue : {};
const text = (value: unknown): string => typeof value === 'string' ? value : '';

export function fileApprovalDetails(item: unknown, itemId: string) {
  const source = record(item);
  if (source.type !== 'fileChange' || source.id !== itemId || !Array.isArray(source.changes)) return [];
  return source.changes.map(value => {
    const change = record(value), kind = record(change.kind);
    const destination = text(kind.move_path);
    const action = kind.type === 'add' ? '생성' : kind.type === 'delete' ? '삭제' : kind.type === 'update' ? destination ? '이동 및 수정' : '수정' : '변경 유형 확인 필요';
    return {path:text(change.path) || '경로 정보 없음', action, destination, diff:text(change.diff)};
  });
}

export function commandApprovalDetails(params: unknown, item: unknown) {
  const request = record(params), candidate = record(item);
  const source = candidate.type === 'commandExecution' && candidate.id === request.itemId ? candidate : {};
  const actions = request.commandActions ?? source.commandActions;
  const descriptions = Array.isArray(actions) ? actions.map(value => {
    const action = record(value), path = text(action.path);
    switch (action.type) {
      case 'read': return `파일 읽기: ${path || text(action.name) || '경로 정보 없음'}`;
      case 'listFiles': return `파일 목록 조회: ${path || '작업 폴더'}`;
      case 'search': return `검색: ${text(action.query) || '검색어 정보 없음'} (${path || '작업 폴더'})`;
      default: return '이 명령의 수정·삭제 대상 파일 목록은 제공되지 않았습니다. 실행 명령을 확인하세요.';
    }
  }) : [];
  const network = record(request.networkApprovalContext);
  return {
    command:text(request.command) || text(source.command),
    cwd:text(request.cwd) || text(source.cwd),
    descriptions,
    host:text(network.host), protocol:text(network.protocol),
  };
}
