// D1 리시버. 정본 시안 d1-receiver.html. 형광표시관은 값만 바뀐다(움직임 없음).
(function () {
  var K = window.ClockKit, I = window.ClockIcons, ID = 'receiver', R = null, stage0 = null;
  var KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'T'];

  function mount(stage) {
    stage0 = stage; stage.classList.add('theme-' + ID); stage.textContent = '';
    R = {};
    var unit = K.el('div', 'unit', stage); K.el('div', 'cheek', unit);
    var face = K.el('div', 'face', unit); K.el('div', 'cheek', unit);
    var glass = K.el('div', 'glass', face);
    var tm = K.el('div', 'time vfd', glass);
    K.el('span', 'g', tm, '88:88'); R.hm = K.el('span', '', tm);
    var sup = K.el('sup', '', tm); K.el('span', 'g', sup, '88'); R.ss = K.el('span', '', sup);

    var side = K.el('div', 'side vfd', glass), d = K.el('div', 'd', side);
    R.date = K.el('span', '', d); R.dow = K.el('small', '', d);
    var wb = K.el('div', 'wbox', side), w = K.el('div', 'w', wb), ic = K.el('div', 'ic', w);
    R.umb = K.el('span', '', ic); R.umb.innerHTML = I.umbrella; R.umb.title = '우산 챙기기';
    R.msk = K.el('span', '', ic); R.msk.innerHTML = I.mask; R.msk.title = '마스크 챙기기';
    R.wL = K.el('span', 'lbl', w); R.wS = K.el('span', 'sub', w); R.wNone = K.el('span', 'lbl', w, '날씨 정보 없음');
    R.stW = K.el('div', 'wst', wb);
    R.tm = K.el('div', 'tm t-hidden', side); K.el('i', '', R.tm); K.el('span', '', R.tm, '타이머'); R.tn = K.el('b', '', R.tm); R.th = K.el('div', 'th', R.tm);

    var mid = K.el('div', 'mid', face), w1 = K.el('div', 'win', mid), w2 = K.el('div', 'win', mid);
    var l1 = K.el('div', 'lab', w1); K.el('span', '', l1, '오늘'); R.stC = K.el('span', 'st', l1);
    R.ev = K.el('div', '', w1); R.eMore = K.el('div', 'more', w1); R.eNone = K.el('div', 'none', w1, '일정 없음');
    R.wk = K.el('div', 'week', w1);
    var l2 = K.el('div', 'lab', w2); K.el('span', '', l2, '메모'); R.stM = K.el('span', 'st', l2);
    R.mm = K.el('div', 'mm', w2); R.mMore = K.el('div', 'more', w2); R.mNone = K.el('div', 'none', w2, '메모 없음');

    R.presets = K.el('div', 'presets', face);
    R.keys = {};
    KEYS.forEach(function (k) {
      var c = K.el('div', 'key' + (k === '0' ? ' home' : '') + (k === 'T' ? ' tkey' : ''), R.presets);
      K.el('b', '', c, k); R.keys[k] = { root: c, name: K.el('span', '', c) };
    });
    R.dot = K.el('i', 'dot', stage);
    R.wkCells = K.pool(R.wk, 7, function (par) { var c = K.el('div', '', par); K.el('i', 'lamp', c); return { root: c, d: K.el('span', '', c) }; });
  }

  function render(m) {
    if (!R) return;
    var p = K.parts(m.now), w = m.weather;
    K.text(R.hm, p.hh + ':' + p.mm); K.text(R.ss, p.ss);
    K.text(R.date, p.mon + '.' + p.day); K.text(R.dow, p.dow);

    K.hide(R.wL, !w); K.hide(R.wS, !w); K.hide(R.wNone, !!w);
    if (w) { K.text(R.wL, w.label + ' ' + K.temp(w.tempC)); K.text(R.wS, K.temp(w.hiC) + ' / ' + K.temp(w.loC)); }
    K.hide(R.umb, !(w && w.umbrella)); K.hide(R.msk, !(w && w.mask));
    K.hide(R.umb.parentNode, !(w && (w.umbrella || w.mask)));
    K.text(R.stW, m.status.weather || ''); K.hide(R.stW, !m.status.weather);
    K.text(R.stC, m.status.calendar || ''); K.hide(R.stC, !m.status.calendar);
    K.text(R.stM, m.status.tasks || ''); K.hide(R.stM, !m.status.tasks);

    var today = m.today.slice(0, 4);
    K.pool(R.ev, today.length, function (par) { var r = K.el('div', 'ev vfd', par); return { root: r, t: K.el('span', 't', r), n: K.el('span', 'n', r) }; })
      .forEach(function (it, i) {
        var e = today[i]; if (!e) return;
        K.text(it.t, e.time); K.cls(it.t, 'ad', !/^\d/.test(e.time)); K.text(it.n, e.title); K.attr(it.root, 'data-st', e.state);
      });
    K.hide(R.eNone, today.length > 0); K.hide(R.eMore, !m.todayMore); K.text(R.eMore, '외 ' + m.todayMore + '건');

    for (var i = 0; i < 7; i++) {
      var c = R.wkCells[i], x = m.week[i]; K.hide(c.root, !x); if (!x) continue;
      K.text(c.d, x.dow); K.attr(c.root, 'data-has', !!x.first); K.attr(c.root, 'data-sun', x.isSunday || x.isHoliday);
      K.attr(c.root, 'title', x.first ? x.first + (x.count > 1 ? ' 외 ' + (x.count - 1) + '건' : '') : '');
    }

    var memos = m.memos.slice(0, 4);
    K.pool(R.mm, memos.length, function (par) { return { root: K.el('div', 'li vfd', par) }; }).forEach(function (it, j) { if (memos[j] != null) K.text(it.root, memos[j]); });
    K.hide(R.mNone, memos.length > 0); K.hide(R.mMore, !m.memoMore); K.text(R.mMore, '외 ' + m.memoMore + '건');

    K.timerState(R.tm, R.tn, m.timer, m.now);
    K.text(R.tn, K.timerText(m.timer)); K.text(R.th, K.timerHint(m.timer)); K.hide(R.th, !K.timerHint(m.timer));

    // 프리셋 버튼: 라벨은 legend(설정 슬롯 이름), 눌린 키는 0.2초 동안 pressedKey로 온다.
    var names = {}; m.legend.forEach(function (l) { names[l.key] = l.name; });
    KEYS.forEach(function (k) { K.text(R.keys[k].name, names[k] || '—'); K.cls(R.keys[k].root, 'pressed', m.pressedKey === k); });
    K.cls(R.presets, 'off', !m.hotkeysOn);
    K.attr(R.dot, 'data-h', m.health);
  }

  function unmount() { if (stage0) { stage0.classList.remove('theme-' + ID); stage0.textContent = ''; } R = null; stage0 = null; }

  window.ClockThemes = window.ClockThemes || {};
  window.ClockThemes[ID] = { name: '리시버', kind: 'digital', mount: mount, render: render, unmount: unmount };
})();
// 개정 기록 | 2026-11-11 | v1 | 시안 d1 이식 | 프리셋 버튼 라벨=legend, pressedKey 눌림, 'T 타이머' 키 추가, 값만 바뀌는 형광표시관
