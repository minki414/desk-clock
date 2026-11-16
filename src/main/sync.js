// 주기 갱신 스케줄러와 작업 정의. 실패하면 마지막 값을 유지하고 지수 백오프(최대 30분)로 재시도합니다.
const weather = require('./weather');

const MIN = 60 * 1000;
const backoff = (fails) => Math.min(30 * MIN, MIN * 2 ** (fails - 1));

// jobs: { 이름: { every(ms), run() } } — run이 throw하면 실패. err.noRetry면 백오프 없이 정상 주기로 다시 확인
function createScheduler(jobs) {
  const st = {};
  for (const n of Object.keys(jobs)) st[n] = { t: null, fails: 0, running: false };

  async function exec(n) {
    const s = st[n];
    clearTimeout(s.t);
    if (s.running) return;
    s.running = true;
    let delay = jobs[n].every;
    try { await jobs[n].run(); s.fails = 0; }
    catch (e) { if (!e || !e.noRetry) { s.fails++; delay = backoff(s.fails); } }
    s.running = false;
    s.t = setTimeout(() => exec(n), delay);
  }
  return {
    start: () => Object.keys(jobs).forEach(exec),
    refresh: (names = Object.keys(jobs)) => names.forEach(exec),
    stop: () => Object.values(st).forEach((s) => clearTimeout(s.t)),
  };
}

