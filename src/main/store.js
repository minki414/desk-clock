// 설정·캐시 저장소. userData 폴더 경로를 받아 JSON 두 개를 원자적(tmp→rename)으로 씁니다.
const fs = require('node:fs');
const path = require('node:path');
const { norm } = require('../renderer/i18n.js');

const defaultSlots = () => {
  const s = [];
  for (let key = 1; key <= 9; key++) s.push({ key, name: '', kind: 'web', target: '', appWindow: true, sendKeys: '', returnToClock: false });
  s[0] = { key: 1, name: '유튜브', kind: 'web', target: 'https://www.youtube.com', appWindow: true, sendKeys: '', returnToClock: false };
  s[1] = { key: 2, name: 'LP Lounge', kind: 'web', target: 'http://127.0.0.1:4320/', appWindow: true, sendKeys: '', returnToClock: false };
  return s;
};

const defaults = () => ({
  settingsVersion: 2,         // 기본값 바뀜을 한 번만 옛 설정에 적용하는 표식
  lang: 'ko',                 // ko | zh | en — 화면 언어. 설정에 없으면 한국어
  theme: 'bauhaus',
  mode: 'light',              // light | dark | auto — 사용자 결정(2026-11-11): 기본 라이트
  nightStart: '19:00',
  nightEnd: '07:00',
  nightDim: false,            // 사용자 결정(2026-11-11): 기본 끔, 필요할 때만 설정에서 켬
  minBrightness: 0,
  browser: 'brave',           // brave | chrome | edge | default
  hotkeysOn: true,
  autoStart: false,           // Windows 시작 시 자동 실행(portable exe에서만 적용)
  slots: defaultSlots(),
  location: { mode: 'auto', name: '', lat: null, lon: null, id: null },   // id: 지오코딩 지명 번호(언어를 바꾸면 이 번호로 이름을 다시 받음)
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
  const saved = readJson(sFile, null);
  let settings = withDefaults(defaults(), saved);
  settings.lang = norm(settings.lang);   // 알 수 없는 값은 한국어로
  // 1회 이관: 버전 2 이전 설정은 야간 감광을 끄고 색 모드를 라이트로(옛 기본이 켬·자동이라 저장돼 있음). 감광 중이던 밝기는 dimmer.tick()이 복구
  if (isObj(saved) && !(saved.settingsVersion >= 2)) {
    settings = { ...settings, nightDim: false, mode: 'light', settingsVersion: 2 };
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
// 개정 기록 | 2026-11-11 | 단축키 포커스 전용 | 사용자 결정: nightDim 기본 끔 + settingsVersion 2 이관(옛 설정의 nightDim 끔)
// 개정 기록 | 2026-11-11 | 기본 라이트 | 사용자 결정: mode 기본 light, 같은 이관에서 옛 설정 mode 를 light 로
// 개정 기록 | 2026-11-11 | 실행 후 키 보내기 | 사용자 요청: 슬롯 sendKeys(빈 값=끔) 추가, 옛 설정은 기본값 병합으로 그대로 동작
// 개정 기록 | 2026-11-11 | 실행 후 시계로 돌아오기 | 사용자 요청: 슬롯 returnToClock(기본 끔) 추가, 옛 설정은 기본값 병합으로 끔
// 개정 기록 | 2026-11-11 | v1.3 | lang 설정(기본 ko, 알 수 없는 값 무시)·location.id 추가 | docs/v1.3-i18n-brief.md
