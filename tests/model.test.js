const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/renderer/model.js');
const I = require('../src/renderer/i18n.js');

// 2026-11-11(수) 14:00 기준 합성 자료. 실제 일정이 아님.
const at = (d, h, m = 0) => new Date(2026, 10, d, h, m).getTime();
const NOW = new Date(2026, 10, 11, 14, 0);
const ev = (o) => ({ allDay: false, location: '', holiday: false, ...o });

test('야간 구간: 자정을 넘기는 19:00~07:00', () => {
  const s = { nightStart: '19:00', nightEnd: '07:00', mode: 'auto' };
  const at2 = (h, m) => new Date(2026, 10, 11, h, m);
  assert.equal(M.isNight(at2(18, 59), s), false);
  assert.equal(M.isNight(at2(19, 0), s), true);
  assert.equal(M.isNight(at2(3, 0), s), true);
  assert.equal(M.isNight(at2(6, 59), s), true);
  assert.equal(M.isNight(at2(7, 0), s), false);
  assert.equal(M.isNight(at2(12, 0), { ...s, nightStart: '07:00', nightEnd: '07:00' }), false);
});

test('모드: 수동은 그대로, 자동은 야간이면 다크', () => {
  const s = { nightStart: '19:00', nightEnd: '07:00' };
  assert.equal(M.effectiveMode(new Date(2026, 10, 11, 23, 0), { ...s, mode: 'light' }), 'light');
  assert.equal(M.effectiveMode(new Date(2026, 10, 11, 12, 0), { ...s, mode: 'dark' }), 'dark');
  assert.equal(M.effectiveMode(new Date(2026, 10, 11, 23, 0), { ...s, mode: 'auto' }), 'dark');
  assert.equal(M.effectiveMode(new Date(2026, 10, 11, 12, 0), { ...s, mode: 'auto' }), 'light');
});

test('오늘 일정: 상태 past/now/next/later와 정렬', () => {
  const events = [
    ev({ title: '저녁 약속', start: at(11, 19), end: at(11, 21) }),
    ev({ title: '회의', start: at(11, 13), end: at(11, 15), location: '3층' }),
    ev({ title: '아침 운동', start: at(11, 7), end: at(11, 8) }),
    ev({ title: '병원', start: at(11, 16), end: at(11, 17) }),
    ev({ title: '생일', allDay: true, start: at(11, 0), end: at(12, 0) }),
    ev({ title: '내일 일정', start: at(12, 9), end: at(12, 10) }),
  ];
  const { today, todayMore } = M.buildToday(events, NOW, 10);
  assert.deepEqual(today.map((e) => e.title), ['생일', '아침 운동', '회의', '병원', '저녁 약속']);
  assert.deepEqual(today.map((e) => e.state), ['later', 'past', 'now', 'next', 'later']);
  assert.deepEqual(today.map((e) => e.time), ['종일', '07:00', '13:00', '16:00', '19:00']);
  assert.equal(today[2].location, '3층');
  assert.equal(todayMore, 0);
});

test('오늘 일정: 최대 4건, 넘치면 지난 일정부터 덜고 나머지는 외 n건', () => {
  const events = [7, 8, 9, 15, 16, 17].map((h) => ev({ title: `${h}시`, start: at(11, h), end: at(11, h) + 3600000 }));
  const { today, todayMore } = M.buildToday(events, NOW);
  assert.equal(today.length, 4);
  assert.deepEqual(today.map((e) => e.title), ['9시', '15시', '16시', '17시']);
  assert.equal(todayMore, 2);
  // 모두 앞으로 일이면 뒤에서 자름
  const later = [15, 16, 17, 18, 19].map((h) => ev({ title: `${h}시`, start: at(11, h), end: at(11, h) + 3600000 }));
  const r = M.buildToday(later, NOW);
  assert.deepEqual(r.today.map((e) => e.title), ['15시', '16시', '17시', '18시']);
  assert.equal(r.todayMore, 1);
});

