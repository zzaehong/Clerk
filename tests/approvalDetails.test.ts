import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fileApprovalDetails, commandApprovalDetails} from '../src/approvalDetails.ts';

test('file approval describes creation, deletion, modification and movement with original paths and diffs',()=>{
  const changes=[
    {path:'C:\\문서\\새 문서.md',kind:{type:'add'},diff:'+오늘 할 일'},
    {path:'C:\\문서\\old.md',kind:{type:'delete'},diff:'-삭제할 내용'},
    {path:'C:\\문서\\edit.md',kind:{type:'update',move_path:null},diff:'-이전\n+이후'},
    {path:'C:\\문서\\move.md',kind:{type:'update',move_path:'C:\\보관\\move.md'},diff:'-이전\n+이후'},
  ];
  const result=fileApprovalDetails({type:'fileChange',id:'patch',changes},'patch');
  assert.deepEqual(result.map(c=>c.action),['생성','삭제','수정','이동 및 수정']);
  assert.deepEqual(result.map(c=>c.path),changes.map(c=>c.path));
  assert.deepEqual(result.map(c=>c.diff),changes.map(c=>c.diff));
  assert.equal(result[3].destination,'C:\\보관\\move.md');
});
test('missing, unrelated or unknown file details are not presented as known changes',()=>{
  assert.deepEqual(fileApprovalDetails(undefined,'patch'),[]);
  assert.deepEqual(fileApprovalDetails({type:'fileChange',id:'other',changes:[{}]},'patch'),[]);
  assert.deepEqual(fileApprovalDetails({type:'commandExecution',id:'patch',changes:[{}]},'patch'),[]);
  const [unknown]=fileApprovalDetails({type:'fileChange',id:'patch',changes:[{kind:{type:'future'}}]},'patch');
  assert.equal(unknown.action,'변경 유형 확인 필요');
  assert.equal(unknown.path,'경로 정보 없음');
});
test('command request details take precedence over the parent item and never infer deletion targets',()=>{
  const result=commandApprovalDetails({itemId:'cmd',command:'rm "$TARGET"',cwd:'/selected',commandActions:[{type:'unknown',command:'rm "$TARGET"'}]}, {type:'commandExecution',id:'cmd',command:'old',cwd:'/old'});
  assert.equal(result.command,'rm "$TARGET"');
  assert.equal(result.cwd,'/selected');
  assert.match(result.descriptions[0],/대상 파일 목록은 제공되지/);
});
test('command approvals fall back only to the matching command item',()=>{
  const item={type:'commandExecution',id:'cmd',command:'cat notes.md',cwd:'/docs',commandActions:[{type:'read',path:'/docs/notes.md',name:'notes.md'}]};
  assert.equal(commandApprovalDetails({itemId:'cmd'},item).command,'cat notes.md');
  assert.deepEqual(commandApprovalDetails({itemId:'cmd'},item).descriptions,['파일 읽기: /docs/notes.md']);
  assert.equal(commandApprovalDetails({itemId:'other'},item).command,'');
});
test('network approval preserves the actual destination',()=>{
  const result=commandApprovalDetails({networkApprovalContext:{host:'example.com',protocol:'https'}},undefined);
  assert.equal(result.host,'example.com'); assert.equal(result.protocol,'https');
});
