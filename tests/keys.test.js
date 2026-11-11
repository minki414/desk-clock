const test = require('node:test');
const assert = require('node:assert/strict');
const { initial, route } = require('../src/renderer/keys.js');

const key = (code, extra = {}) => ({ code, t: 10000, ...extra });
const press = (state, ...codes) => codes.reduce((s, c) => route(s, key(c)).state, state);
const types = (r) => r.actions.map((a) => a.type);

test('설정 서랍이 열리면 Esc 외 전부 무시', () => {
  const s = { ...initial(), settingsOpen: true };
  for (const c of ['Numpad1', 'KeyT', 'Space', 'Digit5', 'Enter']) {
    const r = route(s, key(c));
    assert.equal(r.state, s);
    assert.deepEqual(r.actions, []);
  }
  const r = route(s, key('Escape'));
  assert.equal(r.state.settingsOpen, false);
  assert.deepEqual(types(r), ['settings.close']);
});

test('알림 울림: 끄기 키만 반응', () => {
  const s = { ...initial(), phase: 'ringing' };
  for (const c of ['Enter', 'NumpadEnter', 'Space', 'NumpadMultiply', 'Numpad0']) {
    const r = route(s, key(c));
    assert.equal(r.state.phase, 'hidden');
    assert.deepEqual(types(r), ['timer.cancel']);
  }
  const r = route(s, key('Numpad1'));
  assert.equal(r.state, s);   // 실행되지 않음
  assert.deepEqual(r.actions, []);
});

test('T와 숫자패드 나누기로 입력 열기', () => {
  assert.equal(press(initial(), 'KeyT').phase, 'input');
  assert.equal(press(initial(), 'NumpadDivide').phase, 'input');
  // 단축키가 꺼져 있어도 타이머는 동작
  assert.equal(press({ ...initial(), hotkeysOn: false }, 'KeyT').phase, 'input');
});

test('입력 중 숫자패드 1~9는 숫자이고 실행이 아님', () => {
  let s = press(initial(), 'KeyT');
  const r = route(s, key('Numpad1'));
  assert.equal(r.state.input, '1');
  assert.deepEqual(r.actions, []);
  s = press(s, 'Digit1', 'NumpadDecimal', 'Numpad3', 'Digit5');
  assert.equal(s.input, '1.35');
});

