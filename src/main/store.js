// 설정·캐시 저장소. userData 폴더 경로를 받아 JSON 두 개를 원자적(tmp→rename)으로 씁니다.
const fs = require('node:fs');
const path = require('node:path');
const { parseCombo, formatCombo } = require('../renderer/keycombo.js');
const normReturn = (v) => v === '' ? '' : parseCombo(v) ? formatCombo(v) : 'Ctrl+H';
const { norm, t } = require('../renderer/i18n.js');

const defaultSlots = () => {
  const s = [];
  for (let key = 1; key <= 9; key++) s.push({ key, name: '', kind: 'web', target: '', appWindow: true, sendKeys: '', returnToClock: false });
  s[0] = { key: 1, name: '유튜브', kind: 'web', target: 'https://www.youtube.com', appWindow: true, sendKeys: '', returnToClock: false };
  s[1] = { key: 2, name: 'LP Lounge', kind: 'web', target: 'http://127.0.0.1:4320/', appWindow: true, sendKeys: '', returnToClock: false };
  return s;
};

const MAX_PEOPLE = 4;

// 사람 한 명의 설정. 구글 토큰은 설정이 아니라 사람 id별 암호화 파일에 있고, google.connected 는 그 파일이 있는지 보여 주는 표시일 뿐(메인이 채움)
// 사용자 의도 [docs/v1.4-people-brief.md §1]: 사람 1명 기본, 최대 4명. 첫 사람은 지금까지의 단일 연결을 그대로 이어받는다.
// 개발 판단: id 는 'p1'~ 형식으로 고정해 토큰 파일 이름(google-token-<id>.bin)에 그대로 써도 경로 문제가 없게 한다.
const PERSON_ID = /^p\d{1,3}$/;
const defaultPerson = (n, lang, id = `p${n}`) => ({
  id, name: t(lang, 'person.default', { n }), google: { connected: false, expired: false, account: '' },
  calendar: { on: true, ids: [] }, tasks: { on: true, listId: '' },
});
const nextPersonId = (people) => { const used = new Set(people.map((p) => p.id)); let n = 1; while (used.has(`p${n}`)) n++; return `p${n}`; };
// 새로 더하는 사람: 기본 이름 번호는 쓰이지 않은 가장 작은 수. 캘린더·메모는 연결한 뒤 사용자가 켠다
function newPerson(people, lang) {
  const names = new Set(people.map((p) => p.name));
  let n = 1; while (names.has(t(lang, 'person.default', { n }))) n++;
  return { ...defaultPerson(n, lang, nextPersonId(people)), calendar: { on: false, ids: [] }, tasks: { on: false, listId: '' } };
}
// 저장된 사람 목록을 안전한 모양으로 고침(1~4명, id 유일, 이름 20자·빈 이름은 기본 이름)
function normPeople(list, lang) {
  const out = [];
  for (const p of Array.isArray(list) ? list : []) {
    if (!isObj(p) || out.length >= MAX_PEOPLE) continue;
    const id = PERSON_ID.test(p.id) && !out.some((x) => x.id === p.id) ? p.id : nextPersonId(out);
    const cal = isObj(p.calendar) ? p.calendar : {}, tk = isObj(p.tasks) ? p.tasks : {};
    const calObj = {
      on: !!cal.on,
      ids: Array.isArray(cal.ids) ? cal.ids.filter((x) => typeof x === 'string') : [],
    };
    if (Array.isArray(cal.shared)) {
      calObj.shared = cal.shared.filter((x) => typeof x === 'string');
    }
    out.push({
      id, name: String(p.name == null ? '' : p.name).trim().slice(0, 20) || t(lang, 'person.default', { n: out.length + 1 }),
      google: { connected: !!(isObj(p.google) && p.google.connected), expired: !!(isObj(p.google) && p.google.expired), account: isObj(p.google) && typeof p.google.account === 'string' ? p.google.account.slice(0, 254) : '' },
      calendar: calObj,
      tasks: { on: !!tk.on, listId: typeof tk.listId === 'string' ? tk.listId : '' },
    });
  }
  return out.length ? out : [defaultPerson(1, lang)];
}

