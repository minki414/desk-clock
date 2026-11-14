const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createStore, normPeople, newPerson, MAX_PEOPLE } = require('../src/main/store.js');

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
    assert.deepEqual(again.location, { mode: 'manual', name: '서초', lat: 1, lon: 2, id: null });
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
    assert.equal(s.settingsVersion, 3);   // 이어서 사람 목록 이관(v3)까지 한 번에
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

test('슬롯 returnToClock: 기본·옛 설정(필드 없음)은 false, 저장값은 유지', () => {
  const dir = tmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ settingsVersion: 2, slots: [{ key: 7, name: 'x', kind: 'program', target: 'a.exe' }, { key: 8, returnToClock: true }] }));
    const slots = createStore(dir).settings().slots;
    assert.equal(slots[6].returnToClock, false);
    assert.equal(slots[7].returnToClock, true);
    assert.ok(slots.every((x, i) => i === 7 || x.returnToClock === false));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
// 개정 기록 | 2026-11-11 | 실행 후 시계로 돌아오기 | 사용자 요청

test('언어(lang): 기본 ko, 옛 설정(필드 없음)도 ko, 저장값 유지, 지원하지 않는 값은 무시', () => {
  const dir = tmpDir();
  try {
    assert.equal(createStore(dir).settings().lang, 'ko');
    fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ theme: 'flip', settingsVersion: 2 }));
    const st = createStore(dir);
    assert.equal(st.settings().lang, 'ko');
    assert.equal(st.patch({ lang: 'zh' }).lang, 'zh');
    assert.equal(st.patch({ lang: 'fr' }).lang, 'zh');   // 알 수 없는 언어는 무시
    assert.equal(createStore(dir).settings().lang, 'zh');   // 다시 열어도 유지
    fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ lang: 'xx', settingsVersion: 2 }));
    assert.equal(createStore(dir).settings().lang, 'ko');   // 깨진 저장값은 ko
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ----- 사람 여러 명(v1.4) -----
test('이관: 단일 구글 연결·캘린더 선택·메모 목록 → 사람 1(현재 언어의 기본 이름), 옛 설정은 .v2.bak 으로 남김', () => {
  const dir = tmpDir();
  try {
    const file = path.join(dir, 'settings.json');
    const old = { settingsVersion: 2, lang: 'en', theme: 'navy', google: { hasClient: true, connected: true, calendarIds: ['primary', 'fam@group'], taskListId: 'L1' } };
    fs.writeFileSync(file, JSON.stringify(old));
    const s = createStore(dir).settings();
    assert.equal(s.settingsVersion, 3);
    assert.equal(s.theme, 'navy');
    assert.deepEqual(s.google, { hasClient: true });   // 연결·목록은 사람별로 옮김
    assert.equal(s.people.length, 1);
    assert.deepEqual(s.people[0], { id: 'p1', name: 'User 1', google: { connected: true }, calendar: { on: true, ids: ['primary', 'fam@group'] }, tasks: { on: true, listId: 'L1' } });
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).settingsVersion, 3);   // 저장됨
    assert.deepEqual(JSON.parse(fs.readFileSync(file + '.v2.bak', 'utf8')), old);   // 되돌릴 사본
    assert.deepEqual(createStore(dir).settings().people, s.people);   // 다시 열어도 그대로
    fs.writeFileSync(file, JSON.stringify({ settingsVersion: 2, google: {} }));
    assert.equal(createStore(dir).settings().people[0].name, '사용자 1');
    fs.writeFileSync(file, JSON.stringify({ settingsVersion: 2, lang: 'zh' }));
    assert.equal(createStore(dir).settings().people[0].name, '用户1');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('새 설정: 사람 1명(캘린더·메모 켬), 사람 목록 정리(최대 4명·id 유일·빈 이름은 기본 이름)', () => {
  const dir = tmpDir();
  try {
    const st = createStore(dir);
    assert.equal(st.settings().people.length, 1);
    assert.equal(st.settings().people[0].calendar.on, true);
    assert.equal(st.settings().people[0].tasks.on, true);
    assert.ok(!fs.existsSync(path.join(dir, 'settings.json.v2.bak')));   // 새 설치는 이관·백업 없음
    const many = [1, 2, 3, 4, 5, 6].map((n) => ({ id: 'p1', name: n === 2 ? '   ' : '아주아주아주아주아주아주아주 긴 이름입니다 넘칩니다' + n }));
    const out = normPeople(many, 'ko');
    assert.equal(out.length, MAX_PEOPLE);
    assert.equal(new Set(out.map((p) => p.id)).size, 4);   // 같은 id 는 새 id 로
    assert.equal(out[1].name, '사용자 2');
    assert.ok(out[0].name.length <= 20);
    assert.equal(normPeople([], 'en')[0].name, 'User 1');   // 비면 한 명을 되살림
    assert.equal(normPeople([{ id: '../x', name: 'a' }], 'ko')[0].id, 'p1');   // 이상한 id 는 쓰지 않음
    // patch: people 은 배열째 바뀌고 정리됨
    st.patch({ people: [{ id: 'p1', name: '민기', calendar: { on: false, ids: [] } }, { id: 'p2', name: '지수' }] });
    const again = createStore(dir).settings().people;
    assert.deepEqual(again.map((p) => [p.id, p.name, p.calendar.on]), [['p1', '민기', false], ['p2', '지수', false]]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('새 사람: 쓰이지 않은 id·기본 이름 번호, 캘린더·메모는 꺼짐으로 시작', () => {
  const people = normPeople([{ id: 'p1', name: '사용자 1' }, { id: 'p3', name: '사용자 3' }], 'ko');
  const p = newPerson(people, 'ko');
  assert.equal(p.id, 'p2');
  assert.equal(p.name, '사용자 2');
  assert.deepEqual([p.calendar.on, p.tasks.on, p.google.connected], [false, false, false]);
  assert.equal(newPerson(people, 'en').name, 'User 1');   // 이름 번호는 같은 언어 기본 이름끼리만 겹침 검사
});
// 개정 기록 | 2026-11-12 | 사람 여러 명 | 사용자 결정: 설정 이관(v3)·사람 목록 정리 시험