test('입력 규칙: 두 번째 점·7자 초과 무시, Backspace, 점으로 시작', () => {
  let s = press(initial(), 'KeyT', 'Digit1', 'Period', 'Digit2');
  const again = route(s, key('Period'));
  assert.equal(again.state, s);
  s = press(initial(), 'KeyT', 'Period');
  assert.equal(s.input, '0.');
  s = press(initial(), 'KeyT', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7');
  assert.equal(s.input, '1234567');
  assert.equal(route(s, key('Digit8')).state, s);
  assert.equal(press(s, 'Backspace').input, '123456');
  assert.equal(route(press(initial(), 'KeyT'), key('Backspace')).state.input, '');
});

test('입력 중 Enter: 유효하면 시작, 무효면 입력 유지·초기화·흔들림', () => {
  let s = press(initial(), 'KeyT', 'Digit1', 'Period', 'Digit3');
  let r = route(s, key('Enter'));
  assert.equal(r.state.phase, 'running');
  assert.deepEqual(r.actions, [{ type: 'timer.start', ms: 63000 }]);

  s = press(initial(), 'KeyT', 'Digit1', 'Period', 'Digit6', 'Digit0');
  r = route(s, key('NumpadEnter'));
  assert.equal(r.state.phase, 'input');
  assert.equal(r.state.input, '');   // 표시값은 0.00
  assert.deepEqual(types(r), ['timer.invalid']);
  // 빈 입력도 무효
  r = route(press(initial(), 'KeyT'), key('Enter'));
  assert.equal(r.state.phase, 'input');
  assert.deepEqual(types(r), ['timer.invalid']);
});

test('입력 중 Esc: 입력 닫기', () => {
  const s = press(initial(), 'KeyT', 'Digit4', 'Escape');
  assert.equal(s.phase, 'hidden');
  assert.equal(s.input, '');
});

test('동작 중: Space·NumpadMultiply 일시정지/재개, Enter 초기화', () => {
  const run = { ...initial(), phase: 'running' };
  let r = route(run, key('Space'));
  assert.equal(r.state.phase, 'paused');
  assert.deepEqual(types(r), ['timer.pause']);
  r = route(r.state, key('NumpadMultiply'));
  assert.equal(r.state.phase, 'running');
  assert.deepEqual(types(r), ['timer.resume']);
  r = route({ ...run, phase: 'paused' }, key('Enter'));
  assert.equal(r.state.phase, 'input');
  assert.equal(r.state.input, '');
  assert.deepEqual(types(r), ['timer.cancel']);
});

test('슬롯 실행: 단축키 켜짐일 때만, 반복·1.5초 내 중복 무시', () => {
  let r = route(initial(), key('Numpad3'));
  assert.deepEqual(r.actions, [{ type: 'launch', slot: 3 }]);
  // 같은 슬롯 1.5초 안
  assert.deepEqual(route(r.state, key('Numpad3', { t: 11000 })).actions, []);
  // 다른 슬롯은 허용
  assert.deepEqual(types(route(r.state, key('Numpad4', { t: 10100 }))), ['launch']);
  // 1.5초 이후 허용
  assert.deepEqual(types(route(r.state, key('Numpad3', { t: 11500 }))), ['launch']);
  // e.repeat 무시
  assert.deepEqual(route(initial(), key('Numpad3', { repeat: true })).actions, []);
  // 단축키 끔
  assert.deepEqual(route({ ...initial(), hotkeysOn: false }, key('Numpad3')).actions, []);
  // 0은 슬롯 아님, 상단 숫자열도 실행 아님
  assert.deepEqual(route(initial(), key('Numpad0')).actions, []);
  assert.deepEqual(route(initial(), key('Digit1')).actions, []);
});

test('타이머가 도는 동안에도 슬롯 실행 가능, 수정키는 무시', () => {
  assert.deepEqual(types(route({ ...initial(), phase: 'running' }, key('Numpad2'))), ['launch']);
  assert.deepEqual(route(initial(), key('Numpad2', { alt: true })).actions, []);
});

test('같은 슬롯은 다른 슬롯이 끼어들어도 1.5초 내 재실행 안 함', () => {
  let s = initial(), launches = [];
  for (const [code, t] of [['Numpad1', 0], ['Numpad2', 100], ['Numpad1', 200], ['Numpad1', 1700]]) {
    const r = route(s, { code, t }); s = r.state;
    launches.push(...r.actions.filter((a) => a.type === 'launch').map((a) => a.slot));
  }
  assert.deepEqual(launches, [1, 2, 1]);
});

test('볼륨 +/−: 단축키 켜짐이면 volume 액션, 꾹 누름(repeat)도 허용', () => {
  for (const phase of ['hidden', 'input', 'running', 'ringing']) {
    const s = { ...initial(), phase };
    const up = route(s, key('NumpadAdd', { repeat: true }));
    assert.deepEqual(up.actions, [{ type: 'volume', up: true }]);
    assert.equal(up.state, s);
    assert.deepEqual(route(s, key('NumpadSubtract')).actions, [{ type: 'volume', up: false }]);
  }
});

test('볼륨: 단축키 끔·설정 서랍 열림·수정키면 아무 일도 없음', () => {
  for (const s of [{ ...initial(), hotkeysOn: false }, { ...initial(), settingsOpen: true }]) {
    for (const c of ['NumpadAdd', 'NumpadSubtract']) assert.deepEqual(route(s, key(c)).actions, []);
  }
  assert.deepEqual(route(initial(), key('NumpadAdd', { ctrl: true })).actions, []);
});

test('Numpad0은 실행을 일으키지 않음(숨김 상태 무동작, 입력 중 숫자)', () => {
  const r = route(initial(), key('Numpad0'));
  assert.equal(r.state.phase, "hidden");
  assert.deepEqual(r.actions, []);
  assert.equal(route({ ...initial(), phase: 'input' }, key('Numpad0')).state.input, '0');
});

test('슬롯 실행은 repeat 차단(볼륨과 달리)', () => {
  assert.deepEqual(route(initial(), key('Numpad1', { repeat: true })).actions, []);
});
