// 설정 서랍(스테이지 바깥). 값을 바꾸면 곧바로 메인에 저장하고(저장 버튼 없음), 열려 있는 동안 단축키는 keys.js가 무시합니다.
// 사용자 의도 [docs/v1.2-brief.md §2]: 식탁 위 시계와 같은 결의 조용한 설정 화면. 탭 4개, 바꾸는 즉시 저장, 저장되면 0.8초 '저장됨'.
// 개발 판단: 컨트롤은 스스로 모양을 바꾸고(스위치·분절 버튼), 서랍 전체 다시 그리기는 탭 전환·열기·바깥 변경 때만 해서 키보드 포커스가 끊기지 않게 한다.
(function () {
  const L = window.ClockLabels;
  const U = L.ui;
  const M = window.ClockModel;

  function create({ api, root, scrim, onToggle }) {
    let S = null, isOpen = false, tab = 'screen', closeToken = 0;
    let lists = null;                  // { calendars, taskLists } | null
    const note = {};                   // 섹션별 짧은 안내(검색 결과 없음 등)
    let places = null;                 // 지명 검색 결과
    let avail = null;                  // 자동 실행 가능 여부(설치본에서만 true)
    let version = '';
    let svStates = [];                 // 감시 서버별 상태(true/false/null)
    let svTimer = null, quitTimer = null, quitArmed = false, svSeq = 0;
    let paintThumbs = () => {};        // 테마 카드 썸네일을 현재 색 모드에 맞춰 다시 칠함

    // 작은 DOM 도우미: 속성은 가능하면 프로퍼티로, 이벤트는 on:{}로
    const h = (tag, attrs = {}, ...kids) => {
      const e = document.createElement(tag);
      for (const [k, v] of Object.entries(attrs)) {
        if (k === 'on') for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn);
        else if (k === 'class') e.className = v;
        else if (k in e) e[k] = v;
        else e.setAttribute(k, v);
      }
      kids.flat().forEach((c) => c != null && c !== false && e.append(c));
      return e;
    };
    const svg = (d) => {
      const w = document.createElement('span');
      w.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="${d}"/></svg>`;
      return w.firstChild;
    };
    // 저장 요청을 연달아 보내도 앞 변경이 사라지지 않게 로컬 값에 먼저 합침(메인과 같은 규칙: 객체는 한 단계만 병합)
    const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
    let ownAt = 0;
    const set = (patch) => {
      ownAt = Date.now();
      S = { ...S, ...Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, isObj(S[k]) && isObj(v) ? { ...S[k], ...v } : v])) };
      return api.setSettings(patch).then((s) => { S = s; ownAt = Date.now(); paintThumbs(); return s; });
    };

    // ----- 컨트롤 -----
    const hint = (t) => (t ? h('p', { class: 'hint', textContent: t }) : null);
    const btn = (text, onClick, cls = '') => h('button', { type: 'button', textContent: text, class: `btn ${cls}`.trim(), on: { click: onClick } });

    // 36×20 스위치: 눌린 모양은 스스로 바꿈
    function toggle(checked, onChange, label, disabled = false) {
      const b = h('button', { type: 'button', class: 'switch', role: 'switch', disabled, 'aria-label': label, 'aria-checked': String(!!checked) });
      b.addEventListener('click', () => {
        const next = b.getAttribute('aria-checked') !== 'true';
        b.setAttribute('aria-checked', String(next));
        onChange(next);
      });
      return b;
    }
    // 분절 버튼(라디오 그룹)
    function seg(opts, value, onChange, label) {
      const g = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
      const paint = (v) => g.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === v)));
      opts.forEach(([v, t]) => g.append(h('button', { type: 'button', role: 'radio', textContent: t, 'data-v': v, on: { click: () => { paint(v); onChange(v); } } })));
      paint(value);
      return g;
    }
    // 글자 입력: 치는 동안 0.35초 쉬면 저장, 포커스를 떠나면 바로 저장
    function text(value, placeholder, onCommit, extra = {}) {
      let t = null, last = value;
      const flush = () => { clearTimeout(t); t = null; if (i.value !== last) { last = i.value; onCommit(i.value.trim()); } };
      const i = h('input', { type: 'text', value, placeholder, spellcheck: false, ...extra, on: { input: () => { clearTimeout(t); t = setTimeout(flush, 350); }, change: flush } });
      return i;
    }
    const check = (label, checked, onChange) => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked, on: { change: (e) => onChange(e.target.checked) } }), h('span', { textContent: label }));

    // 항목: 이름·설명·'저장됨' 표시. make(commit)이 컨트롤을 만들고, commit(patch)은 저장 뒤 0.8초 '저장됨'을 보임
    function field(title, desc, make, { inline = false, cls = '' } = {}) {
      const tag = h('span', { class: 'saved', textContent: U.saved, role: 'status' });
      let t = null;
      const commit = (patch) => set(patch).then((s) => {
        tag.classList.add('on'); clearTimeout(t); t = setTimeout(() => tag.classList.remove('on'), 800);
        return s;
      });
      const head = h('div', { class: 'fh' }, h('div', { class: 'ft' }, h('span', { class: 'fn', textContent: title }), tag), desc ? h('p', { class: 'fd', textContent: desc }) : null);
      const ctrl = make(commit);
      return h('section', { class: `field ${inline ? 'inline' : ''} ${cls}`.trim() }, head, ctrl);
    }

    // ----- 탭: 화면 -----
    function themeCards(commit) {
      const wrap = h('div', { class: 'themes' });
      const cards = L.themes.map(([id, name]) => {
        const img = h('img', { alt: '', draggable: false });
        const c = h('button', { type: 'button', class: 'tcard', 'aria-pressed': String(S.theme === id), 'data-id': id, on: { click: () => {
          cards.forEach((x) => x.setAttribute('aria-pressed', String(x === c)));
          commit({ theme: id });
        } } }, h('span', { class: 'timg' }, img), h('span', { class: 'tname', textContent: name }));
        return c;
      });
      paintThumbs = () => {
        const mode = M.effectiveMode(new Date(), S);
        cards.forEach((c) => { c.querySelector('img').src = `thumbs/${c.dataset.id}-${mode}.webp`; });
      };
      wrap.append(...cards);
      paintThumbs();
      return wrap;
    }

    function screen() {
      const range = (commit) => {
        const n = Math.max(0, Math.min(30, Math.round(Number(S.minBrightness) || 0)));
        const out = h('output', { class: 'rv', textContent: `${n}%` });
        const r = h('input', { type: 'range', min: 0, max: 30, step: 1, value: n, 'aria-label': U.minBrightness, on: {
          input: () => { out.textContent = `${r.value}%`; },
          change: () => commit({ minBrightness: Number(r.value) }),
        } });
        return h('div', { class: 'rng' }, r, out);
      };
      return [
        field(U.theme, '', (c) => themeCards(c), { cls: 'stack' }),
        field(U.mode, '', (c) => seg(U.modes, S.mode, (v) => c({ mode: v }), U.mode), { cls: 'stack' }),
        field(U.night, U.nightNote, (c) => h('div', { class: 'times' },
          h('label', {}, h('span', { textContent: U.nightFrom }), h('input', { type: 'time', value: S.nightStart, on: { change: (e) => e.target.value && c({ nightStart: e.target.value }) } })),
          h('label', {}, h('span', { textContent: U.nightTo }), h('input', { type: 'time', value: S.nightEnd, on: { change: (e) => e.target.value && c({ nightEnd: e.target.value }) } }))), { cls: 'stack' }),
        field(U.nightDim, U.nightDimNote, (c) => toggle(S.nightDim, (v) => c({ nightDim: v }), U.nightDim), { inline: true }),
        field(U.minBrightness, '', range, { cls: 'stack' }),
        field(U.autoStart, avail === false ? U.autoStartOnly : U.autoStartNote, (c) => toggle(avail ? S.autoStart : false, (v) => c({ autoStart: v }), U.autoStart, !avail), { inline: true }),
      ];
    }

    // ----- 탭: 단축키 -----
    function slotCard(s) {
      const tag = h('span', { class: 'saved', textContent: U.saved, role: 'status' });
      let tt = null;
      const save = (patch) => set({ slots: S.slots.map((x) => (x.key === s.key ? { ...x, ...patch } : x)) }).then(() => {
        tag.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => tag.classList.remove('on'), 800);
      });
      const card = h('div', { class: 'slot', 'data-kind': s.kind });
      const name = text(s.name, U.slotName, (v) => save({ name: v }), { 'aria-label': `${s.key}번 ${U.slotName}` });
      const target = text(s.target, s.kind === 'web' ? U.slotWebTarget : U.slotProgramTarget, (v) => save({ target: v }), { 'aria-label': `${s.key}번 주소 또는 경로` });
      const dim = () => card.classList.toggle('empty', !name.value.trim() && !target.value.trim());
      name.addEventListener('input', dim); target.addEventListener('input', dim);
      dim();
      const kind = seg([['web', U.slotWeb], ['program', U.slotProgram]], s.kind, (v) => {
        card.dataset.kind = v;
        target.placeholder = v === 'web' ? U.slotWebTarget : U.slotProgramTarget;
        save({ kind: v });
      }, `${s.key}번 종류`);
      card.append(
        h('span', { class: 'badge', textContent: s.key }),
        h('div', { class: 'sc' },
          h('div', { class: 'l1' }, name, kind),
          h('div', { class: 'l2' }, target, h('button', { type: 'button', class: 'btn only-program', textContent: U.slotBrowse, on: { click: async () => {
            const p = await api.pickProgram();
            if (p) { target.value = p; target.dispatchEvent(new Event('input')); target.dispatchEvent(new Event('change')); }
          } } })),
          h('div', { class: 'l3' },
            h('span', { class: 'only-web' }, check(U.slotApp, s.appWindow, (v) => save({ appWindow: v }))),
            h('span', { class: 'grow' }), tag,
            h('button', { type: 'button', class: 'btn sm', textContent: U.slotTest, on: { click: () => { target.dispatchEvent(new Event('change')); api.launch(s.key, true); } } }))));
      return card;
    }

    function keys() {
      return [
        field(U.hotkeys, U.hotkeysNote, (c) => toggle(S.hotkeysOn, (v) => c({ hotkeysOn: v }), U.hotkeys), { inline: true }),
        field(U.browser, '', (c) => seg(U.browsers, S.browser, (v) => c({ browser: v }), U.browser), { cls: 'stack' }),
        h('section', { class: 'field stack' }, h('div', { class: 'fh' }, h('div', { class: 'ft' }, h('span', { class: 'fn', textContent: U.slots }))), h('div', { class: 'slots' }, S.slots.map(slotCard))),
      ];
    }

    // ----- 탭: 연결 -----
    async function loadLists() {
      lists = await api.googleLists();
      note.google = lists ? '' : U.gListFail;
      render();
    }

    function google() {
      const g = S.google;
      return field(U.google, '', (commit) => {
        const state = !g.hasClient ? U.gNoClient : g.connected ? U.gConnected : U.gDisconnected;
        const out = [h('p', { class: 'status' }, h('i', { class: `sdot ${g.connected ? 'ok' : ''}` }), state), hint(note.google)];
        const buttons = [];
        if (g.hasClient && !g.connected) {
          buttons.push(btn(U.gConnect, async () => {
            note.google = U.gWaiting; render();
            const r = await api.googleConnect();
            note.google = r.ok ? '' : r.error;
            if (r.ok) await loadLists(); else render();
          }, 'primary'));
        }
        if (g.connected) buttons.push(btn(U.gDisconnect, async () => { await api.googleDisconnect(); lists = null; note.google = ''; render(); }, 'danger'));
        buttons.push(btn(U.gPick, async () => { const r = await api.pickClient(); if (!r.ok && !r.canceled) note.google = r.error; render(); }));
        out.push(h('div', { class: 'btns' }, buttons));
        if (g.connected && lists) {
          const ids = g.calendarIds;
          const boxes = lists.calendars.map((c) => h('input', { type: 'checkbox', value: c.id, checked: ids.includes(c.id) || (!ids.length && c.primary) }));
          out.push(h('p', { class: 'sub', textContent: U.gCalendars }));
          lists.calendars.forEach((c, i) => out.push(h('label', { class: 'check' }, boxes[i], h('span', { textContent: c.name }))));
          boxes.forEach((b) => b.addEventListener('change', () => commit({ google: { calendarIds: boxes.filter((x) => x.checked).map((x) => x.value) } })));
          out.push(h('p', { class: 'sub', textContent: U.gTaskList }));
          const sel = h('select', { 'aria-label': U.gTaskList, on: { change: (e) => commit({ google: { taskListId: e.target.value } }) } },
            [['', U.gDefaultList], ...lists.taskLists.map((t) => [t.id, t.name])].map(([v, t]) => h('option', { value: v, textContent: t, selected: v === g.taskListId })));
          out.push(sel);
        } else if (g.connected) {
          out.push(h('div', { class: 'btns' }, btn(U.gLists, loadLists)));
        }
        return h('div', { class: 'blk' }, out);
      }, { cls: 'stack' });
    }

    function weather() {
      return field(U.weather, '', (commit) => {
        const manual = S.location.mode === 'manual';
        const q = h('input', { type: 'text', placeholder: U.locSearch, spellcheck: false });
        const go = async () => {
          const r = await api.searchPlace(q.value);
          places = r || [];
          note.weather = r === null ? U.locFail : r.length ? '' : U.locNone;
          render();
        };
        q.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
        return h('div', { class: 'blk' },
          h('p', { class: 'status' }, h('i', { class: 'sdot ok' }), manual ? `${S.location.name} (${U.locManual})` : U.locAuto),
          manual ? h('div', { class: 'btns' }, btn(U.locReset, () => commit({ location: { mode: 'auto' } }).then(render))) : null,
          h('div', { class: 'srch' }, q, btn(U.locGo, go)),
          hint(note.weather),
          (places || []).length ? h('div', { class: 'places' }, places.map((p) => h('button', { type: 'button', class: 'place', textContent: [p.name, p.admin].filter(Boolean).join(' · '), on: { click: () => {
            places = null; note.weather = '';
            commit({ location: { mode: 'manual', name: p.name, lat: p.lat, lon: p.lon } }).then(render);
          } } }))) : null);
      }, { cls: 'stack' });
    }

    function servers() {
      return field(U.servers, '', (commit) => {
        const save = (i, patch) => commit({ servers: S.servers.map((s, j) => (j === i ? { ...s, ...patch } : s)) }).then(refreshServers);
        const dots = [];
        const rows = S.servers.map((s, i) => {
          const dot = h('i', { class: 'sdot', role: 'img' });
          dots[i] = dot;
          return h('div', { class: 'srv' }, dot,
            text(s.name, U.serverName, (v) => save(i, { name: v }), { class: 'sname', 'aria-label': `${U.serverName} ${i + 1}` }),
            text(s.url, U.serverUrl, (v) => save(i, { url: v }), { 'aria-label': `${U.serverUrl} ${i + 1}` }),
            h('button', { type: 'button', class: 'icon', 'aria-label': `${U.serverDel} ${i + 1}`, title: U.serverDel, on: { click: () => commit({ servers: S.servers.filter((_, j) => j !== i) }).then(() => { svStates = []; render(); refreshServers(); }) } }, svg('M6 6l12 12M18 6L6 18')));
        });
        paintDots = () => dots.forEach((d, i) => {
          const v = svStates[i];
          const st = v === true ? 'up' : v === false ? 'down' : '';
          d.className = `sdot ${st}`;
          d.setAttribute('aria-label', v === true ? U.serverUp : v === false ? U.serverDown : U.serverWait);
          d.title = d.getAttribute('aria-label');
        });
        paintDots();
        return h('div', { class: 'blk' },
          S.servers.length ? null : hint(U.serverNone),
          rows,
          h('div', { class: 'btns' }, btn(U.serverAdd, () => commit({ servers: [...S.servers, { name: '', url: '' }] }).then(render))));
      }, { cls: 'stack' });
    }
    let paintDots = () => {};
    // 서버 상태 점: 연결 탭이 열려 있는 동안 15초마다 확인
    async function refreshServers() {
      if (!isOpen || tab !== 'links' || !S.servers.length) return;
      const my = ++svSeq;                 // 늦게 도착한 옛 결과가 새 결과를 덮지 않게 함
      let r;
      try { r = await api.serverStates(); } catch { r = []; }
      if (my !== svSeq) return;
      svStates = r;
      if (isOpen && tab === 'links') paintDots();
    }
    function watchServers() {
      clearInterval(svTimer); svTimer = null;
      if (isOpen && tab === 'links') { refreshServers(); svTimer = setInterval(refreshServers, 15000); }
    }

    // ----- 탭: 정보 -----
    function about() {
      const q = h('button', { type: 'button', class: 'btn danger wide', textContent: U.quit, on: { click: () => {
        if (!quitArmed) {
          quitArmed = true; q.textContent = U.quitSure; q.classList.add('armed');
          clearTimeout(quitTimer);
          quitTimer = setTimeout(() => { quitArmed = false; q.textContent = U.quit; q.classList.remove('armed'); }, 4000);
        } else api.quit();
      } } });
      return [
        h('section', { class: 'field inline' }, h('div', { class: 'fh' }, h('div', { class: 'ft' }, h('span', { class: 'fn', textContent: U.version }))), h('span', { class: 'val', textContent: version || '—' })),
        h('section', { class: 'field inline' }, h('div', { class: 'fh' }, h('div', { class: 'ft' }, h('span', { class: 'fn', textContent: U.folder }))), btn(U.folderOpen, () => api.openFolder())),
        h('section', { class: 'field stack' }, h('div', { class: 'fh' }, h('p', { class: 'fd', textContent: U.quitNote })), q),
      ];
    }

    // ----- 뼈대 -----
    function selectTab(id, focus) {
      tab = id; quitArmed = false; places = null;
      render(true);
      watchServers();
      if (focus) root.querySelector('[role=tab][aria-selected=true]').focus();
    }

    function render(resetScroll = false) {
      if (!isOpen || !S) return;
      const old = root.querySelector('.body');
      const top = old && !resetScroll ? old.scrollTop : 0;
      const body = h('div', { class: 'body', role: 'tabpanel', 'aria-labelledby': `tab-${tab}` },
        ...({ screen, keys, links: () => [google(), weather(), servers()], about }[tab]()).flat(Infinity).filter(Boolean));
      const tabs = h('div', { class: 'tabs', role: 'tablist' }, U.tabs.map(([id, t]) => h('button', { type: 'button', role: 'tab', id: `tab-${id}`, class: 'tab', textContent: t, 'aria-selected': String(id === tab), tabIndex: id === tab ? 0 : -1, on: {
        click: () => selectTab(id, true),
        keydown: (e) => {
          const i = U.tabs.findIndex(([x]) => x === id);
          const n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : null;
          if (n !== null) { e.preventDefault(); selectTab(U.tabs[(n + U.tabs.length) % U.tabs.length][0], true); }
        },
      } })));
      root.replaceChildren(
        h('header', { class: 'head' }, h('h2', { textContent: U.title }), h('button', { type: 'button', class: 'x', 'aria-label': U.close, title: U.close, on: { click: close } }, svg('M6 6l12 12M18 6L6 18'))),
        tabs, body);
      body.scrollTop = top;
    }

    function open() {
      if (isOpen || !S) return;
      isOpen = true; places = null; quitArmed = false; closeToken++;
      root.hidden = false; scrim.hidden = false;
      onToggle(true);
      render(true);
      void root.offsetWidth;                  // 숨김 해제 직후 시작 위치를 확정해야 슬라이드 전환이 보임
      root.classList.add('open'); scrim.classList.add('open');
      root.querySelector('[role=tab][aria-selected=true]').focus({ preventScroll: true });
      if (S.google.connected && !lists) loadLists();
      if (avail === null) api.autoStartAvailable().then((v) => { avail = !!v; render(); });
      if (!version) api.version().then((v) => { version = v; if (tab === 'about') render(); });
      watchServers();
    }
    function close() {
      if (!isOpen) return;
      if (document.activeElement && root.contains(document.activeElement)) document.activeElement.blur();   // 입력 중인 글을 먼저 저장
      isOpen = false;
      clearInterval(svTimer); clearTimeout(quitTimer);
      root.classList.remove('open'); scrim.classList.remove('open');
      onToggle(false);
      const token = ++closeToken;
      setTimeout(() => { if (token === closeToken) { root.hidden = true; scrim.hidden = true; } }, 220);
    }
    // 사용자 의도 [v1.2.1 지시]: 시계 화면 아무 곳이나 눌러도 서랍이 닫히고, 그 클릭이 시계에는 전달되지 않는다.
    // 개발 판단: 닫는 클릭은 여기서 끝낸다(전파·기본 동작 차단). 실제 앱(개발 실행·설치본)에서 마우스·터치로 확인했을 때 막는 요소는 없었음.
    scrim.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); close(); });

    // 메인에서 온 설정 갱신. 서랍 안에 포커스가 있으면(조작 중) 화면을 다시 그리지 않아 포커스를 지킴
    function update(s) {
      S = s;
      // 내가 방금 저장한 값이 돌아온 것이면 다시 그리지 않음('저장됨' 표시와 포커스를 지킴)
      if (isOpen && !root.contains(document.activeElement) && Date.now() - ownAt > 1500) render();
    }
    return { open, close, update };
  }

  window.ClockSettings = { create };
})();
// 개정 기록 | 2026-11-11 | 최초 작성 | 설계서 §10 설정 서랍
// 개정 기록 | 2026-11-11 | v1.2 | 전면 재작성: 탭 4개·테마 카드·스위치/분절 버튼·저장됨 표시·자동 실행·서버 상태 점 | docs/v1.2-brief.md §2
// 개정 기록 | 2026-11-11 | v1.2.1 | 바깥 눌러 닫기: 닫는 클릭이 아래 시계로 전달되지 않게 차단 | 대표 지시
