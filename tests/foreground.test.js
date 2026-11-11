const test = require('node:test');
const assert = require('node:assert/strict');
const { shouldSend, confirmSend } = require('../src/main/foreground.js');

const SELF = '100';
const s = (t, hwnd, cls = 'App') => ({ t, hwnd, cls });

test('표본이 없거나 1000ms 미만이면 보내지 않음', () => {
  assert.equal(shouldSend([], SELF, 1000), false);
  assert.equal(shouldSend([s(0, '5'), s(200, '5'), s(400, '5'), s(600, '5'), s(800, '5')], SELF, 800), false);
});

test('같은 앱 창이 1000ms 이어지면 보냄', () => {
  assert.equal(shouldSend([s(0, '5'), s(200, '5'), s(400, '5'), s(600, '5'), s(800, '5'), s(1000, '5')], SELF, 1000), true);
});

test('시계 창·창 없음·바탕화면 계열은 아무리 오래 맨 앞이어도 보내지 않음', () => {
  assert.equal(shouldSend([s(0, SELF), s(1000, SELF)], SELF, 1000), false);
  assert.equal(shouldSend([s(0, ''), s(1000, '')], SELF, 1000), false);
  for (const cls of ['Progman', 'WorkerW', 'Shell_TrayWnd']) assert.equal(shouldSend([s(0, '7', cls), s(1000, '7', cls)], SELF, 1000), false, cls);
});

test('창이 바뀌면 그 시점부터 1000ms를 다시 잼', () => {
  const run = [s(0, SELF), s(200, SELF), s(400, '5'), s(600, '5'), s(1000, '5'), s(1200, '5')];
  assert.equal(shouldSend(run, SELF, 1200), false);
  assert.equal(shouldSend([...run, s(1400, '5')], SELF, 1400), true);
  assert.equal(shouldSend([s(0, '5'), s(500, '5'), s(1000, '5'), s(1200, '6')], SELF, 1200), false);   // 마지막에 다른 창
});

test('재확인: 같은 앱 창이 그대로일 때만 true', () => {
  assert.equal(confirmSend('5', { hwnd: '5', cls: 'App' }, SELF), true);
  assert.equal(confirmSend('5', { hwnd: '6', cls: 'App' }, SELF), false);   // 창이 바뀜
  assert.equal(confirmSend('5', { hwnd: '', cls: '' }, SELF), false);
  assert.equal(confirmSend('5', { hwnd: '5', cls: 'Progman' }, SELF), false);
  assert.equal(confirmSend(SELF, { hwnd: SELF, cls: 'Chrome_WidgetWin_1' }, SELF), false);   // 시계 창
  assert.equal(confirmSend('5', null, SELF), false);
});
