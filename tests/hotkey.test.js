const test = require('node:test');
const assert = require('node:assert/strict');
const { toAccelerator } = require('../src/renderer/keycombo');
test('전역 조합 변환표와 안전한 수정키', () => {
  for (let n=1;n<=24;n++) assert.equal(toAccelerator('F'+n),'F'+n);
  for (const key of ['Shift+F1','Space','Enter','Tab','Esc']) assert.equal(toAccelerator(key),null);
  for (const [a,b] of [['Ctrl+H','Control+H'], ['Win+Shift+Esc','Shift+Super+Escape'], ['Alt+Space','Alt+Space'], ['Ctrl+Enter','Control+Enter'], ['Alt+Tab','Alt+Tab']]) assert.equal(toAccelerator(a),b);
  for (const k of ['F1','F24','A','Z','0','9']) assert.equal(toAccelerator('Ctrl+'+k),'Control+'+k);
  for (const a of ['', 'H','Shift+H','Ctrl','Ctrl+Foo',null]) assert.equal(toAccelerator(a),null);
});
test('list states, duplicates, reapply, suspend/resume and dispose own shortcuts', () => {
  const {createHotkeys}=require('../src/main/hotkey');
  const registered=new Map([['other',()=>{}]]),removed=[],pressed=[];
  const shortcut={register(a,cb){if(a==='Alt+T')return false;registered.set(a,cb);return true;},unregister(a){removed.push(a);registered.delete(a);}};
  const h=createHotkeys({shortcut,onPress:e=>pressed.push(e.id)});
  const list=[['h1','Ctrl+H'],['h2',''],['h3','Shift+H'],['h4','h+ctrl'],['h5','Alt+T']].map(([id,combo])=>({id,combo,action:'return'}));
  assert.deepEqual(h.apply(list),{h1:'ok',h2:'off',h3:'invalid',h4:'dup',h5:'taken'});
  registered.get('Control+H')(); assert.deepEqual(pressed,['h1']);
  h.apply([{id:'h6',combo:'F24'}]);assert.deepEqual(removed,['Control+H']);
  h.suspend(true);assert.deepEqual([...registered.keys()],['other']);
  h.apply(list);assert.equal(registered.size,1);h.suspend(false);assert.ok(registered.has('Control+H'));
  const states=h.states();states.h1='bad';assert.equal(h.states().h1,'ok');
  h.dispose();assert.deepEqual([...registered.keys()],['other']);assert.equal(h.states().h1,'off');
});
// 개정 기록 | 2026-11-16 | 목록 등록과 F키 허용 시험 | 사용자 요청
test('전역 단축키 등록·재등록·일시 해제·자기 것만 정리', () => {
  const { createHotkeys } = require('../src/main/hotkey');
  const registered = new Map(), removed = []; let taken = false, presses = 0;
  const shortcut = { register(a,cb) { if(taken) return false; registered.set(a,cb); return true; }, unregister(a) { removed.push(a); registered.delete(a); } };
  const list = createHotkeys({ shortcut, onPress: () => presses++ });
  const h = {apply: combo => list.apply([{id:'h1',combo}]).h1, state:()=>list.states().h1, suspend:on=>list.suspend(on), dispose:()=>list.dispose()};
  assert.equal(h.apply('Ctrl+H'),'ok'); registered.get('Control+H')(); assert.equal(presses,1);
  assert.equal(h.apply('Alt+H'),'ok'); assert.deepEqual(removed,['Control+H']);
  h.suspend(true); assert.equal(registered.size,0); h.suspend(false); assert.ok(registered.has('Alt+H'));
  h.suspend(true); h.apply('Ctrl+J'); assert.equal(registered.size,0); h.suspend(false); assert.ok(registered.has('Control+J'));
  taken=true; assert.equal(h.apply('Ctrl+K'),'taken'); taken=false;
  assert.equal(h.apply('Shift+A'),'invalid'); assert.equal(h.apply(''),'off'); assert.equal(h.state(),'off');
  registered.set('other',()=>{}); h.apply('Ctrl+H'); h.dispose(); assert.deepEqual([...registered.keys()],['other']);
});
// 개정 기록 | 2026-11-16 | 전역 복귀 단축키 단위 시험 | 사용자 요청

// 개정 기록 | 2026-11-16 | customHotkeys 목록 배선 | 사용자 요청
