const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const I = require('../src/renderer/i18n.js');
const M = require('../src/renderer/model.js');

// 2026-11-11(수) 오전 10:09 — 합성 시각
const D = new Date(2026, 10, 11, 10, 9, 32);

test('사전 키: ko·zh·en 세 언어의 키 집합이 같고 값이 비어 있지 않음', () => {
  const ko = Object.keys(I.dict.ko).sort();
  for (const lang of ['zh', 'en']) {
    assert.deepEqual(Object.keys(I.dict[lang]).sort(), ko, `${lang} 키 불일치`);
    assert.ok(Object.values(I.dict[lang]).every((v) => typeof v === 'string' && v !== ''), `${lang} 빈 값`);
  }
  // {변수} 자리표시자도 세 언어가 같아야 함
  const vars = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
  for (const k of ko) for (const lang of ['zh', 'en']) assert.equal(vars(I.dict[lang][k]), vars(I.dict.ko[k]), `${lang} ${k}`);
});

test('언어 선택지는 각자 자기 언어 이름, 모르는 언어는 ko', () => {
  assert.deepEqual(I.langs, [['ko', '한국어'], ['zh', '中文'], ['en', 'English']]);
  assert.equal(I.norm('fr'), 'ko');
  assert.equal(I.norm(undefined), 'ko');
  assert.deepEqual(['ko', 'zh', 'en'].map(I.htmlLang), ['ko', 'zh-CN', 'en']);
  assert.equal(I.t('fr', 'stage.today'), '오늘');
  assert.equal(I.t('en', 'no.such.key'), 'no.such.key');
});

test('t(): 자리표시자 치환', () => {
  assert.equal(I.t('ko', 'stage.more', { n: 3 }), '외 3건');
  assert.equal(I.t('zh', 'stage.more', { n: 3 }), '另有 3 项');
  assert.equal(I.t('en', 'stage.more', { n: 3 }), '+3 more');
  assert.equal(I.t('en', 'toast.empty', { n: 4 }), 'Slot 4: not set');
});

test('날짜: 긴·짧은·월일·요일 형식(시안의 모양)', () => {
  const f = (lang) => ['long', 'short', 'monthDay', 'month', 'dow', 'dowShort', 'num'].map((k) => I.fmtDate(lang, D, k));
  assert.deepEqual(f('ko'), ['11월 11일 수요일', '11.11 수', '11월 11일', '11월', '수요일', '수', '11.11']);
  assert.deepEqual(f('zh'), ['11月11日 星期三', '11.11 周三', '11月11日', '11月', '星期三', '周三', '11.11']);
  assert.deepEqual(f('en'), ['Wednesday, November 11', 'Wed 11.11', 'November 11', 'November', 'Wednesday', 'Wed', '11.11']);
  // 한 자리 월·일은 0을 붙이지 않음
  assert.equal(I.fmtDate('ko', new Date(2026, 2, 5), 'short'), '3.5 목');
  assert.equal(I.fmtDate('en', new Date(2026, 2, 5), 'long'), 'Thursday, March 5');
});

test('타이머 안내: 분·초 형식(0인 단위 생략)', () => {
  assert.deepEqual(['ko', 'zh', 'en'].map((l) => I.fmtDuration(l, { m: 1, s: 35 })), ['1분 35초', '1分35秒', '1 min 35 s']);
  assert.deepEqual(['ko', 'zh', 'en'].map((l) => I.fmtDuration(l, { m: 10, s: 0 })), ['10분', '10分', '10 min']);
  assert.deepEqual(['ko', 'zh', 'en'].map((l) => I.fmtDuration(l, { m: 0, s: 3 })), ['3초', '3秒', '3 s']);
  assert.equal(I.fmtDuration('en', 95000), '1 min 35 s');   // 밀리초도 받음
  assert.equal(I.fmtDuration('ko', 0), '');
});

test('날씨 이름: WMO 코드 → 각 언어, 모르는 코드는 정보 없음, 아이콘은 언어와 무관', () => {
  const row = (code) => ['ko', 'zh', 'en'].map((l) => I.weatherLabel(l, code));
  assert.deepEqual(row(0), ['맑음', '晴', 'Clear']);
  assert.deepEqual(row(3), ['흐림', '阴', 'Overcast']);
  assert.deepEqual(row(63), ['비', '中雨', 'Rain']);
  assert.deepEqual(row(73), ['눈', '中雪', 'Snow']);
  assert.deepEqual(row(95), ['뇌우', '雷暴', 'Thunderstorm']);
  assert.deepEqual(row(12345), ['정보 없음', '暂无数据', 'No data']);
  // 같은 이름을 쓰던 코드는 계속 같은 이름
  assert.equal(I.weatherLabel('ko', 48), I.weatherLabel('ko', 45));
  assert.deepEqual([0, 1, 2, 45, 61, 73, 80, 95, 999].map(I.weatherIcon), ['sun', 'sun', 'cloud', 'fog', 'rain', 'snow', 'rain', 'cloud', 'cloud']);
  // 코드로 정해지는 모든 이름이 세 언어 사전에 있음
  for (const code of [0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99]) {
    for (const l of ['ko', 'zh', 'en']) assert.notEqual(I.weatherLabel(l, code), I.weatherLabel(l, 12345), `${l} ${code}`);
  }
});