test('오늘 일정: 여러 날에 걸친 종일 일정과 자정 경계', () => {
  const events = [
    ev({ title: '출장', allDay: true, start: at(10, 0), end: at(13, 0) }),             // 10~12일
    ev({ title: '어제 종일', allDay: true, start: at(10, 0), end: at(11, 0) }),          // 끝이 오늘 0시(제외)
    ev({ title: '내일 0시', start: at(12, 0), end: at(12, 1) }),
  ];
  const { today } = M.buildToday(events, NOW);
  assert.deepEqual(today.map((e) => e.title), ['출장']);
});

test('주간: 내일부터 7칸, 첫 일정·개수·일요일·공휴일', () => {
  const events = [
    ev({ title: '수영', start: at(12, 7), end: at(12, 8) }),
    ev({ title: '치과', start: at(12, 15), end: at(12, 16) }),
    ev({ title: '연차', allDay: true, start: at(13, 0), end: at(14, 0) }),
    ev({ title: '건국기념일', allDay: true, holiday: true, start: at(15, 0), end: at(16, 0) }),   // 일요일(11/15)
    ev({ title: '모임', start: at(18, 20), end: at(18, 22) }),
    ev({ title: '범위 밖', start: at(19, 9), end: at(19, 10) }),
  ];
  const week = M.buildWeek(events, NOW);
  assert.equal(week.length, 7);
  assert.deepEqual(week.map((c) => c.dow), ['목', '금', '토', '일', '월', '화', '수']);
  assert.deepEqual(week[0], { dow: '목', isSunday: false, isHoliday: false, first: '수영', count: 2, tip: '수영 외 1건' });
  assert.equal(week[1].tip, '연차');   // 하나뿐이면 제목만
  assert.equal(week[1].first, '연차');
  assert.equal(week[3].isSunday, true);
  assert.equal(week[3].isHoliday, true);
  assert.equal(week[3].first, null);   // 공휴일 자체는 일정 개수에 넣지 않음
  assert.equal(week[3].count, 0);
  assert.equal(week[6].first, '모임');
  assert.equal(week[2].count, 0);
});

test('범례: 등록된 슬롯만, 0 시계·T 타이머는 항상', () => {
  const slots = [{ key: 1, name: '유튜브', target: 'https://y' }, { key: 2, name: '', target: '' }, { key: 3, name: 'LP', target: 'http://l' }];
  assert.deepEqual(M.buildLegend(slots), [{ key: '1', name: '유튜브' }, { key: '3', name: 'LP' }, { key: '0', name: '시계' }, { key: 'T', name: '타이머' }]);
});

test('상태 문구: 명사형, 마지막 성공 시각 표시', () => {
  const t = new Date(2026, 10, 11, 19, 20).getTime();
  const S = (kind, st) => I.statusText('ko', kind, st);
  assert.equal(S('calendar', { state: 'ok', at: t }), null);
  assert.equal(S('calendar', { state: 'pending' }), null);
  assert.equal(S('calendar', { state: 'needAuth' }), '캘린더 연결 필요');
  assert.equal(S('tasks', { state: 'needAuth' }), null);
  assert.equal(S('calendar', { state: 'tokenUnavailable' }), '토큰 보관 불가');
  assert.equal(S('calendar', { state: 'failed', at: t }), '일정 갱신 실패 · 19:20 기준');
  assert.equal(S('tasks', { state: 'failed' }), '메모 갱신 실패');
  assert.equal(S('weather', { state: 'failed', at: t }), '날씨 갱신 실패 · 19:20 기준');
});

// ----- 사람 여러 명(v1.4) -----
const person = (id, name, o = {}) => ({ id, name, calendarOn: true, tasksOn: true, events: [], memos: [], sync: {}, ...o });

