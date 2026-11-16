const test = require('node:test');
const assert = require('node:assert/strict');
const { toAccelerator } = require('../src/renderer/keycombo');
test('전역 조합 변환표와 안전한 수정키', () => {
  for (const [a,b] of [['Ctrl+H','Control+H'], ['Win+Shift+Esc','Shift+Super+Escape'], ['Alt+Space','Alt+Space'], ['Ctrl+Enter','Control+Enter'], ['Alt+Tab','Alt+Tab']]) assert.equal(toAccelerator(a),b);
  for (const k of ['F1','F24','A','Z','0','9']) assert.equal(toAccelerator('Ctrl+'+k),'Control+'+k);
  for (const a of ['', 'H','Shift+H','Ctrl','Ctrl+Foo',null]) assert.equal(toAccelerator(a),null);
});
test('전역 단축키 등록·재등록·일시 해제·자기 것만 정리', () => {
  const { createHotkey } = require('../src/main/hotkey');
  const registered = new Map(), removed = []; let taken = false, presses = 0;
  const shortcut = { register(a,cb) { if(taken) return false; registered.set(a,cb); return true; }, unregister(a) { removed.push(a); registered.delete(a); } };
  const h = createHotkey({ shortcut, onPress: () => presses++ });
  assert.equal(h.apply('Ctrl+H'),'ok'); registered.get('Control+H')(); assert.equal(presses,1);
  assert.equal(h.apply('Alt+H'),'ok'); assert.deepEqual(removed,['Control+H']);
  h.suspend(true); assert.equal(registered.size,0); h.suspend(false); assert.ok(registered.has('Alt+H'));
  h.suspend(true); h.apply('Ctrl+J'); assert.equal(registered.size,0); h.suspend(false); assert.ok(registered.has('Control+J'));
  taken=true; assert.equal(h.apply('Ctrl+K'),'taken'); taken=false;
  assert.equal(h.apply('Shift+A'),'invalid'); assert.equal(h.apply(''),'off'); assert.equal(h.state(),'off');
  registered.set('other',()=>{}); h.apply('Ctrl+H'); h.dispose(); assert.deepEqual([...registered.keys()],['other']);
});
// 개정 기록 | 2026-11-16 | 전역 복귀 단축키 단위 시험 | 사용자 요청
