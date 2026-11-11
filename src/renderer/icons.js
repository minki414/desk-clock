// 선 아이콘(굵기 1.6, currentColor)과 테마 공용 도우미.
// 테마 6종이 각자 다른 파일이라 서로 불러 쓸 수 없으므로, 이 파일(항상 먼저 불러옴)에 공용 도우미 ClockKit을 함께 둡니다.
(function () {
  var S = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  var CLOUD = 'M7 14h9.5a3.5 3.5 0 0 0 .3-6.99A5 5 0 0 0 7.2 8 3.1 3.1 0 0 0 7 14z';
  // 사용자 의도 [DESIGN.md 우산·마스크]: 우산·마스크는 시안 common.js의 선 아이콘을 그대로 쓴다.
  // 개발 판단: 날씨 아이콘 5종은 같은 굵기·둥근 끝으로 맞춰 어느 테마에서도 한 벌처럼 보이게 한다.
  window.ClockIcons = {
    umbrella: S + '<path d="M3 12a9 9 0 0 1 18 0z"/><path d="M12 12v6.5a2 2 0 0 1-4 0"/><path d="M12 3v0"/></svg>',
    mask: S + '<path d="M5 8.5c4-1.6 10-1.6 14 0v4.5c0 3-3.5 5-7 5s-7-2-7-5z"/><path d="M5 10H3.2a1.2 1.2 0 0 0 0 4.4L5.6 15M19 10h1.8a1.2 1.2 0 0 1 0 4.4L18.4 15"/><path d="M8.5 11h7M8.5 13.5h7"/></svg>',
    cloud: S + '<path d="M7 18.5h10a4 4 0 0 0 .4-7.98A5.6 5.6 0 0 0 6.9 9.6 4.5 4.5 0 0 0 7 18.5z"/></svg>',
    sun: S + '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/></svg>',
    rain: S + '<path d="' + CLOUD + '"/><path d="M8 17.5l-1 3M12.5 17.5l-1 3M17 17.5l-1 3"/></svg>',
    snow: S + '<path d="' + CLOUD + '"/><path d="M8 18v.01M12 20v.01M16 18v.01M10 21.5v.01M14 21.5v.01"/></svg>',
    fog: S + '<path d="M7 11h9.5a3.5 3.5 0 0 0 .3-6.99A5 5 0 0 0 7.2 5 3.1 3.1 0 0 0 7 11z" transform="translate(0 1)"/><path d="M5 16h14M8 19.5h11"/></svg>'
  };

  var NS = 'http://www.w3.org/2000/svg';
  function pad(n) { return n < 10 ? '0' + n : String(n); }

  window.ClockKit = {
    // DOM 만들기. 일정 제목 같은 외부 문자열은 반드시 textContent로만 넣는다(innerHTML 금지).
    el: function (tag, cls, parent, text) {
      var e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text != null) e.textContent = text;
      if (parent) parent.appendChild(e);
      return e;
    },
    svg: function (tag, attrs, parent) {
      var e = document.createElementNS(NS, tag);
      for (var k in attrs) e.setAttribute(k, attrs[k]);
      if (parent) parent.appendChild(e);
      return e;
    },
    // 값이 바뀐 때만 DOM을 건드린다.
    text: function (n, t) { t = String(t); if (n._t !== t) { n._t = t; n.textContent = t; } },
    attr: function (n, k, v) { v = String(v); if (n['_a' + k] !== v) { n['_a' + k] = v; n.setAttribute(k, v); } },
    style: function (n, k, v) { if (n['_s' + k] !== v) { n['_s' + k] = v; n.style[k] = v; } },
    cls: function (n, name, on) { on = !!on; if (n['_c' + name] !== on) { n['_c' + name] = on; n.classList.toggle(name, on); } },
    hide: function (n, off) { off = !!off; if (n._h !== off) { n._h = off; n.hidden = off; } },
    // 목록 칸 풀: n개만 보이고 나머지는 숨김. make(parent)는 {root,…}를 돌려준다.
    pool: function (parent, n, make) {
      var a = parent._pool || (parent._pool = []);
      while (a.length < n) a.push(make(parent));
      for (var i = 0; i < a.length; i++) window.ClockKit.hide(a[i].root, i >= n);
      return a;
    },
    two: pad,
    parts: function (d) {
      return { hh: pad(d.getHours()), mm: pad(d.getMinutes()), ss: pad(d.getSeconds()),
        mon: d.getMonth() + 1, day: d.getDate() };   // 요일·날짜 글자는 언어별이라 model.date* 가 줌
    },
    // 시·분 바늘 각도(분침은 초 단위로 미세 이동)
    angles: function (d) {
      var h = d.getHours() % 12, m = d.getMinutes(), s = d.getSeconds();
      return { h: Math.round((h * 30 + m / 2 + s / 120) * 100) / 100, m: Math.round((m * 6 + s / 10) * 100) / 100, s: s, ms: d.getMilliseconds() };
    },
    temp: function (n) { return (n < 0 ? '−' + (-n) : String(n)) + '°'; },
    // 타이머에 보일 글자(입력 중엔 입력값, 진행 중엔 남은 시간)
    timerText: function (t) {
      if (t.phase === 'input') return t.input || '0.00';
      var s = t.phase === 'ringing' ? 0 : Math.ceil(Math.max(0, t.remainingMs) / 1000);
      var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60;
      return h ? h + ':' + pad(m) + ':' + pad(ss) : m + ':' + pad(ss);
    },
    // 안내 글(입력 해석·일시정지·시간 종료)은 핵심 앱이 언어에 맞춰 model.timer.hint 로 줌
    timerHint: function (t) { return t.hint || ''; },
    // 타이머 상태 클래스(t-hidden/input/running/paused/ringing)와 무효 입력 흔들림(0.4초)
    timerState: function (box, shakeEl, t, now) {
      var K = window.ClockKit, ph = ['hidden', 'input', 'running', 'paused', 'ringing'];
      for (var i = 0; i < ph.length; i++) K.cls(box, 't-' + ph[i], t.phase === ph[i]);
      if (t.invalidAt && shakeEl._inv !== t.invalidAt) {
        shakeEl._inv = t.invalidAt;
        var d = now.getTime() - t.invalidAt;
        if (d >= -150 && d < 400) {
          shakeEl.classList.remove('shake'); void shakeEl.offsetWidth; shakeEl.classList.add('shake');
          shakeEl.addEventListener('animationend', function f() { shakeEl.classList.remove('shake'); shakeEl.removeEventListener('animationend', f); });
        }
      }
    },
    // 오늘의 '다음/진행 중' 일정 하나
    nextEvent: function (today) {
      for (var i = 0; i < today.length; i++) if (today[i].state === 'next' || today[i].state === 'now') return today[i];
      return null;
    },
    // 단축키 안내 한 줄: "1 유튜브 · 2 LP Lounge · 0 시계 · T 타이머". 바뀔 때만 다시 만든다.
    legendLine: function (host, model) {
      var K = window.ClockKit, sig = model.legend.map(function (l) { return l.key + '\u0001' + l.name; }).join('\u0002');
      if (host._sig !== sig) {
        host._sig = sig; host.textContent = '';
        model.legend.forEach(function (l, i) {
          if (i) K.el('i', 'sep', host, '·');
          var s = K.el('span', 'lg', host); K.el('b', '', s, l.key); s.appendChild(document.createTextNode(' ' + l.name));
        });
      }
      K.cls(host, 'off', !model.hotkeysOn);
    },
    // 초침 누적 각도(뒤로 감기지 않게)
    accum: function (obj, key, deg) {
      var cur = obj[key] || 0, delta = (((deg - cur) % 360) + 360) % 360;
      obj[key] = cur + delta;
      return { angle: cur + delta, delta: delta };
    }
  };
})();
// 개정 기록 | 2026-11-11 | v1 | 아이콘 7종 + 테마 공용 도우미(ClockKit) 신설 | 테마가 서로 불러 쓸 수 없어 먼저 불러오는 이 파일에 모음
// 개정 기록 | 2026-11-11 | v1.3 | 요일 배열·날씨 문구 정규식 제거, timerHint 는 model.timer.hint 사용 | docs/v1.3-i18n-brief.md