test('일정 합치기: 시작 시각과 앞뒤 공백 뺀 제목이 완전히 같으면 한 번만(같은 사람의 여러 캘린더에서 겹쳐도)', () => {
  const a = person('p1', '민기', { events: [
    ev({ title: '점심', start: at(11, 12), end: at(11, 13) }),
    ev({ title: '점심', start: at(11, 12), end: at(11, 13), location: '다른 캘린더' }),   // 같은 사람의 두 캘린더
    ev({ title: '회의', start: at(11, 15), end: at(11, 16) }),
  ] });
  const b = person('p2', '지수', { events: [
    ev({ title: '  점심  ', start: at(11, 12), end: at(11, 13) }),    // 공백만 다름 → 같은 일정
    ev({ title: '점심 약속', start: at(11, 12), end: at(11, 13) }),   // 제목이 다름 → 다른 일정
    ev({ title: '회의', start: at(11, 15, 30), end: at(11, 16) }),    // 시각이 다름 → 다른 일정
    ev({ title: '회의', start: at(11, 15), end: at(11, 16) }),        // 같음
  ] });
  const m = M.mergeEvents([a, b]);
  assert.deepEqual(m.map((e) => `${e.title.trim()}@${new Date(e.start).getHours()}:${new Date(e.start).getMinutes()}|${e.who}`).sort(),
    ['점심 약속@12:0|지수', '점심@12:0|우리', '회의@15:0|우리', '회의@15:30|지수']);
});

test('일정 합치기: 종일 일정은 날짜와 제목으로 같은지 판정', () => {
  const day = (d) => ({ allDay: true, start: at(d, 0), end: at(d + 1, 0) });
  const m = M.mergeEvents([
    person('p1', '민기', { events: [ev({ title: '출장', ...day(12) }), ev({ title: '출장', ...day(13) })] }),
    person('p2', '지수', { events: [ev({ title: '출장', ...day(12) })] }),
  ]);
  assert.equal(m.length, 2);
  assert.deepEqual(m.map((e) => e.who), ['우리', '민기']);
});

test('출처 표시: 캘린더를 켠 사람이 2명 이상일 때만, 2명 이상에게서 온 일정은 우리·한 사람은 이름, 1명이면 표시 없음', () => {
  const ph = (n) => ev({ title: '개인' + n, start: at(11, 9 + n), end: at(11, 10 + n) });
  const shared = ev({ title: '공유', start: at(11, 12), end: at(11, 13) });
  const who = (people, lang) => Object.fromEntries(M.mergeEvents(people, lang).map((e) => [e.title, e.who]));
  const p1 = person('p1', '민기', { events: [shared, ph(1)] }), p2 = person('p2', '지수', { events: [shared, ph(2)] });
  assert.deepEqual(who([p1, p2], 'ko'), { 공유: '우리', 개인1: '민기', 개인2: '지수' });
  assert.deepEqual(who([p1, p2], 'zh'), { 공유: '我们', 개인1: '민기', 개인2: '지수' });
  assert.deepEqual(who([p1, p2], 'en'), { 공유: 'Us', 개인1: '민기', 개인2: '지수' });
  // 1명뿐: 표시 없음(지금 화면 그대로)
  assert.deepEqual(who([p1], 'ko'), { 공유: null, 개인1: null });
  // 2명이어도 한 명이 캘린더를 끄면 그 사람 일정은 빠지고 표시도 없음
  assert.deepEqual(who([p1, { ...p2, calendarOn: false }], 'ko'), { 공유: null, 개인1: null });
  // 공휴일은 사람 일정이 아니므로 표시 없음(둘 다 구독해도 '우리'로 안 보임)
  const hol = ev({ title: '어린이날', allDay: true, holiday: true, start: at(11, 0), end: at(12, 0) });
  assert.deepEqual(who([{ ...p1, events: [hol] }, { ...p2, events: [hol] }], 'ko'), { 어린이날: null });
});

test('오늘 일정·이번 주: 출처가 오늘 줄에 실리고, 개수와 첫 일정은 중복 제거 뒤 기준', () => {
  const dup = (h) => ev({ title: '수영', start: at(12, h), end: at(12, h + 1) });
  const people = [person('p1', '민기', { events: [dup(7), ev({ title: '치과', start: at(11, 16), end: at(11, 17) })] }), person('p2', '지수', { events: [dup(7)] })];
  const merged = M.mergeEvents(people);
  const { today } = M.buildToday(merged, NOW);
  assert.deepEqual(today.map((e) => [e.title, e.who]), [['치과', '민기']]);
  const week = M.buildWeek(merged, NOW);
  assert.equal(week[0].count, 1);   // 둘이 같은 수영을 넣어도 한 건
  assert.equal(week[0].tip, '수영');
  assert.equal(week[0].first, '수영');
});