const defaults = () => ({
  settingsVersion: 3,         // 기본값 바뀜을 한 번만 옛 설정에 적용하는 표식(3: 사람 목록)
  lang: 'ko',                 // ko | zh | en — 화면 언어. 설정에 없으면 한국어
  theme: 'bauhaus',
  mode: 'light',              // light | dark | auto — 사용자 결정(2026-11-11): 기본 라이트
  nightStart: '19:00',
  nightEnd: '07:00',
  nightDim: false,            // 사용자 결정(2026-11-11): 기본 끔, 필요할 때만 설정에서 켬
  minBrightness: 0,
  browser: 'brave',           // brave | chrome | edge | default
  hotkeysOn: true,
  returnHotkey: 'Ctrl+H',
  autoStart: false,           // Windows 시작 시 자동 실행(portable exe에서만 적용)
  slots: defaultSlots(),
  location: { mode: 'auto', name: '', lat: null, lon: null, id: null },   // id: 지오코딩 지명 번호(언어를 바꾸면 이 번호로 이름을 다시 받음)
  google: { hasClient: false },   // 클라이언트 파일 유무만(연결·캘린더·메모 목록은 사람별 people 로 옮김)
  sharedLabel: '',            // 공유 일정 표시 문구(기본 사전값 '우리', 최대 6자)
  people: [defaultPerson(1, 'ko')],
  servers: [],
  dim: { active: false, mode: 'wmi', original: null },   // 비정상 종료 뒤 밝기 복구용
});

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

function writeAtomic(file, data) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file); // 쓰다 꺼져도 기존 파일이 깨지지 않게
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

// 저장된 값 위에 기본값을 덮어 새 항목이 생겨도 옛 파일이 그대로 동작하게 함
function withDefaults(base, saved) {
  const out = { ...base };
  if (!isObj(saved)) return out;
  for (const k of Object.keys(base)) {
    if (!(k in saved)) continue;
    out[k] = isObj(base[k]) && isObj(saved[k]) ? { ...base[k], ...saved[k] } : saved[k];
  }
  if (Array.isArray(saved.slots)) {
    out.slots = base.slots.map((d) => ({ ...d, ...(saved.slots.find((s) => s && s.key === d.key) || {}) }));
  }
  return out;
}

