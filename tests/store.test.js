const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createStore } = require('../src/main/store.js');

function tmpDir() {
  const base = path.join(__dirname, '..', '.tmp');
  fs.mkdirSync(base, { recursive: true });
  return fs.mkdtempSync(path.join(base, 'store-'));
}

test('기본값: 바우하우스·라이트 모드·슬롯 1·2만 등록', () => {
  const dir = tmpDir();
  try {
    const s = createStore(dir).settings();
    assert.equal(s.theme, 'bauhaus');
    assert.equal(s.mode, 'light');
    assert.equal(s.hotkeysOn, true);
    assert.equal(s.slots.length, 9);
    assert.deepEqual([s.slots[0].name, s.slots[0].target], ['유튜브', 'https://www.youtube.com']);
    assert.deepEqual([s.slots[1].name, s.slots[1].target], ['LP Lounge', 'http://127.0.0.1:4320/']);
    assert.ok(s.slots.slice(2).every((x) => x.target === ''));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('저장은 원자적이고 다시 열면 그대로 읽힘, 객체는 한 단계 병합', () => {
  const dir = tmpDir();
  try {
    const st = createStore(dir);
    st.patch({ theme: 'flip', location: { mode: 'manual', name: '마포', lat: 1, lon: 2 } });
    st.patch({ location: { name: '서초' } });
    assert.ok(!fs.existsSync(path.join(dir, 'settings.json.tmp')));
    const again = createStore(dir).settings();
    assert.equal(again.theme, 'flip');
    assert.deepEqual(again.location, { mode: 'manual', name: '서초', lat: 1, lon: 2 });
    st.patch({ 모르는키: 1 });
    assert.equal(createStore(dir).settings().모르는키, undefined);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('옛 설정 파일에 새 항목이 없어도 기본값으로 채움, 깨진 파일은 기본값', () => {
  const dir = tmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ theme: 'navy', slots: [{ key: 3, name: '뉴스', target: 'https://x.y' }] }));
    const s = createStore(dir).settings();
    assert.equal(s.theme, 'navy');
    assert.equal(s.nightStart, '19:00');
    assert.equal(s.slots[2].name, '뉴스');
    assert.equal(s.slots[0].name, '유튜브');
    fs.writeFileSync(path.join(dir, 'settings.json'), '{깨짐');
    assert.equal(createStore(dir).settings().theme, 'bauhaus');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('캐시 저장', () => {
  const dir = tmpDir();
  try {
    const st = createStore(dir);
    st.saveCache({ tasks: ['a'] });
    st.saveCache({ eventsAt: 5 });
    assert.deepEqual(createStore(dir).cache(), { tasks: ['a'], eventsAt: 5 });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('야간 감광 꺼짐·색 모드 라이트: 새 설정 기본값, 옛 설정(버전 없음/1)은 한 번만 이관하고 저장', () => {
  const dir = tmpDir();
  try {
    assert.equal(createStore(dir).settings().nightDim, false);
    assert.equal(createStore(dir).settings().mode, 'light');
    const file = path.join(dir, 'settings.json');
    fs.writeFileSync(file, JSON.stringify({ nightDim: true, mode: 'auto', theme: 'flip', dim: { active: true, mode: 'wmi', original: 40 } }));
    const s = createStore(dir).settings();
    assert.equal(s.nightDim, false);
    assert.equal(s.mode, 'light');
    assert.equal(s.settingsVersion, 2);
    assert.equal(s.theme, 'flip');
    assert.equal(s.dim.active, true);   // 복구는 dimmer.tick()이 기존 경로로 수행
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).nightDim, false);
    // 이관 뒤 사용자가 다시 켜면 유지
    const st = createStore(dir); st.patch({ nightDim: true, mode: 'auto' });
    assert.equal(createStore(dir).settings().nightDim, true);
    assert.equal(createStore(dir).settings().mode, 'auto');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('슬롯 sendKeys: 기본은 빈 값, 옛 설정(필드 없음)도 빈 값으로 동작하고 저장값은 유지', () => {
  const dir = tmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ settingsVersion: 2, slots: [{ key: 7, name: 'x', kind: 'program', target: 'a.exe' }, { key: 8, sendKeys: 'Ctrl+Alt+Shift+V' }] }));
    const slots = createStore(dir).settings().slots;
    assert.equal(slots[6].sendKeys, '');
    assert.equal(slots[6].target, 'a.exe');
    assert.equal(slots[7].sendKeys, 'Ctrl+Alt+Shift+V');
    assert.ok(slots.every((x) => typeof x.sendKeys === 'string'));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