test('메모 묶음: 켠 사람 순서, 이름은 2명 이상일 때만, 묶음당 상한 3(3묶음 이상이면 2)·1명이면 이름 없이 4', () => {
  const memos = (n, p) => Array.from({ length: n }, (_, i) => `${p}${i + 1}`);
  const g = (people) => M.buildMemoGroups(people).map((x) => [x.name, x.items.length, x.more, x.moreText]);
  const a = person('p1', '민기', { memos: memos(6, 'a') }), b = person('p2', '지수', { memos: memos(2, 'b') });
  // 1명: 이름 없이 최대 4개(지금 화면 그대로)
  assert.deepEqual(M.buildMemoGroups([a]), [{ name: null, items: ['a1', 'a2', 'a3', 'a4'], more: 2, moreText: '외 2건' }]);
  assert.deepEqual(M.buildMemoGroups([person('p1', '민기')]), []);
  // 2명: 이름 라벨, 묶음당 3개
  assert.deepEqual(g([a, b]), [['민기', 3, 3, '외 3건'], ['지수', 2, 0, '']]);
  // 3명 이상: 묶음당 2개
  const c = person('p3', '하늘', { memos: memos(3, 'c') });
  assert.deepEqual(g([a, b, c]), [['민기', 2, 4, '외 4건'], ['지수', 2, 0, ''], ['하늘', 2, 1, '외 1건']]);
  const d = person('p4', '다온', { memos: memos(9, 'd') });
  assert.deepEqual(g([a, b, c, d]).map((x) => x[1]), [2, 2, 2, 2]);
  // 메모를 끈 사람은 빠지고(순서 유지), 켠 사람이 1명이면 이름도 빠짐
  assert.deepEqual(g([a, { ...b, tasksOn: false }]), [[null, 4, 2, '외 2건']]);
  assert.deepEqual(g([{ ...a, tasksOn: false }, b]), [[null, 2, 0, '']]);
  // 메모 없는 사람은 묶음을 만들지 않지만, 이름은 켠 사람 수 기준
  assert.deepEqual(g([a, person('p2', '지수')]), [['민기', 3, 3, '외 3건']]);
  // 언어별 '외 n건'
  assert.equal(M.buildMemoGroups([a, b], 'en')[0].moreText, '+3 more');
  assert.equal(M.buildMemoGroups([a, b], 'zh')[0].moreText, '另有 3 项');
});

test('상태 문장: 한 사람의 실패는 그 사람 이름을 붙여 알림(사람이 2명 이상일 때만), 3언어', () => {
  const t = new Date(2026, 10, 11, 19, 20).getTime();
  const st = (lang, people) => M.buildStatus(lang, 'tasks', people);
  const solo = [person('p1', '지수', { sync: { tasks: { state: 'failed', at: t } } })];
  assert.equal(st('ko', solo), '메모 갱신 실패 · 19:20 기준');   // 1명이면 이름 없음
  const two = [person('p1', '민기'), person('p2', '지수', { sync: { tasks: { state: 'failed', at: t } } })];
  assert.equal(st('ko', two), '지수 메모 갱신 실패 · 19:20 기준');
  assert.equal(st('zh', two), '지수备忘更新失败 · 截至 19:20');
  assert.equal(st('en', two), '지수: Memos update failed · 19:20');
  assert.equal(st('ko', [two[0], { ...two[1], tasksOn: false }]), null);   // 메모를 끈 사람의 상태는 안 보임
  const both = [person('p1', '민기', { sync: { calendar: { state: 'needAuth' } } }), person('p2', '지수', { sync: { calendar: { state: 'failed' } } })];
  assert.equal(M.buildStatus('ko', 'calendar', both), '민기 캘린더 연결 필요 / 지수 일정 갱신 실패');
});
// 개정 기록 | 2026-11-12 | 사람 여러 명 | 사용자 결정: 일정 합치기·출처 표시·메모 묶음·상태 문장 이름 시험
