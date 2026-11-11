const test = require('node:test');
const assert = require('node:assert/strict');
const { createScheduler, backoff } = require('../src/main/sync.js');

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
