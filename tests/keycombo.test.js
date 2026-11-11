const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCombo, formatCombo, comboFromEvent } = require('../src/renderer/keycombo.js');

test('수정키·주 키를 가상 키 코드로 해석(대소문자·순서 무관)', () => {
  const p = parseCombo('Ctrl+Alt+Shift+V');
  assert.deepEqual([p.mods, p.key], [[0x11, 0x12, 0x10], 0x56]);
  assert.deepEqual([parseCombo('shift+ctrl+v').mods, parseCombo('win+a').mods], [[0x11, 0x10], [0x5b]]);
  assert.equal(parseCombo('7').key, 0x37);
  assert.equal(parseCombo('f1').key, 0x70);
  assert.equal(parseCombo('F24').key, 0x87);
  for (const [t, vk] of [['Space', 0x20], ['Enter', 0x0d], ['Tab', 0x09], ['Esc', 0x1b]]) assert.equal(parseCombo(t.toLowerCase()).key, vk);
});

test('잘못된 조합은 null', () => {
  for (const bad of ['', '   ', 'Ctrl', 'Ctrl+Alt', 'A+B', 'Ctrl+Ctrl+A', 'Ctrl+Foo', 'F25', 'F0', 'Ctrl++A', 'Ctrl+', 'NumPad1', null, undefined, 5]) assert.equal(parseCombo(bad), null, String(bad));
});

test('표시 순서 Ctrl+Alt+Shift+Win+키로 정리, 잘못되면 빈 문자열', () => {
  assert.equal(formatCombo('v + shift+ALT+ctrl'), 'Ctrl+Alt+Shift+V');
  assert.equal(formatCombo('win+shift+f5'), 'Shift+Win+F5');
  assert.equal(formatCombo('esc'), 'Esc');
  assert.equal(formatCombo('Ctrl'), '');
});

test('keydown 이벤트에서 조합 만들기: 수정키만·지원 밖 키는 null', () => {
  const ev = (code, m = {}) => ({ code, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...m });
  assert.equal(comboFromEvent(ev('KeyV', { ctrlKey: true, altKey: true, shiftKey: true })), 'Ctrl+Alt+Shift+V');
  assert.equal(comboFromEvent(ev('Digit7', { metaKey: true })), 'Win+7');
  assert.equal(comboFromEvent(ev('F12')), 'F12');
  assert.equal(comboFromEvent(ev('Space', { ctrlKey: true })), 'Ctrl+Space');
  for (const c of ['ControlLeft', 'ShiftRight', 'Numpad1', 'ArrowUp', 'Backspace', '']) assert.equal(comboFromEvent(ev(c)), null, c);
});
