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

test('시계로 돌아오기: returnToClock === true 인 슬롯만 대상(누락·다른 값은 끔)', () => {
  const { shouldReturn, RETURN_DELAY_MS } = require('../src/main/foreground.js');
  assert.equal(RETURN_DELAY_MS, 1500);
  assert.equal(shouldReturn({ returnToClock: true }), true);
  for (const v of [{}, { returnToClock: false }, { returnToClock: 'true' }, { returnToClock: 1 }, null, undefined]) assert.equal(shouldReturn(v), false);
});

test('슬롯 창 재사용 판정: decideLaunch({ rememberedAlive, isMinimized })', () => {
  const { decideLaunch } = require('../src/main/foreground.js');
  assert.equal(decideLaunch({ rememberedAlive: true, isMinimized: false }), 'focus-existing');
  assert.equal(decideLaunch({ rememberedAlive: true, isMinimized: true }), 'focus-existing');
  assert.equal(decideLaunch({ rememberedAlive: false, isMinimized: false }), 'launch');
  assert.equal(decideLaunch({ rememberedAlive: false, isMinimized: true }), 'launch');
  assert.equal(decideLaunch({}), 'launch');
  assert.equal(decideLaunch(), 'launch');

  // launcher.js 에서도 같은 함수 노출
  const launcher = require('../src/main/launcher.js');
  assert.equal(typeof launcher.decideLaunch, 'function');
  assert.equal(launcher.decideLaunch({ rememberedAlive: true }), 'focus-existing');
  assert.equal(launcher.decideLaunch({ rememberedAlive: false }), 'launch');
});

test('슬롯별 창 기억·조회: createForeground 인스턴스', () => {
  const { createForeground } = require('../src/main/foreground.js');
  const fg = createForeground(() => {});
  assert.equal(fg.getSlotWindow(1), null);
  fg.rememberSlotWindow(1, '9999');
  assert.equal(fg.getSlotWindow(1), '9999');
  assert.equal(fg.getSlotWindow('1'), '9999');
  assert.equal(fg.getSlotWindow(2), null);
  fg.rememberSlotWindow(1, null);
  assert.equal(fg.getSlotWindow(1), null);
});

test('focusWindow: 최소화 여부에 따라 SW_RESTORE(9) 또는 SW_SHOW(5) 호출 및 AttachThreadInput 대체 경로', () => {
  const { focusWindow, SW_RESTORE, SW_SHOW } = require('../src/main/foreground.js');
  assert.equal(SW_RESTORE, 9);
  assert.equal(SW_SHOW, 5);

  const calls = [];
  const mockFns = {
    isWindow: (h) => (h === 100n || h === 200n ? 1 : 0),
    isIconic: (h) => (h === 100n ? 1 : 0),
    showWindow: (h, cmd) => calls.push(['show', Number(h), cmd]),
    allowSetForegroundWindow: (pid) => calls.push(['allow', pid]),
    setForegroundWindow: (h) => {
      calls.push(['setFg', Number(h)]);
      return h === 100n ? 1 : 0; // 100n은 성공, 200n은 실패하여 attach 경로로
    },
    bringWindowToTop: (h) => calls.push(['bringTop', Number(h)]),
    getWindowThreadProcessId: (h, _) => 2026,
    getCurrentThreadId: () => 1004,
    attachThreadInput: (from, to, attach) => calls.push(['attach', from, to, attach]),
  };

  // 1. 살아있지 않은 창
  assert.equal(focusWindow('999', mockFns), false);

  // 2. 최소화된 창 (100n): SW_RESTORE(9)
  calls.length = 0;
  assert.equal(focusWindow('100', mockFns), true);
  assert.deepEqual(calls, [
    ['show', 100, 9],
    ['allow', -1],
    ['setFg', 100],
  ]);

  // 3. 정상 창 (200n): SW_SHOW(5), setFg 실패 -> attachThreadInput(1) -> setFg -> bringTop -> attachThreadInput(0)
  calls.length = 0;
  assert.equal(focusWindow('200', mockFns), true);
  assert.deepEqual(calls, [
    ['show', 200, 5],
    ['allow', -1],
    ['setFg', 200],
    ['attach', 1004, 2026, 1],
    ['setFg', 200],
    ['bringTop', 200],
    ['attach', 1004, 2026, 0],
  ]);
});

// 개정 기록 | 2026-11-11 | 실행 후 시계로 돌아오기 | 사용자 요청
// 개정 기록 | 2026-11-15 | 슬롯 창 재사용 판정(decideLaunch) 및 focusWindow 단위 시험 | 사용자 요청
