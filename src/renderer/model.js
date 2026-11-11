// 화면 모델 조립용 순수 함수(원자료 → 테마 계약 모델). 시간이 흐르면 일정 상태가 바뀌므로 렌더러가 매초 다시 계산합니다.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ClockModel = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const DOW = '일월화수목금토';
  const pad = (n) => String(n).padStart(2, '0');
  const hhmm = (ms) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const minutes = (s) => { const [h, m] = String(s).split(':').map(Number); return (h || 0) * 60 + (m || 0); };

  // 야간 구간은 자정을 넘길 수 있음(19:00~07:00)
  function isNight(now, s) {
    const m = now.getHours() * 60 + now.getMinutes();
    const a = minutes(s.nightStart), b = minutes(s.nightEnd);
    if (a === b) return false;
    return a < b ? m >= a && m < b : m >= a || m < b;
  }
  const effectiveMode = (now, s) => (s.mode === 'auto' ? (isNight(now, s) ? 'dark' : 'light') : s.mode);

  const dayStart = (now, plus = 0) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + plus).getTime();
  const overlaps = (e, from, to) => e.start < to && Math.max(e.end, e.start + 1) > from;
  const byTime = (a, b) => (b.allDay - a.allDay) || (a.start - b.start) || a.title.localeCompare(b.title);

  function buildToday(events, now, max = 4) {
    const t = now.getTime();
    const list = events.filter((e) => overlaps(e, dayStart(now), dayStart(now, 1))).sort(byTime);
    let nextDone = false;
    const rows = list.map((e) => {
      let state = 'later';
      if (!e.allDay) {
        if (e.end <= t) state = 'past';
        else if (e.start <= t) state = 'now';
        else if (!nextDone) { state = 'next'; nextDone = true; }
      }
      return { time: e.allDay ? '종일' : hhmm(e.start), title: e.title, location: e.location || '', state };
    });
    // 넘치면 지난 일정부터 덜어 내서 앞으로 일을 우선 보여 줌
    let shown = rows;
    for (let p = shown.findIndex((r) => r.state === 'past'); shown.length > max && p >= 0; p = shown.findIndex((r) => r.state === 'past')) shown = shown.filter((_, j) => j !== p);
    shown = shown.slice(0, max);
    return { today: shown, todayMore: rows.length - shown.length };
  }

  // 내일부터 7칸
  function buildWeek(events, now) {
    const cells = [];
    for (let i = 1; i <= 7; i++) {
      const from = dayStart(now, i), to = dayStart(now, i + 1);
      const day = events.filter((e) => overlaps(e, from, to));
      const items = day.filter((e) => !e.holiday).sort(byTime);
      const dow = new Date(from).getDay();
      cells.push({ dow: DOW[dow], isSunday: dow === 0, isHoliday: day.some((e) => e.holiday), first: items.length ? items[0].title : null, count: items.length });
    }
    return cells;
  }

  function buildMemos(tasks, max = 4) {
    return { memos: tasks.slice(0, max), memoMore: Math.max(0, tasks.length - max) };
  }

  function buildLegend(slots) {
    const l = slots.filter((s) => s.target && s.name).map((s) => ({ key: String(s.key), name: s.name }));
    return [...l, { key: '0', name: '시계' }, { key: 'T', name: '타이머' }];
  }

  return { isNight, effectiveMode, buildToday, buildWeek, buildMemos, buildLegend, hhmm };
});
// 개정 기록 | 2026-11-11 | 최초 작성 | 테마 계약 모델(오늘 4건·7칸 주간·메모 4건)
