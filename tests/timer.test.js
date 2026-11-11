const test = require('node:test');
const assert = require('node:assert/strict');
const { createTimer } = require('../src/main/timer.js');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('마감 시각이 되면 울림 상태로 바뀌고 알림 콜백 호출', async () => {
  let finished = 0;
  const t = createTimer({ onChange: () => {}, onFinish: () => finished++ });
  t.start(40);
  assert.equal(t.snapshot().phase, 'running');
  await wait(120);
  assert.equal(t.snapshot().phase, 'ringing');
  assert.equal(finished, 1);
  t.cancel();
  assert.equal(t.snapshot().phase, 'idle');
});

test('일시정지는 남은 시간을 보관하고 재개하면 이어서 감', async () => {
  let finished = 0;
  const t = createTimer({ onChange: () => {}, onFinish: () => finished++ });
  t.start(200);
  await wait(50);
  t.pause();
  const left = t.snapshot().remainingMs;
  assert.ok(left > 0 && left < 200);
  await wait(250);
  assert.equal(finished, 0);   // 정지 중에는 울리지 않음
  t.resume();
  assert.equal(t.snapshot().phase, 'running');
  t.cancel();
});
