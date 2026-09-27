import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Markdown} from '../src/Markdown.ts';
import {updateAssistant, type ChatMessage} from '../src/chat.ts';
import {codexUsage, mergeUsage, usageWindows, remaining} from '../src/usage.ts';

test('streamed replies stay after the user and separate item IDs do not mix',()=>{
  let messages: ChatMessage[]=[{id:'user',role:'user',text:'요청'}];
  messages=updateAssistant(messages,'comment','확인',true);
  messages=updateAssistant(messages,'answer','# 결과',true);
  messages=updateAssistant(messages,'comment',' 중',true);
  messages=updateAssistant(messages,'answer','# 결과\n완료');
  assert.deepEqual(messages.map(m=>m.text),['요청','확인 중','# 결과\n완료']);
  assert.equal(messages[0].role,'user');
  assert.equal(updateAssistant(messages,'answer','# 결과\n완료').length,3);
});
test('completion without deltas still displays the answer',()=>{
  assert.deepEqual(updateAssistant([],'answer','완료'),[{id:'answer',role:'assistant',text:'완료'}]);
});
test('sparse usage notifications preserve the other quota window',()=>{
  const weekly={usedPercent:90,windowDurationMins:10080,resetsAt:1800000000};
  const update={primary:{usedPercent:30,windowDurationMins:300,resetsAt:null},secondary:null};
  const result=mergeUsage({secondary:weekly},update);
  assert.equal(result.secondary,weekly);
  assert.deepEqual(usageWindows(result).map(w=>remaining(w.window)),[70,10]);
});
test('Codex bucket wins over unrelated model limits',()=>{
  const snapshot={limitId:'codex',primary:{usedPercent:25,windowDurationMins:300,resetsAt:1800000000}};
  assert.equal(codexUsage({rateLimits:{limitId:'other'},rateLimitsByLimitId:{codex:snapshot}}),snapshot);
  assert.equal(codexUsage({rateLimits:{limitId:'other'}}),null);
  assert.equal(remaining(usageWindows(snapshot)[0].window),75);
});
test('duration determines 5h and weekly labels; unknown and missing limits are not full quota',()=>{
  const short={usedPercent:12,windowDurationMins:300,resetsAt:null};
  const weekly={usedPercent:95,windowDurationMins:10080,resetsAt:null};
  assert.deepEqual(usageWindows({primary:weekly,secondary:short}).map(w=>remaining(w.window)),[88,5]);
  assert.deepEqual(usageWindows({primary:{...short,windowDurationMins:15}}).map(w=>remaining(w.window)),[null,null]);
  assert.equal(remaining(null),null);
  assert.equal(remaining({...short,usedPercent:110}),0);
  assert.equal(remaining({...short,usedPercent:NaN}),null);
});
test('Markdown renders headings, lists, fenced code, tables and task lists',()=>{
  const html=renderToStaticMarkup(createElement(Markdown,{text:'# 제목\n\n- 항목\n\n```ts\nconst x = 1;\n```\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n- [x] 완료'}));
  for(const tag of ['<h1>','<ul>','<pre>','<table>','type="checkbox"']) assert.ok(html.includes(tag),tag);
});
test('Markdown does not execute HTML or javascript links or fetch remote images',()=>{
  const html=renderToStaticMarkup(createElement(Markdown,{text:'<script>alert(1)</script>\n\n[bad](javascript:alert%281%29)\n\n![private](https://example.com/tracker.png)\n\n[docs](https://example.com)'}));
  assert.doesNotMatch(html,/<script|javascript:|<img|tracker\.png/);
  assert.match(html,/rel="noopener noreferrer"/);
  assert.match(html,/https:\/\/example.com/);
});
