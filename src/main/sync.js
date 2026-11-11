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
function createSync({ store, data, push, google }) {
  const cache = store.cache();
  const setStatus = (kind, state, at) => {
    const prev = data.sync[kind] || {};
    data.sync = { ...data.sync, [kind]: { state, at: at ?? prev.at } };
    push();
  };
  // 캐시에서 시작: 재시작·오프라인에도 마지막 정보를 보여 줌
  data.weather = cache.weather || null;
  data.events = cache.events || [];
  data.tasks = cache.tasks || [];
  data.sync = {
    weather: { state: cache.weather ? 'ok' : 'pending', at: cache.weather && cache.weather.updatedAt },
    calendar: { state: cache.eventsAt ? 'ok' : 'pending', at: cache.eventsAt },
    tasks: { state: cache.tasksAt ? 'ok' : 'pending', at: cache.tasksAt },
  };

  async function wrap(kind, fn) {
    try { await fn(); setStatus(kind, 'ok', Date.now()); }
    catch (e) {
      const known = e && (e.code === 'needAuth' || e.code === 'tokenUnavailable');
      setStatus(kind, known ? e.code : 'failed');
      if (known) e.noRetry = true;   // 연결이 필요한 상태에서는 백오프로 두드리지 않음
      throw e;
    }
  }

  return createScheduler({
    weather: {
      every: 30 * MIN,
      run: () => wrap('weather', async () => {
        const loc = await weather.resolveLocation(store.settings(), store.cache(), store.saveCache);
        data.weather = await weather.fetchWeather(loc, data.weather && data.weather.mask);
        store.saveCache({ weather: data.weather });
      }),
    },
    calendar: {
      every: 5 * MIN,
      run: () => wrap('calendar', async () => {
        const g = store.settings().google;
        data.events = await google.fetchEvents(g.calendarIds.length ? g.calendarIds : ['primary']);
        store.saveCache({ events: data.events, eventsAt: Date.now() });
      }),
    },
    tasks: {
      every: 5 * MIN,
      run: () => wrap('tasks', async () => {
        data.tasks = await google.fetchTasks(store.settings().google.taskListId || '@default');
        store.saveCache({ tasks: data.tasks, tasksAt: Date.now() });
      }),
    },
  });
}

module.exports = { createScheduler, createSync, backoff };
// 개정 기록 | 2026-11-11 | 최초 작성 | 설계서 §7 갱신 주기·백오프
