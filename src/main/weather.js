// 위치(IP·지명 검색)와 Open-Meteo 날씨·대기질. 네트워크 호출 외의 판정 규칙은 순수 함수로 두어 시험합니다.
const { t, norm } = require('../renderer/i18n.js');
const TZ = 'Asia%2FSeoul';

// 우산: 오늘 강수확률 최대 60% 이상, 또는 지금부터 오늘 끝까지 강수량 1mm 이상
function needUmbrella({ probMax, times, precip, nowStr }) {
  const hour = nowStr.slice(0, 13) + ':00', day = nowStr.slice(0, 10);
  let sum = 0;
  times.forEach((t, i) => { if (t >= hour && t.startsWith(day)) sum += precip[i] || 0; });
  return (probMax || 0) >= 60 || sum >= 1;
}

// 마스크: 앞으로 12시간 PM10 최대 81 이상, 또는 PM2.5 최대 36 이상(환경부 나쁨 기준)
function needMask({ times, pm10, pm25, nowStr }) {
  const hour = nowStr.slice(0, 13) + ':00';
  const from = times.findIndex((t) => t >= hour);
  if (from < 0) return false;
  const max = (arr) => Math.max(0, ...arr.slice(from, from + 12).filter((v) => v != null));
  return max(pm10) >= 81 || max(pm25) >= 36;
}

async function getJSON(url, ms = 10000) {
  const res = await fetch(url, { signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// 사용자 의도 [docs/v1.3-i18n-brief.md]: 지명도 화면 언어로 보여 준다.
// 개발 판단: 검색어와 다른 언어의 이름은 검색에 걸리지 않아(확인함) 이름 검색은 그대로 두고, 고른 지명은 번호(id)로 다시 받아 언어만 바꾼다.
async function geocode(name, count = 5, lang = 'ko') {
  const j = await getJSON(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&language=${norm(lang)}&count=${count}`);
  return (j.results || []).map((r) => ({ id: r.id, name: r.name, admin: [r.admin1, r.admin2].filter(Boolean).join(' '), country: r.country_code, lat: r.latitude, lon: r.longitude }));
}

async function placeName(id, lang) {
  const j = await getJSON(`https://geocoding-api.open-meteo.com/v1/get?id=${id}&language=${norm(lang)}`);
  if (!j.name) throw new Error('no place name');
  return j.name;
}

// IP로 위치를 추정하고, 화면 언어의 지명은 지오코딩으로 얻음(ipwho.is는 한국어를 지원하지 않음)
async function ipLocation(lang) {
  const j = await getJSON('https://ipwho.is/');
  if (!j.success) throw new Error('ipwho failed');
  let name = j.city || j.region || t(lang, 'wx.here'), id = null;
  try {
    const hit = (await geocode(name, 3, lang)).find((r) => r.country === j.country_code);
    if (hit) { name = hit.name; id = hit.id; }
  } catch { /* 영문 지명 그대로 */ }
  return { name, lat: j.latitude, lon: j.longitude, id };
}

// 설정이 수동이면 그 값, 자동이면 24시간 캐시된 IP 위치(실패하면 오래된 캐시라도 사용)
async function resolveLocation(settings, cache, saveCache) {
  const loc = settings.location, lang = norm(settings.lang);
  if (loc.mode === 'manual' && loc.lat != null) {
    let name = loc.name;
    if (loc.id) {   // 고른 지명을 현재 언어의 이름으로(받은 이름은 캐시에 보관)
      const key = `${loc.id}:${lang}`, names = cache.placeNames || {};
      if (names[key]) name = names[key];
      else { try { name = await placeName(loc.id, lang); saveCache({ placeNames: { ...names, [key]: name } }); } catch { /* 저장된 이름 그대로 */ } }
    }
    return { name, lat: loc.lat, lon: loc.lon };
  }
  const c = cache.location;
  if (c && c.lang === lang && Date.now() - c.at < 24 * 3600 * 1000) return c;
  try {
    const fresh = { ...(await ipLocation(lang)), at: Date.now(), lang };
    saveCache({ location: fresh });
    return fresh;
  } catch (e) {
    if (c) return c;
    throw e;
  }
}

async function forecast(loc, models) {
  const q = `latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&hourly=precipitation&timezone=${TZ}&forecast_days=2`;
  return getJSON(`https://api.open-meteo.com/v1/forecast?${q}${models ? '&models=kma_seamless' : ''}`);
}

// prevMask: 대기질 호출이 실패하면 직전 판정을 유지
async function fetchWeather(loc, prevMask = false) {
  let j = await forecast(loc, true);
  // kma_seamless는 일시적으로 전부 null을 줄 때가 있어(확인됨) 기본 모델로 한 번 더 시도
  if (j.current.temperature_2m == null) j = await forecast(loc, false);
  if (j.current.temperature_2m == null) throw new Error('no weather value');
  const nowStr = j.current.time;
  let mask = prevMask;
  try {
    const a = await getJSON(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${loc.lat}&longitude=${loc.lon}&hourly=pm10,pm2_5&timezone=${TZ}&forecast_days=2`);
    mask = needMask({ times: a.hourly.time, pm10: a.hourly.pm10, pm25: a.hourly.pm2_5, nowStr });
  } catch { /* 마스크 판정은 직전 값 유지 */ }
  return {
    place: loc.name, tempC: Math.round(j.current.temperature_2m), code: j.current.weather_code,   // 날씨 이름은 화면이 언어에 맞춰 만듦
    hiC: Math.round(j.daily.temperature_2m_max[0]), loC: Math.round(j.daily.temperature_2m_min[0]),
    umbrella: needUmbrella({ probMax: j.daily.precipitation_probability_max[0], times: j.hourly.time, precip: j.hourly.precipitation, nowStr }),
    mask, updatedAt: Date.now(),
  };
}

module.exports = { needUmbrella, needMask, geocode, resolveLocation, fetchWeather };
// 개정 기록 | 2026-11-11 | 최초 작성 | 설계서 §1 날씨·우산·마스크 / kma_seamless가 null을 줄 때 기본 모델로 대체
// 개정 기록 | 2026-11-11 | v1.3 | 날씨 이름(label) 제거(화면이 언어별로 생성), 지오코딩·IP 위치 지명을 화면 언어로, 고른 지명 id로 언어 전환 | docs/v1.3-i18n-brief.md
