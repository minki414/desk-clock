// 화면 모델 조립용 순수 함수(원자료 → 테마 계약 모델). 시간이 흐르면 일정 상태가 바뀌므로 렌더러가 매초 다시 계산합니다.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./i18n.js'), require('./timer-parse.js'));
  else root.ClockModel = factory(root.ClockI18n, root.ClockTimerParse);
})(typeof self !== 'undefined' ? self : this, function (I18N, TP) {
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

  function buildToday(events, now, max = 4, lang = 'ko') {
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
      return { time: e.allDay ? I18N.t(lang, 'stage.allDay') : hhmm(e.start), title: e.title || I18N.t(lang, 'stage.untitled'), location: e.location || '', state };
    });
    // 넘치면 지난 일정부터 덜어 내서 앞으로 일을 우선 보여 줌
    let shown = rows;
    for (let p = shown.findIndex((r) => r.state === 'past'); shown.length > max && p >= 0; p = shown.findIndex((r) => r.state === 'past')) shown = shown.filter((_, j) => j !== p);
    shown = shown.slice(0, max);
    return { today: shown, todayMore: rows.length - shown.length };
  }

  // 내일부터 7칸
  function buildWeek(events, now, lang = 'ko') {
    const cells = [];
    for (let i = 1; i <= 7; i++) {
      const from = dayStart(now, i), to = dayStart(now, i + 1);
      const day = events.filter((e) => overlaps(e, from, to));
      const items = day.filter((e) => !e.holiday).sort(byTime);
      const dow = new Date(from).getDay();
      const first = items.length ? items[0].title || I18N.t(lang, 'stage.untitled') : null;
      cells.push({ dow: I18N.fmtDate(lang, new Date(from), 'dowShort'), isSunday: dow === 0, isHoliday: day.some((e) => e.holiday), first, count: items.length,
        tip: first && items.length > 1 ? I18N.t(lang, 'stage.moreOf', { first, n: items.length - 1 }) : first || '' });
    }
    return cells;
  }

  function buildMemos(tasks, max = 4) {
    return { memos: tasks.slice(0, max), memoMore: Math.max(0, tasks.length - max) };
  }

  function buildLegend(slots, lang = 'ko') {
    const l = slots.filter((s) => s.target && s.name).map((s) => ({ key: String(s.key), name: s.name }));
    return [...l, { key: '0', name: I18N.t(lang, 'stage.clock') }, { key: 'T', name: I18N.t(lang, 'stage.timer') }];
  }

  // 타이머 안내 글: 입력 중엔 해석 결과('1분 35초'), 일시정지·울림엔 상태 이름
  function timerHint(lang, t) {
    if (t.phase === 'input') { const r = TP.parse(t.input); return r.ok ? I18N.fmtDuration(lang, r.ms) : ''; }
    if (t.phase === 'paused') return I18N.t(lang, 'stage.paused');
    if (t.phase === 'ringing') return I18N.t(lang, 'stage.timeUp');
    return '';
  }

  // 원자료(o) → 테마 계약 모델(docs/theme-contract.md). 앱과 예시 모델(tools/fixtures.js)이 같은 함수를 써서 형식이 어긋나지 않게 한다.
  // o: { lang, now, mode, weather(원자료: place·tempC·code·hiC·loC·umbrella·mask)|null, events, tasks, slots, timer(phase·input·invalidAt·remainingMs·totalMs), hotkeysOn, pressedKey, sync, health }
  function buildModel(o) {
    const lang = I18N.norm(o.lang), now = o.now;
    const today = buildToday(o.events, now, 4, lang), memos = buildMemos(o.tasks);
    const L = I18N.stageLabels(lang);
    L.todayMore = today.todayMore ? I18N.t(lang, 'stage.more', { n: today.todayMore }) : '';
    L.memoMore = memos.memoMore ? I18N.t(lang, 'stage.more', { n: memos.memoMore }) : '';
    const w = o.weather;
    const sync = o.sync || {};
    return {
      now, mode: o.mode, lang, L,
      dateLong: I18N.fmtDate(lang, now, 'long'), dateShort: I18N.fmtDate(lang, now, 'short'), dateMonthDay: I18N.fmtDate(lang, now, 'monthDay'),
      dateMonth: I18N.fmtDate(lang, now, 'month'), dateDow: I18N.fmtDate(lang, now, 'dow'), dateNum: I18N.fmtDate(lang, now, 'num'), dateDowShort: I18N.fmtDate(lang, now, 'dowShort'),
      weather: w ? { ...w, label: I18N.weatherLabel(lang, w.code), icon: I18N.weatherIcon(w.code) } : null,
      ...today, week: buildWeek(o.events, now, lang), ...memos,
      timer: { ...o.timer, hint: timerHint(lang, o.timer) },
      legend: buildLegend(o.slots, lang), hotkeysOn: o.hotkeysOn, pressedKey: o.pressedKey || null,
      status: { calendar: I18N.statusText(lang, 'calendar', sync.calendar), tasks: I18N.statusText(lang, 'tasks', sync.tasks), weather: I18N.statusText(lang, 'weather', sync.weather) },
      health: o.health || 'ok',
    };
  }

  return { isNight, effectiveMode, buildToday, buildWeek, buildMemos, buildLegend, buildModel, timerHint, hhmm };
});
// 개정 기록 | 2026-11-11 | 최초 작성 | 테마 계약 모델(오늘 4건·7칸 주간·메모 4건)
// 개정 기록 | 2026-11-11 | v1.3 | 언어(lang) 인자, 요일·'종일'·범례를 사전으로, buildModel 신설(앱·예시 모델 공용), 주간 칸 tip | docs/v1.3-i18n-brief.md
