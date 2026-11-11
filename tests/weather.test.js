const test = require('node:test');
const assert = require('node:assert/strict');
const { needUmbrella, needMask } = require('../src/main/weather.js');

const day = (prefix, hours) => hours.map((h) => `${prefix}T${String(h).padStart(2, '0')}:00`);
const hrs = Array.from({ length: 24 }, (_, i) => i);
const times = [...day('2026-11-11', hrs), ...day('2026-11-12', hrs)];
const zeros = () => times.map(() => 0);

test('우산: 강수확률 60% 이상', () => {
  const base = { times, precip: zeros(), nowStr: '2026-11-11T16:30' };
  assert.equal(needUmbrella({ ...base, probMax: 59 }), false);
  assert.equal(needUmbrella({ ...base, probMax: 60 }), true);
  assert.equal(needUmbrella({ ...base, probMax: null }), false);
});

test('우산: 지금부터 오늘 끝까지 강수량 1mm 이상(지난 시간·내일은 제외)', () => {
  const p = zeros();
  p[10] = 5;               // 오늘 오전(이미 지남)
  p[30] = 5;               // 내일
  assert.equal(needUmbrella({ probMax: 0, times, precip: p, nowStr: '2026-11-11T16:30' }), false);
  p[18] = 0.6; p[20] = 0.4;
  assert.equal(needUmbrella({ probMax: 0, times, precip: p, nowStr: '2026-11-11T16:30' }), true);   // 합 1.0
  p[20] = 0.3;
  assert.equal(needUmbrella({ probMax: 0, times, precip: p, nowStr: '2026-11-11T16:30' }), false);
});

test('마스크: 앞으로 12시간 PM10 81 / PM2.5 36 이상', () => {
  const nowStr = '2026-11-11T16:30';
  const a = () => times.map(() => 10);
  const ok = { times, pm10: a(), pm25: a(), nowStr };
  assert.equal(needMask(ok), false);

  const p10 = a(); p10[20] = 80;
  assert.equal(needMask({ ...ok, pm10: p10 }), false);
  p10[20] = 81;
  assert.equal(needMask({ ...ok, pm10: p10 }), true);

  const p25 = a(); p25[27] = 35;   // 16시 기준 12시간 안(16~27시)
  assert.equal(needMask({ ...ok, pm25: p25 }), false);
  p25[27] = 36;
  assert.equal(needMask({ ...ok, pm25: p25 }), true);
  p25[27] = 10; p25[28] = 99;      // 12시간 밖
  assert.equal(needMask({ ...ok, pm25: p25 }), false);

  const nulls = times.map(() => null);
  assert.equal(needMask({ ...ok, pm10: nulls, pm25: nulls }), false);
});
