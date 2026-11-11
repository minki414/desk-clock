// D2 플립. 정본 시안 d2-flip.html. 분이 바뀔 때 값이 바뀐 카드만 접히고, 나머지는 그대로 둔다.
(function () {
  var K = window.ClockKit, I = window.ClockIcons, ID = 'flip', R = null, stage0 = null;

  // 카드 하나: 새 윗장·새 아랫장(정지) + 옛 아랫장(접히는 0.6초 동안만 보임) + 접히는 잎 두 장
  function makeCard(parent) {
    var c = K.el('div', 'card', parent), o = {};
    function half(cls) { var h = K.el('div', 'h ' + cls, c), n = K.el('div', 'n', h); return { h: h, s: K.el('span', '', n) }; }
    o.nt = half('top'); o.nb = half('bot'); o.ob = half('bot old'); o.la = half('top leaf a'); o.lb = half('bot leaf b');
    K.el('i', 'l', c); K.el('i', 'r', c);
    o.root = c; o.val = null;
    return o;
  }
  function setCard(o, v) {
    if (o.val === v) return;
    var prev = o.val; o.val = v;
    K.text(o.nt.s, v); K.text(o.nb.s, v); K.text(o.lb.s, v);
    if (prev != null) {   // 첫 그림이 아니면 접는다
      K.text(o.ob.s, prev); K.text(o.la.s, prev);
      o.root.classList.remove('flip'); void o.root.offsetWidth; o.root.classList.add('flip');
    }
  }

  function mount(stage) {
    stage0 = stage; stage.classList.add('theme-' + ID); stage.textContent = '';
    R = {};
    var clock = K.el('div', 'clock', stage); R.c1 = makeCard(clock); R.c2 = makeCard(clock);
    R.tm = K.el('div', 'tm t-hidden', stage); R.lTimer = K.el('small', '', R.tm); R.tiles = K.el('div', 'tiles', R.tm); R.th = K.el('div', 'th', R.tm);

    var b = K.el('div', 'board', stage), c1 = K.el('div', 'col', b), c2 = K.el('div', 'col', b), c3 = K.el('div', 'col memo', b);
    function h5(par, label) { var e = K.el('h5', '', par); K.el('span', '', e, label); return K.el('span', 'st', e); }   // 소제목 글자는 st 바로 앞 형제(previousSibling)
    R.stW = h5(c1, ''); R.dt = K.el('div', 'dt', c1);
    var wx = K.el('div', 'wx', c1); R.wT = K.el('b', '', wx); R.wL = K.el('span', 'wl', wx);
    var fl = K.el('div', 'fl', wx);
    R.umb = K.el('span', '', fl); R.umb.innerHTML = I.umbrella; 
    R.msk = K.el('span', '', fl); R.msk.innerHTML = I.mask; 
    R.wNone = K.el('span', '', wx);
    R.stC = h5(c2, ''); R.ev = K.el('div', '', c2); R.eMore = K.el('div', 'more', c2); R.eNone = K.el('div', 'none', c2);
    R.wk = K.el('div', 'wk', c2);
    R.stM = h5(c3, ''); R.mm = K.el('div', '', c3); R.mMore = K.el('div', 'more', c3); R.mNone = K.el('div', 'none', c3);
    R.legend = K.el('div', 'legend', stage); R.dot = K.el('i', 'dot', stage);
    R.wl = K.el('span', 'wl', R.wk);
    R.wkCells = K.pool(R.wk, 7, function (par) { var s = K.el('span', '', par); return { root: s, b: K.el('b', '', s), t: document.createTextNode('') }; });
    R.wkCells.forEach(function (c) { c.root.appendChild(c.t); });
  }

  function timerTiles(text) {
    var tiles = K.pool(R.tiles, text.length, function (par) { var t = K.el('div', 'tile', par); return { root: t }; });
    for (var i = 0; i < text.length; i++) { var ch = text.charAt(i); K.text(tiles[i].root, ch); K.cls(tiles[i].root, 'c', ch === ':' || ch === '.'); }
  }

  // 고정 문구는 모델(m.L)에서 받아 바뀐 때만 갱신(언어 전환 즉시 반영)
  function labels(m) {
    var L = m.L;
    K.text(R.lTimer, L.timer); K.text(R.stW.previousSibling, L.today); K.text(R.stC.previousSibling, L.schedule); K.text(R.stM.previousSibling, L.memo); K.text(R.wl, L.week);
    K.text(R.wNone, L.noWeather); K.text(R.eNone, L.noEvents); K.text(R.mNone, L.noMemos);
    K.attr(R.umb, 'title', L.umbrellaTip); K.attr(R.msk, 'title', L.maskTip);
  }

  function render(m) {
    if (!R) return;
    labels(m);
    var p = K.parts(m.now), w = m.weather;
    setCard(R.c1, p.hh); setCard(R.c2, p.mm);
    K.text(R.dt, m.dateLong);

    K.hide(R.wT, !w); K.hide(R.wL, !w); K.hide(R.wNone, !!w);
    if (w) { K.text(R.wT, K.temp(w.tempC)); K.text(R.wL, w.label + ' ' + K.temp(w.hiC) + '/' + K.temp(w.loC)); }
    K.hide(R.umb, !(w && w.umbrella)); K.hide(R.msk, !(w && w.mask)); K.hide(R.umb.parentNode, !(w && (w.umbrella || w.mask)));
    // 날씨 갱신 상태는 '오늘' 소제목 옆(날씨가 그 칸에 있음)
    K.text(R.stW, m.status.weather || ''); K.hide(R.stW, !m.status.weather);
    K.text(R.stC, m.status.calendar || ''); K.hide(R.stC, !m.status.calendar);
    K.text(R.stM, m.status.tasks || ''); K.hide(R.stM, !m.status.tasks);

    var today = m.today.slice(0, 4);
    K.pool(R.ev, today.length, function (par) { var r = K.el('div', 'row', par); return { root: r, t: K.el('span', 't', r), n: K.el('span', 'n', r) }; })
      .forEach(function (it, i) { var e = today[i]; if (!e) return; K.text(it.t, e.time); K.text(it.n, e.title); K.attr(it.root, 'data-st', e.state); });
    K.hide(R.eNone, today.length > 0); K.hide(R.eMore, !m.todayMore); K.text(R.eMore, m.L.todayMore);

    var any = false;
    for (var i = 0; i < 7; i++) {
      var c = R.wkCells[i], x = m.week[i], on = !!(x && x.first); K.hide(c.root, !on); if (!on) continue; any = true;
      K.text(c.b, x.dow); var t = ' ' + x.first + (x.count > 1 ? ' +' + (x.count - 1) : ''); if (c.t.data !== t) c.t.data = t;
      K.attr(c.root, 'data-sun', x.isSunday || x.isHoliday);
    }
    K.hide(R.wk, !any);

    var memos = m.memos.slice(0, 4);
    K.pool(R.mm, memos.length, function (par) { return { root: K.el('div', 'li', par) }; }).forEach(function (it, j) { if (memos[j] != null) K.text(it.root, memos[j]); });
    K.hide(R.mNone, memos.length > 0); K.hide(R.mMore, !m.memoMore); K.text(R.mMore, m.L.memoMore);

    K.timerState(R.tm, R.tiles, m.timer, m.now);
    timerTiles(K.timerText(m.timer)); K.text(R.th, K.timerHint(m.timer)); K.hide(R.th, !K.timerHint(m.timer));
    K.legendLine(R.legend, m);
    K.attr(R.dot, 'data-h', m.health);
  }

  function unmount() { if (stage0) { stage0.classList.remove('theme-' + ID); stage0.textContent = ''; } R = null; stage0 = null; }

  window.ClockThemes = window.ClockThemes || {};
  window.ClockThemes[ID] = { kind: 'digital', mount: mount, render: render, unmount: unmount };
})();
// 개정 기록 | 2026-11-11 | v1 | 시안 d2 이식 | 분 바뀜 0.6초 접힘(위·아래 반쪽 레이어, 바뀐 카드만), 타이머 타일
// 개정 기록 | 2026-11-11 | v1.3 | 언어 전환: 고정 문구·날짜·'외 n건'을 모델(m.L, m.date*)에서 받음, 테마 이름 제거 | docs/v1.3-i18n-brief.md
