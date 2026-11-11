// A1 섹터 다이얼. 정본 시안 a1-sector.html. 시·분 바늘 폭 7·5, 갈색 그라디언트(다크는 구리색), 스몰 세컨즈 1초 이동.
(function () {
  var K = window.ClockKit, I = window.ClockIcons, ID = 'sector', R = null, stage0 = null;

  function P(r, deg, cx, cy) { var a = (deg - 90) * Math.PI / 180; return [(cx || 300) + r * Math.cos(a), (cy || 300) + r * Math.sin(a)]; }
  function f2(n) { return n.toFixed(2); }
  function layer(parent, cls) { return K.svg('svg', { class: cls, viewBox: '0 0 600 600' }, parent); }
  function sword(len, w) {
    var c = 300;
    return 'M' + c + ' ' + (c + len * .18) + ' L' + (c - w) + ' ' + c + ' L' + f2(c - w * .55) + ' ' + f2(c - len * .82) + ' L' + c + ' ' + (c - len) +
      ' L' + f2(c + w * .55) + ' ' + f2(c - len * .82) + ' L' + (c + w) + ' ' + c + ' Z';
  }
  function h4(parent, label) {
    var e = K.el('h4', '', parent); K.el('span', '', e, label);
    return { root: e, st: K.el('span', 'st', e) };
  }

  function mount(stage) {
    stage0 = stage; stage.classList.add('theme-' + ID); stage.textContent = '';
    R = { sAng: {} };
    var L = K.el('div', 'l', stage), dial = K.el('div', 'dial', L); K.el('div', 'sh', dial);
    var f = layer(dial, 'face'), defs = K.svg('defs', {}, f);
    var g = K.svg('linearGradient', { id: 'sc-brown', x1: 0, x2: 1, y1: 0, y2: 0 }, defs);
    K.svg('stop', { offset: 0, class: 'sc-g1' }, g); K.svg('stop', { offset: .5, class: 'sc-g2' }, g); K.svg('stop', { offset: 1, class: 'sc-g3' }, g);
    K.svg('circle', { cx: 300, cy: 300, r: 296, class: 'caseOut' }, f);
    K.svg('circle', { cx: 300, cy: 300, r: 290, class: 'caseIn' }, f);
    K.svg('circle', { cx: 300, cy: 300, r: 282, class: 'ringBg' }, f);
    K.svg('circle', { cx: 300, cy: 300, r: 276, class: 'ln', 'stroke-width': 1.2 }, f);
    K.svg('circle', { cx: 300, cy: 300, r: 258, class: 'ln', 'stroke-width': 1.2 }, f);
    // 바깥 분 트랙(철로): 300칸을 굵기별 세 개 경로로
    var big = '', mid = '', sm = '', i, a, b, q;
    for (i = 0; i < 300; i++) {
      var ang = i * 1.2, isBig = i % 25 === 0, isMid = i % 5 === 0;
      a = P(258, ang); b = P(isBig ? 276 : isMid ? 272 : 266, ang);
      q = 'M' + f2(a[0]) + ' ' + f2(a[1]) + 'L' + f2(b[0]) + ' ' + f2(b[1]);
      if (isBig) big += q; else if (isMid) mid += q; else sm += q;
    }
    K.svg('path', { d: sm, class: 'ln', 'stroke-width': .5 }, f);
    K.svg('path', { d: mid, class: 'ln', 'stroke-width': 1.1 }, f);
    K.svg('path', { d: big, class: 'ln', 'stroke-width': 2.2 }, f);
    for (i = 1; i <= 12; i++) { a = P(240, i * 30); var t5 = K.svg('text', { x: f2(a[0]), y: f2(a[1] + 7), class: 'n5' }, f); t5.textContent = (i * 5 < 10 ? '0' : '') + i * 5; }
    K.svg('circle', { cx: 300, cy: 300, r: 222, class: 'bandBg' }, f);
    K.svg('circle', { cx: 300, cy: 300, r: 150, class: 'centerBg' }, f);
    K.svg('circle', { cx: 300, cy: 300, r: 222, class: 'ln', 'stroke-width': 1 }, f);
    K.svg('circle', { cx: 300, cy: 300, r: 150, class: 'ln', 'stroke-width': 1 }, f);
    for (i = 1; i <= 12; i++) { a = P(186, i * 30); var t12 = K.svg('text', { x: f2(a[0]), y: f2(a[1] + 19), class: 'n12' }, f); t12.textContent = i; }
    var rings = ''; for (var r = 20; r < 150; r += 6) rings += 'M' + (300 - r) + ' 300a' + r + ' ' + r + ' 0 1 0 ' + 2 * r + ' 0a' + r + ' ' + r + ' 0 1 0 ' + (-2 * r) + ' 0';
    K.svg('path', { d: rings, class: 'ctr' }, f);
    // 스몰 세컨즈(6시)
    K.svg('circle', { cx: 300, cy: 388, r: 46, class: 'sdialBg' }, f);
    K.svg('circle', { cx: 300, cy: 388, r: 46, class: 'ln', 'stroke-width': 1 }, f);
    var s1 = '', s5 = '';
    for (i = 0; i < 60; i++) { a = P(i % 5 ? 40 : 36, i * 6, 300, 388); b = P(44, i * 6, 300, 388); q = 'M' + f2(a[0]) + ' ' + f2(a[1]) + 'L' + f2(b[0]) + ' ' + f2(b[1]); if (i % 5) s1 += q; else s5 += q; }
    K.svg('path', { d: s1, class: 'ln', 'stroke-width': .6 }, f); K.svg('path', { d: s5, class: 'ln', 'stroke-width': 1.4 }, f);

    var sh = layer(dial, 'hand s'); K.svg('line', { x1: 300, y1: 396, x2: 300, y2: 348 }, sh); K.svg('circle', { cx: 300, cy: 388, r: 3 }, sh); R.s = sh;
    var hh = layer(dial, 'hand h'); K.svg('path', { d: sword(132, 7) }, hh); R.h = hh;
    var mh = layer(dial, 'hand m'); K.svg('path', { d: sword(250, 5) }, mh); R.m = mh;
    var cap = layer(dial, 'cap'); K.svg('circle', { cx: 300, cy: 300, r: 8, class: 'cap1' }, cap); K.svg('circle', { cx: 300, cy: 300, r: 3, class: 'cap2' }, cap);

    R.tm = K.el('div', 'tm t-hidden', L); K.el('em', '', R.tm); K.el('i', '', R.tm, '타이머'); R.tn = K.el('b', '', R.tm); R.th = K.el('div', 'th', R.tm);
    R.legend = K.el('div', 'legend', stage);

    // 오른쪽 열
    var Rt = K.el('div', 'r', stage), dt = K.el('div', 'date', Rt); R.d1 = K.el('span', '', dt); R.d2 = K.el('span', '', dt);
    var ds = K.el('div', 'dsub', Rt); R.wT = K.el('b', '', ds); R.wL = K.el('span', 'wl', ds);
    R.wP = K.el('span', 'wp', ds);
    var fl = K.el('div', 'fl', ds);
    R.umb = K.el('span', '', fl); R.umb.innerHTML = I.umbrella; R.umb.title = '우산 챙기기';
    R.msk = K.el('span', '', fl); R.msk.innerHTML = I.mask; R.msk.title = '마스크 챙기기';
    R.wNone = K.el('span', 'none', ds, '날씨 정보 없음'); R.wst = K.el('div', 'wst', Rt);
    var he = h4(Rt, '오늘'); R.stC = he.st; R.ev = K.el('div', '', Rt); R.eMore = K.el('div', 'more', Rt); R.eNone = K.el('div', 'none', Rt, '일정 없음');
    h4(Rt, '이번 주'); R.wk = K.el('div', 'wk', Rt);
    var hm = h4(Rt, '메모'); R.stM = hm.st; var mm = K.el('div', 'memo', Rt); R.mm = mm;
    R.mMore = K.el('div', 'more', Rt); R.mNone = K.el('div', 'none', Rt, '메모 없음');
    R.dot = K.el('i', 'dot', stage);
    // 주(week)는 항상 7칸
    R.wkCells = K.pool(R.wk, 7, function (par) { var c = K.el('div', 'c', par); return { root: c, b: K.el('b', '', c), x: K.el('span', 'x', c) }; });
  }

  function setHand(el, deg, instant) {
    if (el._deg === deg && el._i === instant) return;
    el._deg = deg; el._i = instant;
    el.style.transition = instant ? 'none' : '';
    el.style.transform = 'rotate(' + deg + 'deg)';
  }

  function render(m) {
    if (!R) return;
    var p = K.parts(m.now), an = K.angles(m.now), w = m.weather;
    K.text(R.d1, p.mon + '월 ' + p.day + '일'); K.text(R.d2, p.dow + '요일');

    K.hide(R.wT, !w); K.hide(R.wL, !w); K.hide(R.wP, !w); K.hide(R.wNone, !!w);
    if (w) {
      K.text(R.wT, K.temp(w.tempC)); K.text(R.wL, w.label + ' · 최고 ' + K.temp(w.hiC) + ' 최저 ' + K.temp(w.loC)); K.text(R.wP, w.place);
    }
    K.hide(R.umb, !(w && w.umbrella)); K.hide(R.msk, !(w && w.mask)); K.hide(R.umb.parentNode, !(w && (w.umbrella || w.mask)));
    K.text(R.wst, m.status.weather || ''); K.hide(R.wst, !m.status.weather);
    K.text(R.stC, m.status.calendar || ''); K.hide(R.stC, !m.status.calendar);
    K.text(R.stM, m.status.tasks || ''); K.hide(R.stM, !m.status.tasks);

    var today = m.today.slice(0, 4);
    K.pool(R.ev, today.length, function (par) { var r = K.el('div', 'ev', par); return { root: r, t: K.el('span', 't', r), n: K.el('span', 'n', r), p: K.el('span', 'p', r) }; })
      .forEach(function (it, i) {
        var e = today[i]; if (!e) return;
        K.text(it.t, e.time); K.text(it.n, e.title); K.text(it.p, e.location || ''); K.hide(it.p, !e.location); K.attr(it.root, 'data-st', e.state);
      });
    K.hide(R.eNone, today.length > 0); K.hide(R.eMore, !m.todayMore); K.text(R.eMore, '외 ' + m.todayMore + '건');

    for (var i = 0; i < 7; i++) {
      var it = R.wkCells[i], x = m.week[i]; K.hide(it.root, !x); if (!x) continue;
      K.text(it.b, x.dow); K.text(it.x, x.first ? x.first + (x.count > 1 ? ' +' + (x.count - 1) : '') : ''); K.attr(it.root, 'data-sun', x.isSunday || x.isHoliday);
    }

    var memos = m.memos.slice(0, 4);
    K.pool(R.mm, memos.length, function (par) { return { root: K.el('div', 'li', par) }; }).forEach(function (it, j) { if (memos[j] != null) K.text(it.root, memos[j]); });
    K.hide(R.mNone, memos.length > 0); K.hide(R.mMore, !m.memoMore); K.text(R.mMore, '외 ' + m.memoMore + '건');

    K.timerState(R.tm, R.tn, m.timer, m.now);
    K.text(R.tn, K.timerText(m.timer)); K.text(R.th, K.timerHint(m.timer)); K.hide(R.th, !K.timerHint(m.timer));

    var sa = K.accum(R.sAng, 'v', an.s * 6);
    setHand(R.h, an.h, false); setHand(R.m, an.m, false);
    setHand(R.s, sa.angle, !R.ready || sa.delta > 12);
    R.ready = true;
    K.legendLine(R.legend, m);
    K.attr(R.dot, 'data-h', m.health);
  }

  function unmount() { if (stage0) { stage0.classList.remove('theme-' + ID); stage0.textContent = ''; } R = null; stage0 = null; }

  window.ClockThemes = window.ClockThemes || {};
  window.ClockThemes[ID] = { name: '섹터 다이얼', kind: 'analog', mount: mount, render: render, unmount: unmount };
})();
// 개정 기록 | 2026-11-11 | v1 | 시안 a1 이식 | 시 7·분 5 가는 바늘, 갈색 #6b3e1f→#3d2210(다크 구리 #b8743f), 스몰 세컨즈 1초 이동
