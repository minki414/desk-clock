// 렌더러 진입점: 상태 모델 조립, 1초 렌더 루프, 테마 마운트, 키 연결, 알림음.
(function () {
  const api = window.clockApi;
  const { statusText } = window.ClockLabels;
  const P = window.ClockTimerParse, K = window.ClockKeys, M = window.ClockModel;
  const stage = document.getElementById('stage');
  const $ = (id) => document.getElementById(id);

  let S = null;                       // 설정(메인이 정본)
  let D = { weather: null, events: [], tasks: [], sync: {}, health: 'ok', dimOverlay: 0 };
  let T = { phase: 'idle', endAt: 0, remainingMs: 0, totalMs: 0 };   // 메인 타이머 스냅샷
  let ks = K.initial();
  let invalidAt = 0, pressed = null, theme = null, themeId = null, settings = null;

  // 테마 스크립트가 없을 때도 앱이 돌도록 하는 최소 글자 렌더러
  const plain = {
    name: '기본', kind: 'digital',
    mount(el) { el.className = 'theme-plain'; el.style.cssText = 'background:#111;color:#eee;font:28px sans-serif;padding:60px;white-space:pre-line'; },
    render(m) {
      const w = m.weather ? `${m.weather.place} ${m.weather.tempC}° ${m.weather.label}` : '날씨 정보 없음';
      const t = m.timer.phase === 'hidden' ? '' : `\n타이머 ${m.timer.input || Math.ceil(m.timer.remainingMs / 1000) + '초'}`;
      stage.textContent = `${m.now.toLocaleTimeString('ko-KR')}\n${w}${t}\n${m.today.map((e) => `${e.time} ${e.title}`).join('\n') || '일정 없음'}\n${m.memos.join(' · ') || '메모 없음'}`;
    },
    unmount() {},
  };

  // 높이는 900 고정, 너비는 화면 비율에 맞춰 1200~1800 안에서 가변(16:10→1440, 16:9→1600, 3:2→1350).
  // 올림(ceil)이라 반올림 오차로 가장자리에 1px 띠가 생기지 않고, 넘친 부분은 body가 잘라 냄.
  function fit() {
    const raw = 900 * innerWidth / innerHeight;
    const W = Math.max(1200, Math.min(1800, Math.ceil(raw)));
    const inRange = raw >= 1200 && raw <= 1800;
    const s = inRange ? innerHeight / 900 : Math.min(innerHeight / 900, innerWidth / W);   // 극단 비율만 남는 여백을 바탕색으로 채움
    stage.style.width = `${W}px`;
    stage.style.setProperty('--stage-w', `${W}px`);
    stage.style.transform = `translate(${-W / 2 * s}px, ${-450 * s}px) scale(${s})`;
  }

  // 여백(레터박스)을 테마 바탕색으로 채움. 테마가 색을 2초에 걸쳐 바꾸므로 끝난 뒤 한 번 더 읽음
  function syncBg() {
    const c = getComputedStyle(stage).backgroundColor;
    document.body.style.backgroundColor = c && c !== 'rgba(0, 0, 0, 0)' ? c : '#000';
  }

  function mountTheme() {
    if (theme) { try { theme.unmount(); } catch {} }
    stage.innerHTML = ''; stage.className = ''; stage.removeAttribute('style');
    theme = (window.ClockThemes || {})[S.theme] || plain;
    themeId = S.theme;
    theme.mount(stage);
    stage.dataset.mode = '';
    fit();   // 위에서 style을 지웠으므로 배율을 다시 입힘
    syncBg();
  }

  function timerModel() {
    const phase = ks.phase;
    let remainingMs = 0;
    if (T.phase === 'running') remainingMs = Math.max(0, T.endAt - Date.now());
    else if (T.phase === 'paused') remainingMs = T.remainingMs;
    return {
      phase, input: phase === 'input' ? ks.input || '0.00' : '', hint: phase === 'input' ? P.parse(ks.input).hint : '',
      invalidAt, remainingMs, totalMs: T.totalMs,
    };
  }

  function buildModel(now, mode) {
    return {
      now, mode, weather: D.weather,
      ...M.buildToday(D.events, now), week: M.buildWeek(D.events, now), ...M.buildMemos(D.tasks),
      timer: timerModel(), legend: M.buildLegend(S.slots), hotkeysOn: S.hotkeysOn, pressedKey: pressed,
      status: { calendar: statusText('calendar', D.sync.calendar), tasks: statusText('tasks', D.sync.tasks), weather: statusText('weather', D.sync.weather) },
      health: D.health,
    };
  }

  function render() {
    if (!S) return;
    if (themeId !== S.theme) mountTheme();
    const now = new Date();
    const mode = M.effectiveMode(now, S);
    if (stage.dataset.mode !== mode) { stage.dataset.mode = mode; syncBg(); setTimeout(syncBg, 2100); }
    $('dim').style.opacity = D.dimOverlay || 0;
    theme.render(buildModel(now, mode));
  }

  // 초 경계에 맞춰 1초 1회
  function loop() {
    render();
    setTimeout(loop, 1000 - (Date.now() % 1000) + 15);
  }

  // ----- 알림음(Web Audio 합성, 2초마다 반복) -----
  let ctx = null, ringTimer = null;
  function chime() {
    [659.25, 783.99, 1046.5].forEach((f, i) => {
      const t0 = ctx.currentTime + i * 0.22;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
      o.connect(g).connect(ctx.destination);
      o.start(t0); o.stop(t0 + 1);
    });
  }
  function syncRing() {
    const want = ks.phase === 'ringing';
    if (want && !ringTimer) { ctx = ctx || new AudioContext(); chime(); ringTimer = setInterval(chime, 2000); }
    if (!want && ringTimer) { clearInterval(ringTimer); ringTimer = null; }
  }

  // ----- 키 -----
  function run(a) {
    if (a.type === 'timer.start') api.timerStart(a.ms);
    else if (a.type === 'timer.pause') api.timerPause();
    else if (a.type === 'timer.resume') api.timerResume();
    else if (a.type === 'timer.cancel') api.timerCancel();
    else if (a.type === 'timer.invalid') invalidAt = Date.now();
    else if (a.type === 'launch') {
      pressed = String(a.slot);
      setTimeout(() => { pressed = null; render(); }, 200);   // 0.2초 눌림 표시
      api.launch(a.slot);
    } else if (a.type === 'settings.close') settings && settings.close();
  }
  function handleKey(k) {
    const r = K.route(ks, k);
    const handled = r.state !== ks || r.actions.length > 0;
    ks = r.state;
    r.actions.forEach(run);
    if (handled) { syncRing(); render(); }
    return handled;
  }
  document.addEventListener('keydown', (e) => {
    if (handleKey({ code: e.code, repeat: e.repeat, ctrl: e.ctrlKey, alt: e.altKey, meta: e.metaKey, t: Date.now() })) e.preventDefault();
  });
  api.onKey((code) => handleKey({ code, t: Date.now() }));   // 전역 0번(메인이 전달)

  // ----- 마우스: 커서와 톱니를 3초만 보임 -----
  let awakeT = null;
  document.addEventListener('mousemove', () => {
    document.body.classList.add('awake');
    clearTimeout(awakeT);
    awakeT = setTimeout(() => document.body.classList.remove('awake'), 3000);
  });

  // ----- 메인에서 오는 갱신 -----
  api.onData((d) => { D = d; render(); });
  api.onTimer((s) => {
    T = s;
    if (s.phase !== 'idle') ks = { ...ks, phase: s.phase };
    else if (['running', 'paused', 'ringing'].includes(ks.phase)) ks = { ...ks, phase: 'hidden', input: '' };
    syncRing(); render();
  });
  api.onSettings((s) => applySettings(s));
  let toastT = null;
  api.onToast((text) => {
    $('toast').textContent = text; $('toast').classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => $('toast').classList.remove('on'), 3000);
  });

  function applySettings(s) {
    S = s;
    ks = { ...ks, hotkeysOn: s.hotkeysOn };
    if (settings) settings.update(s, D);
    render();
  }

  window.addEventListener('resize', fit);
  fit();
  api.init().then((init) => {
    D = init.data; T = init.timer;
    if (window.ClockSettings) {
      settings = window.ClockSettings.create({
        api, root: $('drawer'), scrim: $('scrim'),
        onToggle: (open) => { ks = { ...ks, settingsOpen: open }; api.drawer(open); document.body.classList.toggle('drawer-open', open); },
      });
      $('gear').addEventListener('click', () => settings.open());
    }
    applySettings(init.settings);
    loop();
  });
})();
// 개정 기록 | 2026-11-11 | 최초 작성 | 설계서 §2·§3·§9: 초 경계 정렬 렌더, 테마 계약 모델
// 개정 기록 | 2026-11-11 | v1.2 | fit(): 스테이지 너비를 화면 비율로 가변(1200~1800) | docs/v1.2-brief.md §1
