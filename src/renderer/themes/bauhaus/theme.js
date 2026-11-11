// A2 바우하우스(기본 테마). 정본 시안 a2-bauhaus.html. 모델만 보고 그린다(예시 자료 없음).
(function () {
  var K = window.ClockKit, I = window.ClockIcons, ID = 'bauhaus', R = null, stage0 = null;

  function P(r, deg) { var a = (deg - 90) * Math.PI / 180; return [300 + r * Math.cos(a), 300 + r * Math.sin(a)]; }
  function layer(parent, cls) { return K.svg('svg', { class: cls, viewBox: '0 0 600 600' }, parent); }
  function sec(parent, label) {
    var s = K.el('div', 'sec', parent), l = K.el('div', 'lab', s);
    K.el('span', '', l, label);
    return { root: s, lab: l, st: K.el('span', 'st', l) };
  }

  function mount(stage) {
    stage0 = stage; stage.classList.add('theme-' + ID); stage.textContent = '';
    R = { sAng: {} };
    var grid = K.el('div', 'bh-grid', stage), L = K.el('div', 'bh-col', grid), M = K.el('div', 'bh-mid', grid), Rt = K.el('div', 'bh-col', grid);

    var sd = sec(L, ''); R.lToday = sd.lab.firstChild; R.d1 = K.el('span', '', K.el('div', 'dt', sd.root));
    R.d2 = K.el('span', '', R.d1.parentNode);
    var sw = sec(L, ''); R.wLab = sw.lab.firstChild; R.stW = sw.st;
    R.wx = K.el('div', 'wx', sw.root);
    R.wT = K.el('span', 't', R.wx);
    var wd = K.el('span', 'd', R.wx); R.wL = K.el('div', '', wd); R.wH = K.el('div', '', wd);
    var fl = K.el('div', 'fl', R.wx);
    R.umb = K.el('span', '', fl); R.umb.innerHTML = I.umbrella; 
    R.msk = K.el('span', '', fl); R.msk.innerHTML = I.mask; 
    R.wNone = K.el('div', 'none', sw.root);
    var sm = sec(L, ''); R.lMemo = sm.lab.firstChild; R.stM = sm.st; R.mm = K.el('div', 'mm', sm.root);
    R.mMore = K.el('div', 'more', sm.root); R.mNone = K.el('div', 'none', sm.root);

    // 시계
    var dial = K.el('div', 'dial', M); K.el('div', 'sh', dial);
    var f = layer(dial, 'face');
    var defs = K.svg('defs', {}, f);
    var g = K.svg('radialGradient', { id: 'bh-dome', cx: '.35', cy: '.25', r: '.9', class: 'dome' }, defs);
    [0, .55, 1].forEach(function (o) { K.svg('stop', { offset: o }, g); });
    K.svg('circle', { cx: 300, cy: 300, r: 298, class: 'bezel' }, f);
    K.svg('circle', { cx: 300, cy: 300, r: 290, class: 'faceBg' }, f);
    var d1 = '', d3 = '';
    for (var i = 0; i < 60; i++) {
      var h = i % 5 === 0, a = P(h ? 258 : 266, i * 6), b = P(278, i * 6), seg = 'M' + a[0].toFixed(2) + ' ' + a[1].toFixed(2) + 'L' + b[0].toFixed(2) + ' ' + b[1].toFixed(2);
      if (h) d3 += seg; else d1 += seg;
    }
    K.svg('path', { d: d1, class: 'tk', 'stroke-width': 1 }, f);
    K.svg('path', { d: d3, class: 'tk', 'stroke-width': 3 }, f);
    for (i = 1; i <= 12; i++) { var p = P(222, i * 30), t = K.svg('text', { x: p[0], y: p[1] + 17, class: 'num' }, f); t.textContent = i; }
    var hh = layer(dial, 'hand h'); K.svg('rect', { x: 294, y: 150, width: 12, height: 172, rx: 2 }, hh); R.h = hh;
    var mh = layer(dial, 'hand m'); K.svg('rect', { x: 295.5, y: 54, width: 9, height: 268, rx: 2 }, mh); R.m = mh;
    var sh = layer(dial, 'hand s'); K.svg('line', { x1: 300, y1: 348, x2: 300, y2: 38 }, sh);
    K.svg('circle', { cx: 300, cy: 300, r: 10, class: 'c1' }, sh); K.svg('circle', { cx: 300, cy: 300, r: 3, class: 'c2' }, sh); R.s = sh;
    var dm = layer(dial, 'domeTop'); K.svg('circle', { cx: 300, cy: 300, r: 290, fill: 'url(#bh-dome)' }, dm);

    R.tm = K.el('div', 'tm t-hidden', M); R.tn = K.el('div', 'tn', R.tm); R.th = K.el('div', 'th', R.tm);

    var se = sec(Rt, ''); R.lSched = se.lab.firstChild; R.stC = se.st; R.ev = K.el('div', 'evs', se.root);
    R.eMore = K.el('div', 'more', se.root); R.eNone = K.el('div', 'none', se.root);
    var sk = sec(Rt, ''); R.lWeek = sk.lab.firstChild; R.wk = K.el('div', 'wks', sk.root); R.kNone = K.el('div', 'none', sk.root);

    R.legend = K.el('div', 'legend', stage); R.dot = K.el('i', 'dot', stage);
  }

  function setHand(el, deg, instant) {
    if (el._deg === deg && el._i === instant) return;
    el._deg = deg; el._i = instant;
    el.style.transition = instant ? 'none' : '';
    el.style.transform = 'rotate(' + deg + 'deg)';
  }

  // 고정 문구는 모델(m.L)에서 받아 바뀐 때만 갱신(언어 전환 즉시 반영)
  function labels(m) {
    var L = m.L;
    K.text(R.lToday, L.today); K.text(R.lSched, L.schedule); K.text(R.lWeek, L.week); K.text(R.lMemo, L.memo);
    K.text(R.wNone, L.noWeather); K.text(R.eNone, L.noEvents); K.text(R.kNone, L.noEvents); K.text(R.mNone, L.noMemos);
    K.attr(R.umb, 'title', L.umbrellaTip); K.attr(R.msk, 'title', L.maskTip);
  }

  function render(m) {
    if (!R) return;
    labels(m);
    var p = K.parts(m.now), an = K.angles(m.now);
    K.text(R.d1, m.dateMonthDay); K.text(R.d2, m.dateDow);

    // 날씨
    var w = m.weather;
    K.hide(R.wx, !w); K.hide(R.wNone, !!w);
    K.text(R.wLab, w ? m.L.weather + ' · ' + w.place : m.L.weather);
    if (w) {
      K.text(R.wT, K.temp(w.tempC)); K.text(R.wL, w.label); K.text(R.wH, K.temp(w.hiC) + ' / ' + K.temp(w.loC));
      K.hide(R.umb, !w.umbrella); K.hide(R.msk, !w.mask);
    }
    K.text(R.stW, m.status.weather || ''); K.hide(R.stW, !m.status.weather);
    K.text(R.stC, m.status.calendar || ''); K.hide(R.stC, !m.status.calendar);
    K.text(R.stM, m.status.tasks || ''); K.hide(R.stM, !m.status.tasks);

    // 메모
    var memos = m.memos.slice(0, 4);
    K.pool(R.mm, memos.length, function (par) { var r = K.el('div', 'li', par); return { root: r }; })
      .forEach(function (it, i) { if (memos[i] != null) K.text(it.root, memos[i]); });
    K.hide(R.mNone, memos.length > 0); K.hide(R.mMore, !m.memoMore); K.text(R.mMore, m.L.memoMore);

    // 일정
    var today = m.today.slice(0, 4);
    K.pool(R.ev, today.length, function (par) { var r = K.el('div', 'ev', par); return { root: r, t: K.el('span', 't', r), n: K.el('span', 'n', r) }; })
      .forEach(function (it, i) { var e = today[i]; if (!e) return; K.text(it.t, e.time); K.text(it.n, e.title); K.attr(it.root, 'data-st', e.state); });
    K.hide(R.eNone, today.length > 0); K.hide(R.eMore, !m.todayMore); K.text(R.eMore, m.L.todayMore);

    // 이번 주(내일부터, 일정 있는 날만)
    var wk = m.week.filter(function (x) { return x.first; });
    K.pool(R.wk, wk.length, function (par) { var r = K.el('div', 'wk', par); return { root: r, d: K.el('b', '', r), n: K.el('span', 'n', r), c: K.el('em', '', r) }; })
      .forEach(function (it, i) {
        var x = wk[i]; if (!x) return;
        K.text(it.d, x.dow); K.text(it.n, x.first); K.attr(it.root, 'data-sun', x.isSunday || x.isHoliday);
        K.text(it.c, x.count > 1 ? '+' + (x.count - 1) : ''); K.hide(it.c, x.count < 2);
      });
    K.hide(R.kNone, wk.length > 0);

    // 타이머
    K.timerState(R.tm, R.tn, m.timer, m.now);
    K.text(R.tn, K.timerText(m.timer)); K.text(R.th, K.timerHint(m.timer)); K.hide(R.th, !K.timerHint(m.timer));

    // 바늘: 시·분은 now에서 계산, 초침은 1초마다 짧게 튕김(첫 그림이나 큰 점프는 즉시)
    var sa = K.accum(R.sAng, 'v', an.s * 6), first = !R.ready;
    setHand(R.h, an.h, false); setHand(R.m, an.m, false);
    setHand(R.s, sa.angle, first || sa.delta > 12);
    R.ready = true;

    K.legendLine(R.legend, m);
    K.attr(R.dot, 'data-h', m.health);
  }

  function unmount() { if (stage0) { stage0.classList.remove('theme-' + ID); stage0.textContent = ''; } R = null; stage0 = null; }

  window.ClockThemes = window.ClockThemes || {};
  window.ClockThemes[ID] = { kind: 'analog', mount: mount, render: render, unmount: unmount };
})();
// 개정 기록 | 2026-11-11 | v1 | 시안 a2 이식 | 모델 기반 렌더, 초침 1초 튕김(CSS transition), 변경된 부분만 갱신
// 개정 기록 | 2026-11-11 | v1.3 | 언어 전환: 고정 문구·날짜·'외 n건'을 모델(m.L, m.date*)에서 받음, 테마 이름 제거 | docs/v1.3-i18n-brief.md
