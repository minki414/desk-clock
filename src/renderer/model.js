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

  // 사람별 일정 합치기. 사용자 의도 [docs/v1.4-people-brief.md §2]: 시작 시각(종일이면 날짜)과 앞뒤 공백 뺀 제목이 같으면 같은 일정 → 한 번만.
  // 출처 표시(who)는 캘린더를 켠 사람이 2명 이상일 때만: 2명 이상에게서 온 일정은 '우리', 한 사람뿐이면 그 사람 이름, 1명뿐이면 표시 없음.
  // 개발 판단: 종일 일정의 start 는 그날 0시(현지) 밀리초라 같은 키 하나로 시각·날짜 비교가 모두 된다. 공휴일은 사람 일정이 아니므로(두 사람 모두 구독하면 '우리'로 보임) 항상 who 없음.
  // p: [{ id, name, calendarOn, events }]
  function mergeEvents(people, lang = 'ko') {
    const on = people.filter((p) => p.calendarOn);
    const names = on.length >= 2;
    const seen = new Map();
    on.forEach((p) => (p.events || []).forEach((e) => {
      const key = `${e.start}|${String(e.title || '').trim()}`;   // 시작은 숫자뿐이라 첫 '|' 앞뒤가 섞일 수 없음
      const g = seen.get(key) || seen.set(key, { e, by: [] }).get(key);
      if (!g.by.includes(p)) g.by.push(p);
    }));
    return [...seen.values()].map(({ e, by }) => ({ ...e, who: !names || e.holiday ? null : by.length >= 2 ? I18N.t(lang, 'person.us') : by[0].name }));
  }

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
      return { time: e.allDay ? I18N.t(lang, 'stage.allDay') : hhmm(e.start), title: e.title || I18N.t(lang, 'stage.untitled'), location: e.location || '', who: e.who || null, state };
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

  // 메모 묶음. 사용자 의도 [docs/v1.4-people-brief.md §3]: 메모를 켠 사람 순서대로 묶음. 이름 라벨은 켠 사람이 2명 이상일 때만(1명이면 이름 없이 최대 4개).
  // 묶음당 상한은 3개, 보이는 묶음이 3개 이상이면 2개(메모 칸 높이를 넘지 않게). 넘친 개수는 moreText('외 n건')로 묶음마다 따로.
  // 개발 판단: 메모가 하나도 없는 사람은 묶음을 만들지 않는다(빈 이름표가 자리만 차지하므로). 이름을 보일지는 켠 사람 수 기준이라 그대로다.
  // p: [{ name, tasksOn, memos }]
  function buildMemoGroups(people, lang = 'ko') {
    const on = people.filter((p) => p.tasksOn);
    const names = on.length >= 2;
    const filled = on.filter((p) => (p.memos || []).length);
    const cap = !names ? 4 : filled.length >= 3 ? 2 : 3;
    return filled.map((p) => {
      const items = p.memos.slice(0, cap), more = p.memos.length - items.length;
      return { name: names ? p.name : null, items, more, moreText: more ? I18N.t(lang, 'stage.more', { n: more }) : '' };
    });
  }

  // 동기화 상태 한 줄. 사람이 2명 이상이면 문장 앞에 그 사람 이름을 붙임('지수 메모 갱신 실패 · 19:20 기준'). 여러 건이면 ' / '로 이음
  function buildStatus(lang, kind, people) {
    const flag = kind === 'calendar' ? 'calendarOn' : 'tasksOn';
    const list = people.filter((p) => p[flag]).map((p) => {
      const text = I18N.statusText(lang, kind, (p.sync || {})[kind]);
      return text && people.length >= 2 ? I18N.t(lang, 'status.withWho', { who: p.name, text }) : text;
    }).filter(Boolean);
    return list.length ? list.join(' / ') : null;
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
  // o: { lang, now, mode, weather(원자료: place·tempC·code·hiC·loC·umbrella·mask)|null, people:[{ id, name, calendarOn, tasksOn, events, memos, sync:{calendar,tasks} }], slots, timer(phase·input·invalidAt·remainingMs·totalMs), hotkeysOn, pressedKey, sync(날씨), health }
  function buildModel(o) {
    const lang = I18N.norm(o.lang), now = o.now;
    const events = mergeEvents(o.people, lang);
    const today = buildToday(events, now, 4, lang);
    const L = I18N.stageLabels(lang);
    L.todayMore = today.todayMore ? I18N.t(lang, 'stage.more', { n: today.todayMore }) : '';
    const w = o.weather;
    const sync = o.sync || {};
    return {
      now, mode: o.mode, lang, L,
      dateLong: I18N.fmtDate(lang, now, 'long'), dateShort: I18N.fmtDate(lang, now, 'short'), dateMonthDay: I18N.fmtDate(lang, now, 'monthDay'),
      dateMonth: I18N.fmtDate(lang, now, 'month'), dateDow: I18N.fmtDate(lang, now, 'dow'), dateNum: I18N.fmtDate(lang, now, 'num'), dateDowShort: I18N.fmtDate(lang, now, 'dowShort'),
      weather: w ? { ...w, label: I18N.weatherLabel(lang, w.code), icon: I18N.weatherIcon(w.code) } : null,
      ...today, week: buildWeek(events, now, lang), memoGroups: buildMemoGroups(o.people, lang),
      timer: { ...o.timer, hint: timerHint(lang, o.timer) },
      legend: buildLegend(o.slots, lang), hotkeysOn: o.hotkeysOn, pressedKey: o.pressedKey || null,
      status: { calendar: buildStatus(lang, 'calendar', o.people), tasks: buildStatus(lang, 'tasks', o.people), weather: I18N.statusText(lang, 'weather', sync.weather) },
      health: o.health || 'ok',
    };
  }

  return { isNight, effectiveMode, mergeEvents, buildToday, buildWeek, buildMemoGroups, buildStatus, buildLegend, buildModel, timerHint, hhmm };
});
// 개정 기록 | 2026-11-11 | 최초 작성 | 테마 계약 모델(오늘 4건·7칸 주간·메모 4건)
// 개정 기록 | 2026-11-11 | v1.3 | 언어(lang) 인자, 요일·'종일'·범례를 사전으로, buildModel 신설(앱·예시 모델 공용), 주간 칸 tip | docs/v1.3-i18n-brief.md
// 개정 기록 | 2026-11-12 | 사람 여러 명 | 사용자 결정: 일정 합치기·중복 제거·출처(who), 메모 묶음(memoGroups), 상태 문장에 이름, buildModel 입력을 people 로
