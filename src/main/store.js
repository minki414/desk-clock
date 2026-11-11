// 설정·캐시 저장소. userData 폴더 경로를 받아 JSON 두 개를 원자적(tmp→rename)으로 씁니다.
const fs = require('node:fs');
const path = require('node:path');

const defaultSlots = () => {
  const s = [];
  for (let key = 1; key <= 9; key++) s.push({ key, name: '', kind: 'web', target: '', appWindow: true });
  s[0] = { key: 1, name: '유튜브', kind: 'web', target: 'https://www.youtube.com', appWindow: true };
  s[1] = { key: 2, name: 'LP Lounge', kind: 'web', target: 'http://127.0.0.1:4320/', appWindow: true };
  return s;
};

const defaults = () => ({
  theme: 'bauhaus',
  mode: 'auto',               // light | dark | auto
  nightStart: '19:00',
  nightEnd: '07:00',
  nightDim: true,
  minBrightness: 0,
  browser: 'brave',           // brave | chrome | edge | default
  hotkeysOn: true,
  autoStart: false,           // Windows 시작 시 자동 실행(portable exe에서만 적용)
  slots: defaultSlots(),
  location: { mode: 'auto', name: '', lat: null, lon: null },
  google: { hasClient: false, connected: false, calendarIds: [], taskListId: '' },
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
  let settings = withDefaults(defaults(), readJson(sFile, null));
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
        next[k] = isObj(settings[k]) && isObj(p[k]) ? { ...settings[k], ...p[k] } : p[k];
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

module.exports = { createStore, defaults, withDefaults, writeAtomic };
// 개정 기록 | 2026-11-11 | 최초 작성 | 설계서 §1 설정·캐시 행
// 개정 기록 | 2026-11-11 | v1.2 | autoStart 기본값 추가 | docs/v1.2-brief.md §3
