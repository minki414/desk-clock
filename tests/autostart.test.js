const test = require('node:test');
const assert = require('node:assert/strict');
const { pickPath, apply } = require('../src/main/autostart.js');

const yes = () => true, no = () => false;

test('installed path and portable migration retain one registration name', () => {
  assert.equal(pickPath({}, yes, { isPackaged: true }, 'installed.exe'), 'installed.exe');
  assert.equal(pickPath({}, yes, { isPackaged: false }, 'electron.exe'), null);
  const rows = new Map();
  const app = { isPackaged: true, setLoginItemSettings: o => rows.set(o.name, o.path) };
  apply(app, true, { PORTABLE_EXECUTABLE_FILE: 'portable.exe' }, yes);
  apply(app, true, {}, yes);
  assert.equal(rows.size, 1); assert.equal(rows.get('DeskClock'), process.execPath);
});

test('portable 환경 변수가 있고 파일이 있으면 그 경로를 씀', () => {
  assert.equal(pickPath({ PORTABLE_EXECUTABLE_FILE: 'D:\clock\DeskClock.exe' }, yes), 'D:\clock\DeskClock.exe');
});

test('환경 변수가 없거나 비어 있으면 null(개발 실행)', () => {
  assert.equal(pickPath({}, yes), null);
  assert.equal(pickPath({ PORTABLE_EXECUTABLE_FILE: '  ' }, yes), null);
});

test('파일이 사라졌으면 null', () => {
  assert.equal(pickPath({ PORTABLE_EXECUTABLE_FILE: 'D:\gone.exe' }, no), null);
});

test('임시 폴더의 execPath가 아니라 원래 exe를 등록하고, 등록 불가면 호출하지 않음', () => {
  const calls = [];
  const app = { setLoginItemSettings: (o) => calls.push(o) };
  assert.equal(apply(app, true, { PORTABLE_EXECUTABLE_FILE: 'D:\clock\DeskClock.exe' }, yes), true);
  assert.deepEqual(calls[0], { openAtLogin: true, path: 'D:\clock\DeskClock.exe', name: 'DeskClock' });
  assert.equal(apply(app, false, { PORTABLE_EXECUTABLE_FILE: 'D:\clock\DeskClock.exe' }, yes), true);
  assert.equal(calls[1].openAtLogin, false);
  assert.equal(apply(app, true, {}, yes), false);
  assert.equal(calls.length, 2);
});
// 개정 기록 | 2026-11-17 | 설치형 경로 및 동일 이름 이관 시험 | 사용자 요청
