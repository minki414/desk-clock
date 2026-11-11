const test = require('node:test');
const assert = require('node:assert/strict');
const { parseRegDefault, isWebUrl, launchSlot } = require('../src/main/launcher.js');

test('reg 출력에서 기본값 경로 추출', () => {
  const exe = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';
  const out = `\r\nHKEY_LOCAL_MACHINE\\SOFTWARE\\App Paths\\brave.exe\r\n    (기본값)    REG_SZ    ${exe}\r\n`;
  assert.equal(parseRegDefault(out), exe);
  assert.equal(parseRegDefault(`(기본값)    REG_SZ    "${exe}"`), exe);
  assert.equal(parseRegDefault('오류'), null);
});

test('웹 주소만 허용', () => {
  assert.equal(isWebUrl('https://www.youtube.com'), true);
  assert.equal(isWebUrl('http://127.0.0.1:4320/'), true);
  assert.equal(isWebUrl('file:///C:/x'), false);
  assert.equal(isWebUrl('javascript:alert(1)'), false);
});

test('빈 슬롯·잘못된 주소는 실행하지 않고 사유를 돌려줌', async () => {
  const shell = { openPath: async () => 'err', openExternal: async () => { throw new Error('x'); } };
  assert.deepEqual(await launchSlot({ target: '' }, 'brave', shell), { ok: false, reason: 'empty' });
  assert.deepEqual(await launchSlot({ kind: 'web', target: 'ftp://x' }, 'brave', shell), { ok: false, reason: 'fail' });
  assert.deepEqual(await launchSlot({ kind: 'program', target: 'C:/없음.exe' }, 'brave', shell), { ok: false, reason: 'fail' });
  assert.deepEqual(await launchSlot({ kind: 'web', target: 'https://a.b' }, 'default', shell), { ok: false, reason: 'fail' });
});
