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

test('기본값: 바우하우스·자동 모드·슬롯 1·2만 등록', () => {
  const dir = tmpDir();
  try {
    const s = createStore(dir).settings();
    assert.equal(s.theme, 'bauhaus');
    assert.equal(s.mode, 'auto');
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
