const test = require('node:test');
const assert = require('node:assert/strict');
const { parse } = require('../src/renderer/timer-parse.js');

const ms = (s) => s * 1000;

test('설계서 §5 유효 입력', () => {
  const cases = { '1.3': 63, '1.35': 95, '1.03': 63, '10': 600, '0.3': 3, '1.6': 66, '5.': 300, '.5': 5, '999': 59940 };
  for (const [input, sec] of Object.entries(cases)) {
    const r = parse(input);
    assert.equal(r.ok, true, input);
    assert.equal(r.ms, ms(sec), input);
  }
});

test('안내 문구', () => {
  assert.equal(parse('1.35').hint, '1분 35초');
  assert.equal(parse('10').hint, '10분');
  assert.equal(parse('0.3').hint, '3초');
});

test('무효 입력', () => {
  for (const input of ['1.60', '1.61', '1.99', '0.001', '1.234', '0', '0.0', '0.00', '', '1000', '0001', 'abc', '1..2']) {
    assert.equal(parse(input).ok, false, `"${input}"`);
  }
  assert.equal(parse(undefined).ok, false);
  assert.equal(parse('12.').ok, true);
});
