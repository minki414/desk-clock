const test = require('node:test');
const assert = require('node:assert/strict');
const { createScheduler, createSync, backoff } = require('../src/main/sync.js');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const MIN = 60 * 1000;

test('백오프는 1분에서 두 배씩 늘고 30분이 상한', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 20].map(backoff), [1 * MIN, 2 * MIN, 4 * MIN, 8 * MIN, 16 * MIN, 30 * MIN, 30 * MIN, 30 * MIN]);
});

test('스케줄러: 시작 즉시 실행하고 주기마다 반복, 수동 갱신 가능', async () => {
  let n = 0;
  const s = createScheduler({ a: { every: 30, run: async () => { n++; } } });
  s.start();
  await wait(80);
  assert.ok(n >= 2, `반복 실행 ${n}`);
  const before = n;
  s.refresh(['a']);
  await wait(5);
  assert.ok(n > before);
  s.stop();
});

test('스케줄러: 실패해도 멈추지 않고 백오프 간격으로 대기', async () => {
  let n = 0;
  const s = createScheduler({ a: { every: 10, run: async () => { n++; throw new Error('실패'); } } });
  s.start();
  await wait(60);
  assert.equal(n, 1);   // 다음 시도는 1분 뒤이므로 짧은 시간에는 한 번뿐
  s.stop();
});

test('스케줄러: noRetry 오류는 정상 주기로 다시 확인', async () => {
  let n = 0;
  const s = createScheduler({ a: { every: 20, run: async () => { n++; throw Object.assign(new Error('연결 필요'), { noRetry: true }); } } });
  s.start();
  await wait(90);
  assert.ok(n >= 2);
  s.stop();
});

// ----- 사람 여러 명(v1.4): 가짜 저장소·가짜 구글로 한 사람의 실패가 그 사람 것에만 영향 주는지 확인 -----
function fakeSync(people, google, cache = {}) {
  const settings = { people, location: {} };
  const saved = {};
  const store = { settings: () => settings, cache: () => cache, saveCache: (p) => Object.assign(saved, p), patch: () => settings };
  const data = {};
  const sync = createSync({ store, data, push: () => {}, google });
  return { sync, data, saved };
}
const P = (id, name, on = true) => ({ id, name, calendar: { on, ids: [] }, tasks: { on, listId: '' } });
const needAuth = () => Object.assign(new Error('x'), { code: 'needAuth' });

test('사람별 갱신: 한 사람이 실패해도 그 사람 것만 마지막 값을 유지하고 다른 사람은 갱신', async () => {
  let fail2 = false;
  const google = {
    fetchEvents: async (id) => { if (id === 'p2' && fail2) throw new Error('net'); return [{ title: id + '-' + Date.now() }]; },
    fetchTasks: async (id) => [id + '-메모'],
  };
  const { sync, data, saved } = fakeSync([P('p1', '민기'), P('p2', '지수')], google);
  sync.refresh(['calendar', 'tasks']); await wait(30);
  assert.equal(data.people.p1.sync.calendar.state, 'ok');
  const before = data.people.p2.events;
  assert.equal(before.length, 1);
  fail2 = true;
  sync.refresh(['calendar']); await wait(30);
  assert.equal(data.people.p2.sync.calendar.state, 'failed');
  assert.equal(data.people.p2.events, before);   // 마지막 값 유지
  assert.equal(data.people.p1.sync.calendar.state, 'ok');   // 다른 사람은 정상
  assert.deepEqual(data.people.p2.tasks, ['p2-메모']);
  assert.ok(saved.people.p1.eventsAt > 0 && saved.people.p2.events.length === 1);   // 캐시도 사람별
  sync.stop();
});

test('사람별 갱신: 연결 전인 사람은 연결 필요 상태, 캘린더를 끈 사람은 받지 않음, 옛 단일 캐시는 사람 1이 이어받음', async () => {
  const calls = [];
  const google = { fetchEvents: async (id) => { calls.push(id); if (id === 'p2') throw needAuth(); return []; }, fetchTasks: async () => [] };
  const { sync, data } = fakeSync([P('p1', '민기'), P('p2', '지수'), P('p3', '하늘', false)], google, { events: [{ title: '옛' }], eventsAt: 5, tasks: ['옛 메모'], tasksAt: 6 });
  assert.deepEqual([data.people.p1.events, data.people.p1.tasks], [[{ title: '옛' }], ['옛 메모']]);
  assert.deepEqual(data.people.p2.events, []);
  sync.refresh(['calendar']); await wait(30);
  assert.deepEqual(calls.sort(), ['p1', 'p2']);   // p3(꺼짐)은 요청하지 않음
  assert.equal(data.people.p2.sync.calendar.state, 'needAuth');
  sync.clearPerson('p2');
  assert.equal(data.people.p2.sync.calendar.state, 'needAuth');
  sync.clearPerson('p2', true);
  assert.equal(data.people.p2, undefined);
  sync.stop();
});
// 개정 기록 | 2026-11-12 | 사람 여러 명 | 사용자 결정: 사람별 갱신·실패 격리·옛 캐시 이어받기 시험

test('expired 콜백과 정상 주기, 사람별 격리 및 만료 상태 유지', async () => {
  const expired = [], delays = [];
  const people = [P('p1', 'P'), P('p2', 'Q')];
  const store = { settings: () => ({ people }), cache: () => ({}), saveCache: () => {} };
  const data = {};
  let phase = 0;
  const google = { fetchEvents: async (id) => { if (id === 'p1' || phase === 1) throw Object.assign(new Error('expired'), { code: phase === 2 ? 'needAuth' : 'expired' }); return ['fresh']; } };
  const sync = createSync({ store, data, push: () => {}, google, onExpired: (id) => { expired.push(id); people.find((p) => p.id === id).google = { expired: true }; } });
  const realSet = global.setTimeout, realClear = global.clearTimeout;
  global.setTimeout = (fn, ms) => { delays.push(ms); return 1; }; global.clearTimeout = () => {};
  const settle = async () => { for (let n=0;n<15;n++) await Promise.resolve(); };
  try {
    sync.refresh(['calendar']); await settle();
    assert.deepEqual(expired, ['p1']); assert.deepEqual(data.people.p2.events, ['fresh']);
    assert.equal(data.people.p1.sync.calendar.state, 'expired');
    phase = 1;
    sync.refresh(['calendar']); await settle(); sync.refresh(['calendar']); await settle();
    assert.ok(delays.every((n) => n === MIN), `정상 주기: ${delays}`);
    phase = 2; sync.refresh(['calendar']); await settle();
    assert.equal(data.people.p1.sync.calendar.state, 'expired');
  } finally { sync.stop(); global.setTimeout = realSet; global.clearTimeout = realClear; }
});
// 개정 기록 | 2026-11-16 | 만료 콜백·주기·사람별 격리 시험 | 사용자 요청