test('상태 문구: 세 언어', () => {
  const t = new Date(2026, 10, 11, 19, 20).getTime();
  const row = (kind, st) => ['ko', 'zh', 'en'].map((l) => I.statusText(l, kind, st));
  assert.deepEqual(row('calendar', { state: 'ok' }), [null, null, null]);
  assert.deepEqual(row('calendar', { state: 'needAuth' }), ['캘린더 연결 필요', '需要连接日历', 'Calendar not connected']);
  assert.deepEqual(row('calendar', { state: 'failed', at: t }), ['일정 갱신 실패 · 19:20 기준', '日程更新失败 · 截至 19:20', 'Events update failed · 19:20']);
  assert.deepEqual(row('weather', { state: 'failed' }), ['날씨 갱신 실패', '天气更新失败', 'Weather update failed']);
});

test('모델 조립(buildModel): 언어별로 이미 형식화된 문자열을 만듦', () => {
  const o = (lang) => ({
    lang, now: D, mode: 'light', weather: { place: 'P', tempC: 8, code: 3, hiC: 12, loC: 3, umbrella: false, mask: false },
    events: [{ title: '', location: '', allDay: true, holiday: false, start: new Date(2026, 10, 11).getTime(), end: new Date(2026, 10, 12).getTime() }],
    tasks: ['a', 'b', 'c', 'd', 'e'], slots: [{ key: 1, name: 'X', target: 'y' }],
    timer: { phase: 'input', input: '1.35', invalidAt: 0, remainingMs: 0, totalMs: 0 }, hotkeysOn: true, sync: { calendar: { state: 'needAuth' } },
  });
  const ko = M.buildModel(o('ko')), zh = M.buildModel(o('zh')), en = M.buildModel(o('en'));
  assert.deepEqual([ko.dateLong, zh.dateLong, en.dateLong], ['11월 11일 수요일', '11月11日 星期三', 'Wednesday, November 11']);
  assert.deepEqual([ko.timer.hint, zh.timer.hint, en.timer.hint], ['1분 35초', '1分35秒', '1 min 35 s']);
  assert.deepEqual([ko.weather.label, zh.weather.label, en.weather.label], ['흐림', '阴', 'Overcast']);
  assert.equal(en.weather.icon, 'cloud');
  assert.deepEqual([ko.L.memoMore, zh.L.memoMore, en.L.memoMore], ['외 1건', '另有 1 项', '+1 more']);
  assert.deepEqual([ko.today[0].time, zh.today[0].time, en.today[0].time], ['종일', '全天', 'All day']);
  assert.deepEqual([ko.today[0].title, zh.today[0].title, en.today[0].title], ['(제목 없음)', '（无标题）', '(Untitled)']);   // 빈 제목
  assert.deepEqual([ko.week[0].dow, zh.week[0].dow, en.week[0].dow], ['목', '周四', 'Thu']);
  assert.deepEqual(en.legend.map((l) => l.name), ['X', 'Clock', 'Timer']);
  assert.deepEqual(zh.legend.map((l) => l.name), ['X', '时钟', '计时器']);
  assert.equal(en.status.calendar, 'Calendar not connected');
  assert.equal(en.lang, 'en');
  // 일시정지·울림 안내도 모델이 만듦
  const paused = M.buildModel({ ...o('en'), timer: { phase: 'paused', input: '', invalidAt: 0, remainingMs: 1000, totalMs: 2000 } });
  assert.equal(paused.timer.hint, 'Paused');
  const ring = M.buildModel({ ...o('zh'), timer: { phase: 'ringing', input: '', invalidAt: 0, remainingMs: 0, totalMs: 2000 } });
  assert.equal(ring.timer.hint, '时间到');
  assert.equal(M.buildModel({ ...o('ko'), weather: null }).weather, null);
});

test('src 안의 한글은 사전(ko)·주석·개정 기록·기본 슬롯 이름에만 남음', () => {
  const root = path.join(__dirname, '..', 'src');
  const hits = [];
  let block = false;
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) return walk(p);
    if (!/\.(js|html|css)$/.test(e.name) || e.name === 'i18n.js') return;   // 사전 파일(i18n.js)은 ko 문구가 있어 제외
    fs.readFileSync(p, 'utf8').split('\n').forEach((raw, i) => {
      let line = raw.trimEnd();   // CRLF 줄 끝 정리
      if (block) { if (!line.includes('*/')) return; block = false; line = line.slice(line.indexOf('*/') + 2); }   // 여러 줄 /* */ 주석 안
      if (/\/\*(?!.*\*\/)/.test(line)) { block = true; line = line.slice(0, line.indexOf('/*')); }
      if (!/[가-힣]/.test(line) || /name: '유튜브'/.test(line)) return;   // 기본 슬롯 1번 이름은 사용자 자료(번역 대상 아님)
      const code = line.replace(/\/\*.*?\*\//g, '').replace(/^\s*\/\/.*$/, '').replace(/\s\/\/.*$/, '');   // 주석 제거
      if (/[가-힣]/.test(code)) hits.push(`${path.relative(root, p)}:${i + 1}`);
    });
  });
  walk(root);
  assert.deepEqual(hits, []);
});
