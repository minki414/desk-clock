const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/renderer/model.js');
const L = require('../src/renderer/labels.js');

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
  assert.deepEqual(week[0], { dow: '목', isSunday: false, isHoliday: false, first: '수영', count: 2 });
  assert.equal(week[1].first, '연차');
  assert.equal(week[3].isSunday, true);
  assert.equal(week[3].isHoliday, true);
  assert.equal(week[3].first, null);   // 공휴일 자체는 일정 개수에 넣지 않음
  assert.equal(week[3].count, 0);
  assert.equal(week[6].first, '모임');
  assert.equal(week[2].count, 0);
});

test('메모: 최대 4건과 외 n건', () => {
  assert.deepEqual(M.buildMemos(['a', 'b']), { memos: ['a', 'b'], memoMore: 0 });
  assert.deepEqual(M.buildMemos(['a', 'b', 'c', 'd', 'e', 'f']), { memos: ['a', 'b', 'c', 'd'], memoMore: 2 });
  assert.deepEqual(M.buildMemos([]), { memos: [], memoMore: 0 });
});

test('범례: 등록된 슬롯만, 0 시계·T 타이머는 항상', () => {
  const slots = [{ key: 1, name: '유튜브', target: 'https://y' }, { key: 2, name: '', target: '' }, { key: 3, name: 'LP', target: 'http://l' }];
  assert.deepEqual(M.buildLegend(slots), [{ key: '1', name: '유튜브' }, { key: '3', name: 'LP' }, { key: '0', name: '시계' }, { key: 'T', name: '타이머' }]);
});

test('상태 문구: 명사형, 마지막 성공 시각 표시', () => {
  const t = new Date(2026, 10, 11, 19, 20).getTime();
  assert.equal(L.statusText('calendar', { state: 'ok', at: t }), null);
  assert.equal(L.statusText('calendar', { state: 'pending' }), null);
  assert.equal(L.statusText('calendar', { state: 'needAuth' }), '캘린더 연결 필요');
  assert.equal(L.statusText('tasks', { state: 'needAuth' }), null);
  assert.equal(L.statusText('calendar', { state: 'tokenUnavailable' }), '토큰 보관 불가');
  assert.equal(L.statusText('calendar', { state: 'failed', at: t }), '일정 갱신 실패 · 19:20 기준');
  assert.equal(L.statusText('tasks', { state: 'failed' }), '메모 갱신 실패');
  assert.equal(L.statusText('weather', { state: 'failed', at: t }), '날씨 갱신 실패 · 19:20 기준');
});
