// A4 네이비 다이얼. 정본 시안 a4-navy.html. 초침은 CSS linear 60초 연속 회전(JS는 시작 위상만 맞춤).
(function () {
  var K = window.ClockKit, I = window.ClockIcons, ID = 'navy', R = null, stage0 = null;

  function P(r, deg) { var a = (deg - 90) * Math.PI / 180; return [300 + r * Math.cos(a), 300 + r * Math.sin(a)]; }
  function f2(n) { return n.toFixed(2); }
  function layer(parent, cls) { return K.svg('svg', { class: cls, viewBox: '0 0 600 600' }, parent); }
  function grad(defs, id, stops) {
    var g = K.svg('linearGradient', { id: id, x1: 0, x2: 1 }, defs);
    stops.forEach(function (s) { K.svg('stop', { offset: s[0], class: s[1] }, g); });
  }
  function dauphine(svg, len, w) {
    var c = 300;
    K.svg('path', { d: 'M' + c + ' ' + (c - len) + ' L' + (c - w) + ' ' + (c - 18) + ' L' + c + ' ' + (c + 22) + ' Z', fill: 'url(#nv-fL)' }, svg);
    K.svg('path', { d: 'M' + c + ' ' + (c - len) + ' L' + (c + w) + ' ' + (c - 18) + ' L' + c + ' ' + (c + 22) + ' Z', fill: 'url(#nv-fR)' }, svg);
    K.svg('path', { d: 'M' + c + ' ' + (c - len + 30) + ' L' + f2(c - w * .38) + ' ' + f2(c - len * .45) + ' L' + c + ' ' + f2(c - len * .38) + ' Z', class: 'hlume' }, svg);
  }

  function mount(stage) {
    stage0 = stage; stage.classList.add('theme-' + ID); stage.textContent = '';
    R = { sAng: {} };
    var L = K.el('div', 'l', stage), cs = K.el('div', 'case', L), dial = K.el('div', 'dial', cs);
    var f = layer(dial, 'face'), defs = K.svg('defs', {}, f);
    grad(defs, 'nv-steel', [[0, 'g-steel1'], [.45, 'g-steel2'], [.55, 'g-steel3'], [1, 'g-steel4']]);
    grad(defs, 'nv-fL', [[0, 'g-fl1'], [1, 'g-fl2']]);
    grad(defs, 'nv-fR', [[0, 'g-fr1'], [1, 'g-fr2']]);
    // 분 눈금(5분 자리는 인덱스가 대신함)
    var d = '', i, a, b;
    for (i = 0; i < 60; i++) { if (i % 5 === 0) continue; a = P(268, i * 6); b = P(276, i * 6); d += 'M' + f2(a[0]) + ' ' + f2(a[1]) + 'L' + f2(b[0]) + ' ' + f2(b[1]); }
    K.svg('path', { d: d, class: 'tick' }, f);
    // 인덱스 12개(3시는 날짜 창, 12시는 쌍)
    for (i = 0; i < 12; i++) {
      if (i === 3) continue;
      var w = i === 0 ? 9 : 11, len = i % 3 === 0 ? 62 : 52, xs = i === 0 ? [-11, 11] : [0];
      var g = K.svg('g', { transform: 'rotate(' + i * 30 + ' 300 300)' }, f);
      xs.forEach(function (dx) {
        K.svg('rect', { x: 300 + dx - w / 2, y: 28, width: w, height: len, rx: 1.5, fill: 'url(#nv-steel)' }, g);
        K.svg('rect', { x: 300 + dx - w / 2 + 3, y: 34, width: w - 6, height: len - 24, rx: 1, class: 'idxLume' }, g);
      });
    }
    K.svg('rect', { x: 496, y: 276, width: 62, height: 48, rx: 3, class: 'dwin' }, f);
    R.dnum = K.svg('text', { x: 527, y: 314, class: 'dnum' }, f);

    var hh = layer(dial, 'hand h'); dauphine(hh, 165, 15); R.h = hh;
    var mh = layer(dial, 'hand m'); dauphine(mh, 250, 12); R.m = mh;
    var sh = layer(dial, 'hand s'); K.svg('line', { x1: 300, y1: 360, x2: 300, y2: 38 }, sh); R.s = sh;
    var cp = layer(dial, 'capL'); K.svg('circle', { cx: 300, cy: 300, r: 11, fill: 'url(#nv-steel)' }, cp); K.svg('circle', { cx: 300, cy: 300, r: 3.5, class: 'pin' }, cp);

    R.tm = K.el('div', 'tm t-hidden', L); R.lTimer = K.el('small', '', R.tm); R.tn = K.el('b', '', R.tm); R.th = K.el('div', 'th', R.tm);
    R.legend = K.el('div', 'legend', stage);

    var Rt = K.el('div', 'r', stage), dt = K.el('div', 'date', Rt); R.d1 = K.el('span', '', dt); R.d2 = K.el('small', '', dt);
    var wx = K.el('div', 'wx', Rt); R.wT = K.el('b', '', wx); R.wL = K.el('span', 'wl', wx);
    var fl = K.el('div', 'fl', wx);
    R.umb = K.el('span', '', fl); R.umb.innerHTML = I.umbrella; 
    R.msk = K.el('span', '', fl); R.msk.innerHTML = I.mask; 
    R.wNone = K.el('span', '', wx); R.stW = K.el('div', 'st', Rt);
    K.el('div', 'hr', Rt);
    R.stC = K.el('div', 'st', Rt); R.ev = K.el('div', '', Rt); R.eMore = K.el('div', 'more', Rt); R.eNone = K.el('div', 'none', Rt);
    K.el('div', 'hr', Rt);
    R.wk = K.el('div', 'wk', Rt);
    K.el('div', 'hr', Rt);
    R.stM = K.el('div', 'st', Rt); R.mm = K.el('div', 'memo', Rt); R.mMore = K.el('div', 'more', Rt); R.mNone = K.el('div', 'none', Rt);
    R.dot = K.el('i', 'dot', stage);
    R.wkCells = K.pool(R.wk, 7, function (par) { var c = K.el('span', '', par); K.el('i', '', c); return { root: c, d: K.el('em', '', c) }; });
    R.wkCells.forEach(function (c) { c.d.style.fontStyle = 'normal'; });
  }

  function setHand(el, deg) { if (el._deg !== deg) { el._deg = deg; el.style.transform = 'rotate(' + deg + 'deg)'; } }

  // 고정 문구는 모델(m.L)에서 받아 바뀐 때만 갱신(언어 전환 즉시 반영)
  function labels(m) {
    var L = m.L;
    K.text(R.lTimer, L.timer); K.text(R.wNone, L.noWeather); K.text(R.eNone, L.noEvents); K.text(R.mNone, L.noMemos);
    K.attr(R.umb, 'title', L.umbrellaTip); K.attr(R.msk, 'title', L.maskTip);
  }

  function render(m) {
    if (!R) return;
    labels(m);
    var p = K.parts(m.now), an = K.angles(m.now), w = m.weather;
    K.text(R.d1, p.day); K.text(R.d2, m.dateMonth + ' · ' + m.dateDow); K.text(R.dnum, p.day);

    K.hide(R.wT, !w); K.hide(R.wL, !w); K.hide(R.wNone, !!w);
    if (w) { K.text(R.wT, K.temp(w.tempC)); K.text(R.wL, w.label + ' · ' + K.temp(w.hiC) + ' / ' + K.temp(w.loC) + ' · ' + w.place); }
    K.hide(R.umb, !(w && w.umbrella)); K.hide(R.msk, !(w && w.mask)); K.hide(R.umb.parentNode, !(w && (w.umbrella || w.mask)));
    K.text(R.stW, m.status.weather || ''); K.hide(R.stW, !m.status.weather);
    K.text(R.stC, m.status.calendar || ''); K.hide(R.stC, !m.status.calendar);
    K.text(R.stM, m.status.tasks || ''); K.hide(R.stM, !m.status.tasks);

    var today = m.today.slice(0, 4);
    K.pool(R.ev, today.length, function (par) { var r = K.el('div', 'ev', par); return { root: r, t: K.el('span', 't', r), n: K.el('span', 'n', r) }; })
      .forEach(function (it, i) { var e = today[i]; if (!e) return; K.text(it.t, e.time); K.text(it.n, e.title); K.attr(it.root, 'data-st', e.state); });
    K.hide(R.eNone, today.length > 0); K.hide(R.eMore, !m.todayMore); K.text(R.eMore, m.L.todayMore);

    for (var i = 0; i < 7; i++) {
      var c = R.wkCells[i], x = m.week[i]; K.hide(c.root, !x); if (!x) continue;
      K.text(c.d, x.dow); K.attr(c.root, 'data-has', !!x.first); K.attr(c.root, 'data-sun', x.isSunday || x.isHoliday);
      K.attr(c.root, 'title', x.tip);
    }

    var memos = m.memos.slice(0, 4);
    K.pool(R.mm, memos.length, function (par) { return { root: K.el('div', 'li', par) }; }).forEach(function (it, j) { if (memos[j] != null) K.text(it.root, memos[j]); });
    K.hide(R.mNone, memos.length > 0); K.hide(R.mMore, !m.memoMore); K.text(R.mMore, m.L.memoMore);

    K.timerState(R.tm, R.tn, m.timer, m.now);
    K.text(R.tn, K.timerText(m.timer)); K.text(R.th, K.timerHint(m.timer)); K.hide(R.th, !K.timerHint(m.timer));

    setHand(R.h, an.h); setHand(R.m, an.m);
    // 초침: 시작 위상만 맞추고, 시계가 0.7초 넘게 어긋나면 다시 맞춘다(절전 복귀 등).
    var t = m.now.getTime(), pf = performance.now(), sec = (m.now.getSeconds() * 1000 + m.now.getMilliseconds()) / 1000;
    if (R.anchor == null || Math.abs((t - R.anchor.t) - (pf - R.anchor.pf)) > 700) {
      R.anchor = { t: t, pf: pf }; R.s.style.animationDelay = '-' + sec.toFixed(3) + 's';
    }
    K.legendLine(R.legend, m);
    K.attr(R.dot, 'data-h', m.health);
  }

  function unmount() { if (stage0) { stage0.classList.remove('theme-' + ID); stage0.textContent = ''; } R = null; stage0 = null; }

  window.ClockThemes = window.ClockThemes || {};
  window.ClockThemes[ID] = { kind: 'analog', mount: mount, render: render, unmount: unmount };
})();
// 개정 기록 | 2026-11-11 | v1 | 시안 a4 이식 | 초침 CSS linear 60s 연속 회전, 날짜 창 실제 날짜, 라이트판 추가
// 개정 기록 | 2026-11-11 | v1.3 | 언어 전환: 고정 문구·날짜·'외 n건'을 모델(m.L, m.date*)에서 받음, 테마 이름 제거 | docs/v1.3-i18n-brief.md