function createStore(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const sFile = path.join(dir, 'settings.json');
  const cFile = path.join(dir, 'cache.json');
  const saved = readJson(sFile, null);
  let settings = withDefaults(defaults(), saved);
  settings.returnHotkey = normReturn(settings.returnHotkey);
  settings.lang = norm(settings.lang);   // 알 수 없는 값은 한국어로
  settings.people = normPeople(isObj(saved) && Array.isArray(saved.people) ? saved.people : settings.people, settings.lang);
  // 1회 이관: 버전 2 이전 설정은 야간 감광을 끄고 색 모드를 라이트로(옛 기본이 켬·자동이라 저장돼 있음). 감광 중이던 밝기는 dimmer.tick()이 복구
  // 1회 이관(버전 3): 단일 구글 연결(캘린더 선택·메모 목록)을 사람 1로 옮김. 토큰 파일은 google.js 가 따로 옮기므로 재로그인이 필요 없다.
  // 사용자 의도 [docs/v1.4-people-brief.md §1]: 재로그인 불필요. 개발 판단: 옛 설정 파일은 한 번만 .v2.bak 으로 남겨 되돌릴 길을 둔다(토큰은 설정에 없음).
  const ver = isObj(saved) ? (saved.settingsVersion | 0) : 3;
  if (ver < 3) {
    if (ver < 2) settings = { ...settings, nightDim: false, mode: 'light' };
    const g = isObj(saved.google) ? saved.google : {};
    if (!Array.isArray(saved.people)) {
      const p1 = defaultPerson(1, settings.lang);
      p1.google.connected = !!g.connected;
      p1.calendar.ids = Array.isArray(g.calendarIds) ? g.calendarIds.filter((x) => typeof x === 'string') : [];
      p1.tasks.listId = typeof g.taskListId === 'string' ? g.taskListId : '';
      settings.people = [p1];
    }
    settings = { ...settings, google: { hasClient: !!g.hasClient }, settingsVersion: 3 };
    try { if (!fs.existsSync(sFile + '.v2.bak')) fs.copyFileSync(sFile, sFile + '.v2.bak'); } catch { /* 백업 실패는 이관을 막지 않음 */ }
    writeAtomic(sFile, settings);
  }
  let cache = readJson(cFile, {});
  if (!isObj(cache)) cache = {};
  return {
    dir,
    settings: () => settings,
    cache: () => cache,
    // 값이 객체이면 한 단계만 합치고, 배열·문자열 등은 통째로 바꿉니다.
    patch(p) {
      const next = { ...settings };
      for (const k of Object.keys(p)) {
        if (!(k in settings)) continue;
        if (k === 'lang' && norm(p[k]) !== p[k]) continue;   // 지원하지 않는 언어 값은 무시
        if (k === 'returnHotkey') { next[k] = normReturn(p[k]); continue; }
        if (k === 'sharedLabel') {
          next[k] = typeof p[k] === 'string' ? p[k].trim().slice(0, 6) : '';
          continue;
        }
        next[k] = k === 'people' ? normPeople(p[k], next.lang) : isObj(settings[k]) && isObj(p[k]) ? { ...settings[k], ...p[k] } : p[k];
      }
      settings = next;
      writeAtomic(sFile, settings);
      return settings;
    },
    saveCache(patch) {
      cache = { ...cache, ...patch };
      writeAtomic(cFile, cache);
    },
  };
}

module.exports = { createStore, defaults, withDefaults, writeAtomic, normPeople, newPerson, defaultPerson, MAX_PEOPLE };
// 개정 기록 | 2026-11-11 | 최초 작성 | 설계서 §1 설정·캐시 행
// 개정 기록 | 2026-11-11 | v1.2 | autoStart 기본값 추가 | docs/v1.2-brief.md §3
// 개정 기록 | 2026-11-11 | 단축키 포커스 전용 | 사용자 결정: nightDim 기본 끔 + settingsVersion 2 이관(옛 설정의 nightDim 끔)
// 개정 기록 | 2026-11-11 | 기본 라이트 | 사용자 결정: mode 기본 light, 같은 이관에서 옛 설정 mode 를 light 로
// 개정 기록 | 2026-11-11 | 실행 후 키 보내기 | 사용자 요청: 슬롯 sendKeys(빈 값=끔) 추가, 옛 설정은 기본값 병합으로 그대로 동작
// 개정 기록 | 2026-11-11 | 실행 후 시계로 돌아오기 | 사용자 요청: 슬롯 returnToClock(기본 끔) 추가, 옛 설정은 기본값 병합으로 끔
// 개정 기록 | 2026-11-11 | v1.3 | lang 설정(기본 ko, 알 수 없는 값 무시)·location.id 추가 | docs/v1.3-i18n-brief.md
// 개정 기록 | 2026-11-12 | 사람 여러 명 | 사용자 결정: people(최대 4명)·settingsVersion 3 이관(단일 구글 연결→사람 1, 옛 설정 .v2.bak 보존)
// 개정 기록 | 2026-11-15 | sharedLabel 설정 및 calendar.shared 저장 | 사용자 요청

// 개정 기록 | 2026-11-16 | 전역 복귀 단축키 설정·녹화·배선 | 사용자 요청

// 개정 기록 | 2026-11-16 | 구글 만료 감지와 간편 재로그인 | 사용자 요청