// 실제 작업 연결. data는 렌더러로 보내는 자료 묶음, push()는 변경 알림
// 사용자 의도 [docs/v1.4-people-brief.md §4]: 일정·메모는 사람마다 (선택 캘린더 수 + 메모 1)건을 1분 주기로 받고, 한 사람이 실패하면 그 사람 것만 마지막 값을 유지한다.
// 개발 판단: data.people[id] = { events, tasks, sync:{calendar,tasks} }. 스케줄러의 지수 백오프는 '켠 사람 전원이 실패'했을 때만 걸어
// 한 사람의 실패(연결 풀림 등)가 다른 사람의 1분 갱신을 늦추지 않게 한다.
function createSync({ store, data, push, google, onSettings = () => {}, onExpired = () => {} }) {
  const cache = store.cache();
  const known = (e) => !!e && (e.code === 'needAuth' || e.code === 'expired' || e.code === 'tokenUnavailable');
  const blank = () => ({ events: [], tasks: [], sync: { calendar: { state: 'pending' }, tasks: { state: 'pending' } } });
  const setStatus = (kind, state, at) => {
    const prev = data.sync[kind] || {};
    data.sync = { ...data.sync, [kind]: { state, at: at ?? prev.at } };
    push();
  };
  const setPerson = (id, kind, state, at) => {
    const d = data.people[id] || (data.people[id] = blank());
    d.sync = { ...d.sync, [kind]: { state, at: at ?? (d.sync[kind] || {}).at } };
    push();
  };
  // 캐시에서 시작: 재시작·오프라인에도 마지막 정보를 보여 줌(v1.3 이하의 단일 캐시는 사람 1의 것으로 읽음)
  data.weather = cache.weather || null;
  data.sync = { weather: { state: cache.weather ? 'ok' : 'pending', at: cache.weather && cache.weather.updatedAt } };
  data.people = {};
  store.settings().people.forEach((p, i) => {
    const c = (cache.people || {})[p.id] || (i === 0 && !cache.people ? cache : {});
    const d = data.people[p.id] = blank();
    d.events = c.events || []; d.tasks = c.tasks || [];
    d.sync = { calendar: { state: p.google && p.google.expired ? 'expired' : c.eventsAt ? 'ok' : 'pending', at: c.eventsAt }, tasks: { state: p.google && p.google.expired ? 'expired' : c.tasksAt ? 'ok' : 'pending', at: c.tasksAt } };
  });
  const persist = () => store.saveCache({
    people: Object.fromEntries(Object.entries(data.people).map(([id, d]) => [id, { events: d.events, eventsAt: d.sync.calendar.at, tasks: d.tasks, tasksAt: d.sync.tasks.at }])),
    events: undefined, tasks: undefined, eventsAt: undefined, tasksAt: undefined,   // 옛 단일 캐시 키 정리
  });

  async function wrap(kind, fn) {
    try { await fn(); setStatus(kind, 'ok', Date.now()); }
    catch (e) {
      setStatus(kind, known(e) ? e.code : 'failed');
      if (known(e)) e.noRetry = true;   // 연결이 필요한 상태에서는 백오프로 두드리지 않음
      throw e;
    }
  }

  // kind: 'calendar'|'tasks'. fetchOne(person) → 그 사람의 새 자료
  async function perPerson(kind, fetchOne) {
    const targets = store.settings().people.filter((p) => p[kind].on);
    const errs = [];
    await Promise.all(targets.map(async (p) => {
      try {
        const v = await fetchOne(p);
        const d = data.people[p.id] || (data.people[p.id] = blank());
        d[kind === 'calendar' ? 'events' : 'tasks'] = v;
        setPerson(p.id, kind, 'ok', Date.now());
      } catch (e) {
        if (e.code === 'expired') onExpired(p.id);
        const state = e.code === 'needAuth' && p.google && p.google.expired ? 'expired' : known(e) ? e.code : 'failed';
        setPerson(p.id, kind, state); errs.push(e);
      }   // 그 사람 것만 마지막 값 유지
    }));
    persist();
    if (targets.length && errs.length === targets.length) {
      throw Object.assign(new Error(errs[0].message), { code: errs[0].code, noRetry: errs.every(known) });
    }
  }

  const sched = createScheduler({
    weather: {
      every: 30 * MIN,
      run: () => wrap('weather', async () => {
        const loc = await weather.resolveLocation(store.settings(), store.cache(), store.saveCache);
        // 직접 지정한 지명은 화면 언어로 다시 받은 이름을 설정에도 반영(설정창이 같은 이름을 보이게)
        const set = store.settings().location;
        if (set.mode === 'manual' && set.id && loc.name && set.name !== loc.name) { store.patch({ location: { name: loc.name } }); onSettings(); }
        data.weather = await weather.fetchWeather(loc, data.weather && data.weather.mask);
        store.saveCache({ weather: data.weather });
      }),
    },
    calendar: { every: 1 * MIN, run: () => perPerson('calendar', (p) => google.fetchEvents(p.id, p.calendar.ids.length ? p.calendar.ids : ['primary'])) },
    tasks: { every: 1 * MIN, run: () => perPerson('tasks', (p) => google.fetchTasks(p.id, p.tasks.listId || '@default')) },
  });
  return {
    ...sched,
    // 연결 해제(remove=false: 자료를 비우고 '연결 필요' 상태로)·사람 삭제(remove=true: 항목 자체를 지움)
    clearPerson(id, remove = false) {
      if (remove) delete data.people[id];
      else data.people[id] = { events: [], tasks: [], sync: { calendar: { state: 'needAuth' }, tasks: { state: 'needAuth' } } };
      persist(); push();
    },
  };
}

module.exports = { createScheduler, createSync, backoff };
// 개정 기록 | 2026-11-11 | 최초 작성 | 설계서 §7 갱신 주기·백오프
// 개정 기록 | 2026-11-11 | 일정·메모 1분 주기 | 사용자 결정: 5분→1분(백오프 최대 30분 그대로)
// 개정 기록 | 2026-11-11 | v1.3 | 언어를 바꾸면 직접 지정 지명의 이름을 새 언어로 갱신 | docs/v1.3-i18n-brief.md
// 개정 기록 | 2026-11-12 | 사람 여러 명 | 사용자 결정: 일정·메모를 사람별로 받아 data.people[id]에 보관, 한 사람 실패는 그 사람 것만 유지, 백오프는 전원 실패 때만

// 개정 기록 | 2026-11-16 | 구글 만료 감지와 간편 재로그인 | 사용자 요청
