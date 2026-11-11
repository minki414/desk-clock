// D4 스탠바이. 정본 시안 d4-standby.html. 움직임은 타이머 고리(1초 선형 이동)뿐.
(function () {
  var K = window.ClockKit, I = window.ClockIcons, ID = 'standby', R = null, stage0 = null, CIRC = 138.2;

  function mount(stage) {
    stage0 = stage; stage.classList.add('theme-' + ID); stage.textContent = '';
    R = {};
    var L = K.el('div', 'l', stage), t = K.el('div', 't', L);
    R.hh = K.el('span', '', t); K.el('span', 'c', t, ':'); R.mm = K.el('span', 'm', t);
    var dt = K.el('div', 'dt', L); R.date = K.el('b', '', dt); R.nx = K.el('span', 'nx', dt);
    R.tm = K.el('div', 'tm t-hidden', L);
    var sv = K.svg('svg', { viewBox: '0 0 54 54' }, R.tm);
    K.svg('circle', { cx: 27, cy: 27, r: 22, class: 'trk' }, sv); R.prg = K.svg('circle', { cx: 27, cy: 27, r: 22, class: 'prg' }, sv);
    R.tn = K.el('b', '', R.tm); R.lTimer = K.el('span', '', R.tm); R.th = K.el('span', 'th', R.tm);
    R.legend = K.el('div', 'legend', stage);

    var Rt = K.el('div', 'r', stage);
    var pw = K.el('div', 'p wx', Rt);
    R.icon = K.el('div', 'k', pw); R.wT = K.el('b', '', pw);
    var side = K.el('div', 'side', pw); R.wL = K.el('div', '', side); R.wH = K.el('div', '', side);
    var fl = K.el('div', 'flags', side);
    R.umb = K.el('div', 'flag', fl); R.umb.innerHTML = I.umbrella + '<span></span>'; R.umbT = R.umb.lastChild;
    R.msk = K.el('div', 'flag', fl); R.msk.innerHTML = I.mask + '<span></span>'; R.mskT = R.msk.lastChild;
    R.wNone = K.el('div', 'wnone', pw); R.wst = K.el('div', 'wst', pw);

    var pe = K.el('div', 'p', Rt), he = K.el('h3', '', pe); R.lToday = K.el('span', '', he); R.stC = K.el('span', 'st', he);
    R.ev = K.el('div', '', pe); R.eMore = K.el('div', 'more', pe); R.eNone = K.el('div', 'none', pe); R.wk = K.el('div', 'wk', pe);
    var pm = K.el('div', 'p memo', Rt), hm = K.el('h3', '', pm); R.lMemo = K.el('span', '', hm); R.stM = K.el('span', 'st', hm);
    R.mm2 = K.el('div', '', pm); R.mMore = K.el('div', 'more', pm); R.mNone = K.el('div', 'none', pm);
    R.dot = K.el('i', 'dot', stage);
    R.wkCells = K.pool(R.wk, 7, function (par) { var d = K.el('div', '', par); return { root: d, b: K.el('b', '', d), u: K.el('u', '', d) }; });
  }

  // 고정 문구는 모델(m.L)에서 받아 바뀐 때만 갱신(언어 전환 즉시 반영)
  function labels(m) {
    var L = m.L;
    K.text(R.lTimer, L.timer); K.text(R.lToday, L.today); K.text(R.lMemo, L.memo); K.text(R.umbT, L.umbrella); K.text(R.mskT, L.mask);
    K.text(R.wNone, L.noWeather); K.text(R.eNone, L.noEvents); K.text(R.mNone, L.noMemos);
  }

  function render(m) {
    if (!R) return;
    labels(m);
    var p = K.parts(m.now), w = m.weather;
    K.text(R.hh, p.hh); K.text(R.mm, p.mm);
    K.text(R.date, m.dateLong);
    var nx = K.nextEvent(m.today);
    K.text(R.nx, nx ? '· ' + (nx.state === 'now' ? m.L.now + ' ' : m.L.next + ' ' + nx.time + ' ') + nx.title : ''); K.hide(R.nx, !nx);

    // 날씨 칸
    K.hide(R.icon, !w); K.hide(R.wT, !w); K.hide(R.wL.parentNode, !w); K.hide(R.wNone, !!w);
    if (w) {
      var key = w.icon; if (R.iconKey !== key) { R.iconKey = key; R.icon.innerHTML = I[key]; }
      K.text(R.wT, K.temp(w.tempC)); K.text(R.wL, w.label + ' · ' + w.place); K.text(R.wH, K.temp(w.hiC) + ' / ' + K.temp(w.loC));
    }
    K.hide(R.umb, !(w && w.umbrella)); K.hide(R.msk, !(w && w.mask)); K.hide(R.umb.parentNode, !(w && (w.umbrella || w.mask)));
    K.text(R.wst, m.status.weather || ''); K.hide(R.wst, !m.status.weather);
    K.text(R.stC, m.status.calendar || ''); K.hide(R.stC, !m.status.calendar);
    K.text(R.stM, m.status.tasks || ''); K.hide(R.stM, !m.status.tasks);

    var today = m.today.slice(0, 4);
    K.pool(R.ev, today.length, function (par) { var r = K.el('div', 'ev', par); K.el('i', '', r); return { root: r, t: K.el('span', 'tt', r), n: K.el('span', 'n', r) }; })
      .forEach(function (it, i) { var e = today[i]; if (!e) return; K.text(it.t, e.time); K.cls(it.t, 'ad', !/^\d/.test(e.time)); K.text(it.n, e.title); K.attr(it.root, 'data-st', e.state); });
    K.hide(R.eNone, today.length > 0); K.hide(R.eMore, !m.todayMore); K.text(R.eMore, m.L.todayMore);

    for (var i = 0; i < 7; i++) {
      var c = R.wkCells[i], x = m.week[i]; K.hide(c.root, !x); if (!x) continue;
      K.text(c.b, x.dow); K.attr(c.root, 'data-has', !!x.first); K.attr(c.root, 'data-sun', x.isSunday || x.isHoliday);
      K.attr(c.root, 'title', x.tip);
    }
    K.hide(R.wk, m.week.length === 0);

    var memos = m.memos.slice(0, 4);
    K.pool(R.mm2, memos.length, function (par) { var r = K.el('div', 'li', par); return { root: r, s: K.el('span', '', r) }; })
      .forEach(function (it, j) { if (memos[j] != null) K.text(it.s, memos[j]); });
    K.hide(R.mNone, memos.length > 0); K.hide(R.mMore, !m.memoMore); K.text(R.mMore, m.L.memoMore);

    // 타이머: 알약 + 남은 비율 고리
    var t = m.timer;
    K.timerState(R.tm, R.tn, t, m.now);
    K.text(R.tn, K.timerText(t)); K.text(R.th, K.timerHint(t)); K.hide(R.th, !K.timerHint(t));
    var ratio = t.phase === 'ringing' ? 1 : (t.phase === 'running' || t.phase === 'paused') && t.totalMs > 0 ? Math.max(0, Math.min(1, t.remainingMs / t.totalMs)) : 0;
    K.style(R.prg, 'strokeDashoffset', ((1 - ratio) * CIRC).toFixed(1));

    K.legendLine(R.legend, m);
    K.attr(R.dot, 'data-h', m.health);
  }

  function unmount() { if (stage0) { stage0.classList.remove('theme-' + ID); stage0.textContent = ''; } R = null; stage0 = null; }

  window.ClockThemes = window.ClockThemes || {};
  window.ClockThemes[ID] = { kind: 'digital', mount: mount, render: render, unmount: unmount };
})();
// 개정 기록 | 2026-11-11 | v1 | 시안 d4 이식 | 타이머 고리만 움직임(남은 비율, 1초 선형), 날씨 아이콘은 문구에서 고름
// 개정 기록 | 2026-11-11 | v1.3 | 언어 전환: 고정 문구·날짜·'외 n건'을 모델(m.L, m.date*)에서 받음, 테마 이름 제거 | docs/v1.3-i18n-brief.md
