// 구글 연동: 데스크톱 OAuth(루프백 + PKCE), Calendar·Tasks 읽기 전용.
// electron 객체(safeStorage 어댑터·열기)는 주입받아 시험에서 실제 구글·실제 키 보관소를 쓰지 않습니다.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { t } = require('../renderer/i18n.js');

const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/tasks.readonly';
const DAY = 24 * 3600 * 1000;

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const fail = (code, msg) => Object.assign(new Error(msg || code), { code });

// ----- 순수 함수(시험 대상) -----
function pkcePair() {
  const verifier = b64url(crypto.randomBytes(32));
  return { verifier, challenge: challengeOf(verifier) };
}
const challengeOf = (verifier) => b64url(crypto.createHash('sha256').update(verifier).digest());

function buildAuthUrl(client, { redirect, challenge, state }) {
  const u = new URL(client.auth_uri || 'https://accounts.google.com/o/oauth2/v2/auth');
  u.search = new URLSearchParams({
    client_id: client.client_id, redirect_uri: redirect, response_type: 'code', scope: SCOPES,
    code_challenge: challenge, code_challenge_method: 'S256', state,
    access_type: 'offline', prompt: 'select_account consent',   // consent: refresh token이 확실히 옴 / select_account: 이미 로그인한 계정이 있어도 다른 계정(두 번째 사람)을 고를 수 있음
  }).toString();
  return u.toString();
}

// 종일 일정의 날짜('2026-11-11')는 시간대 없이 그 날 0시(현지)로 해석
const dateMs = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };

// Calendar API 항목 → { title, location, allDay, start, end(ms), holiday }. 취소·거절한 일정은 null
function normalizeEvent(item, holiday = false) {
  if (!item || item.status === 'cancelled') return null;
  if ((item.attendees || []).some((a) => a.self && a.responseStatus === 'declined')) return null;
  const s = item.start || {}, e = item.end || {};
  const allDay = !!s.date;
  const start = allDay ? dateMs(s.date) : Date.parse(s.dateTime);
  let end = allDay ? (e.date ? dateMs(e.date) : start + DAY) : Date.parse(e.dateTime);
  if (!Number.isFinite(start)) return null;
  if (!Number.isFinite(end) || end < start) end = start;
  return { title: item.summary || '',   // 제목이 없으면 비워 두고, 화면이 언어에 맞는 '(제목 없음)'을 보임
     location: item.location || '', allDay, start, end, holiday };
}
const normalizeEvents = (items, holiday) => (items || []).map((i) => normalizeEvent(i, holiday)).filter(Boolean);

// Tasks API 응답 → 제목 목록(완료·삭제·빈 제목 제외, 목록의 원래 순서)
function normalizeTasks(resp) {
  return ((resp && resp.items) || [])
    .filter((t) => t.status !== 'completed' && !t.deleted && !t.hidden && String(t.title || '').trim())
    .map((t) => t.title.trim());
}

// 공휴일 캘린더(예: ko.south_korea#holiday@group.v.calendar.google.com)는 휴일 표시로만 쓰임
const isHolidayCalendar = (id) => String(id).includes('#holiday@');

// ----- 연결 -----
// safe: { available(): Promise<bool>, encrypt(str): Promise<Buffer>, decrypt(buf): Promise<str> }
// 사용자 의도 [docs/v1.4-people-brief.md §1]: 구글 연결은 사람마다 따로. refresh token 은 사람 id별 암호화 파일(google-token-<id>.bin)에만 둔다.
// 개발 판단: id 는 'p<숫자>' 형식만 받아(설정창이 보낸 값이라도) 파일 경로로 새어 나가지 않게 한다. 액세스 토큰은 메모리에만 사람별로 캐시.
const ID = /^p\d{1,3}$/;
const LEGACY_OWNER = 'p1';   // v1.3까지의 단일 연결(google-token.bin)은 사람 1의 것
function createGoogle({ dir, safe, openUrl, now = Date.now, lang = () => 'ko' }) {
  const clientFile = path.join(dir, 'google-client.json');
  const legacyFile = path.join(dir, 'google-token.bin');
  const access = {};   // 사람 id → { token, exp }
  const own = (id) => { if (!ID.test(String(id))) throw fail('badPerson', 'bad person id'); return path.join(dir, `google-token-${id}.bin`); };
  // 옮기기 전(또는 옮기기가 실패한 뒤)에는 사람 1이 옛 파일을 그대로 읽어 재로그인이 필요 없다
  const tokenFile = (id) => { const f = own(id); return id === LEGACY_OWNER && !fs.existsSync(f) && fs.existsSync(legacyFile) ? legacyFile : f; };

  function client() {
    try {
      const j = JSON.parse(fs.readFileSync(clientFile, 'utf8'));
      return j.installed && j.installed.client_id ? j.installed : null;
    } catch { return null; }
  }
  const hasClient = () => !!client();
  const isConnected = (id) => fs.existsSync(tokenFile(id));

  // 옛 단일 토큰 파일을 사람 1의 파일로 옮김(시작 때 한 번). 복사→같은 폴더 안에서 이름 바꾸기(원자적)→내용 확인→옛 파일 삭제 순서라
  // 어느 단계에서 꺼져도 토큰은 한쪽에 남고, 실패하면 옛 파일을 건드리지 않아 tokenFile() 폴백으로 계속 동작한다(되돌릴 길).
  function migrateLegacy() {
    if (!fs.existsSync(legacyFile)) return 'none';
    const dest = own(LEGACY_OWNER), tmp = dest + '.tmp';
    try {
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(legacyFile, tmp);
        fs.renameSync(tmp, dest);
        if (!fs.readFileSync(dest).equals(fs.readFileSync(legacyFile))) { fs.unlinkSync(dest); return 'failed'; }
      }
      fs.unlinkSync(legacyFile);   // 새 파일이 이미 있으면(재로그인했거나 이전에 옮기다 꺼짐) 옛 파일은 남은 복사본일 뿐
      return 'moved';
    } catch {
      try { fs.unlinkSync(tmp); } catch { /* 없음 */ }
      return 'failed';
    }
  }

  // 사용자가 고른 클라이언트 JSON을 검증해 userData로 복사(원본 경로는 저장하지 않음)
  function importClient(srcPath) {
    let j;
    try { j = JSON.parse(fs.readFileSync(srcPath, 'utf8')); } catch { return { ok: false, error: t(lang(), 'err.unreadable') }; }
    if (!j.installed || !j.installed.client_id) return { ok: false, error: t(lang(), 'err.notDesktop') };
    fs.writeFileSync(clientFile, JSON.stringify({ installed: j.installed }));
    return { ok: true };
  }

  // refresh token은 DPAPI(safeStorage)로 암호화해서만 저장. 불가하면 평문으로 대신 저장하지 않음
  async function saveRefresh(id, token) {
    if (!(await safe.available())) throw fail('tokenUnavailable', 'token storage unavailable');
    fs.writeFileSync(own(id), await safe.encrypt(token));
    if (id === LEGACY_OWNER) try { fs.unlinkSync(legacyFile); } catch { /* 없음 */ }
  }
  async function loadRefresh(id) {
    const f = tokenFile(id);
    if (!fs.existsSync(f)) return null;
    if (!(await safe.available())) throw fail('tokenUnavailable', 'token storage unavailable');
    return safe.decrypt(fs.readFileSync(f));
  }
  function dropToken(id) {
    delete access[id];
    for (const f of [own(id), ...(id === LEGACY_OWNER ? [legacyFile] : [])]) try { fs.unlinkSync(f); } catch { /* 없음 */ }
  }

  async function tokenRequest(c, params) {
    const body = new URLSearchParams({ client_id: c.client_id, ...(c.client_secret ? { client_secret: c.client_secret } : {}), ...params });
    const res = await fetch(c.token_uri || 'https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(15000),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw fail(j.error === 'invalid_grant' ? 'needAuth' : 'failed', j.error || `HTTP ${res.status}`);
    return j;
  }

  async function accessToken(id) {
    const a = access[id];
    if (a && a.exp > now() + 60000) return a.token;
    const refresh = await loadRefresh(id);
    const c = client();
    if (!refresh || !c) throw fail('needAuth');
    try {
      const j = await tokenRequest(c, { grant_type: 'refresh_token', refresh_token: refresh });
      access[id] = { token: j.access_token, exp: now() + (j.expires_in || 3600) * 1000 };
    } catch (e) {
      if (e.code === 'needAuth') dropToken(id);   // 취소·만료된 토큰이면 다시 연결하도록
      throw e;
    }
    return access[id].token;
  }

  async function connect(id) {
    own(id);   // id 형식 확인
    const c = client();
    if (!c) throw fail('needAuth', 'client JSON required');
    if (!(await safe.available())) throw fail('tokenUnavailable', 'token storage unavailable');
    const { verifier, challenge } = pkcePair();
    const state = b64url(crypto.randomBytes(16));
    const server = http.createServer();
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const redirect = `http://127.0.0.1:${server.address().port}`;
    try {
      const code = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(fail('failed', 'connect timeout')), 3 * 60 * 1000);
        server.on('request', (req, res) => {
          const u = new URL(req.url, redirect);
          if (u.pathname !== '/') { res.writeHead(404).end(); return; }   // favicon 등은 무시
          const ok = u.searchParams.get('state') === state && u.searchParams.get('code');
          res.writeHead(ok ? 200 : 400, { 'content-type': 'text/html; charset=utf-8' });
          res.end(`<meta charset="utf-8"><body style="font:18px sans-serif;padding:48px">${t(lang(), ok ? 'oauth.ok' : 'oauth.fail')}</body>`);
          clearTimeout(timer);
          ok ? resolve(u.searchParams.get('code')) : reject(fail('failed', u.searchParams.get('error') || 'connect denied'));
        });
        Promise.resolve().then(() => openUrl(buildAuthUrl(c, { redirect, challenge, state }))).catch((e) => { clearTimeout(timer); reject(e); });
      });
      const j = await tokenRequest(c, { grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: redirect });
      if (!j.refresh_token) throw fail('failed', 'no refresh token');
      await saveRefresh(id, j.refresh_token);
      access[id] = { token: j.access_token, exp: now() + (j.expires_in || 3600) * 1000 };
    } finally { server.close(); }
  }

  async function disconnect(id) {
    try {
      const t = await loadRefresh(id);
      if (t) await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: t }), signal: AbortSignal.timeout(8000) });
    } catch { /* 폐기 요청 실패는 무시하고 로컬 토큰만 지움 */ }
    dropToken(id);
  }

  // ----- API -----
  async function api(id, url, retry = true) {
    const res = await fetch(url, { headers: { authorization: `Bearer ${await accessToken(id)}` }, signal: AbortSignal.timeout(15000) });
    if (res.status === 401 && retry) { delete access[id]; return api(id, url, false); }
    if (!res.ok) throw fail('failed', `HTTP ${res.status}`);
    return res.json();
  }

  // 오늘 0시부터 8일 치(오늘 + 내일부터 7일)
  async function fetchEvents(id, calendarIds) {
    const from = new Date(); from.setHours(0, 0, 0, 0);
    const q = new URLSearchParams({ timeMin: from.toISOString(), timeMax: new Date(from.getTime() + 8 * DAY).toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '100' });
    const lists = await Promise.all(calendarIds.map(async (cal) => normalizeEvents((await api(id, `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal)}/events?${q}`)).items, isHolidayCalendar(cal))));
    return lists.flat();
  }
  async function fetchTasks(id, listId) {
    return normalizeTasks(await api(id, `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(listId).replace('%40', '@')}/tasks?showCompleted=false&maxResults=100`));
  }
  async function lists(id) {
    const [c, t] = await Promise.all([
      api(id, 'https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader&maxResults=250'),
      api(id, 'https://tasks.googleapis.com/tasks/v1/users/@me/lists?maxResults=100'),
    ]);
    return {
      calendars: (c.items || []).map((x) => ({ id: x.id, name: x.summaryOverride || x.summary || x.id, primary: !!x.primary })),
      taskLists: (t.items || []).map((x) => ({ id: x.id, name: x.title })),
    };
  }

  return { hasClient, isConnected, importClient, connect, disconnect, fetchEvents, fetchTasks, lists, migrateLegacy };
}

module.exports = { createGoogle, pkcePair, challengeOf, buildAuthUrl, normalizeEvent, normalizeEvents, normalizeTasks, isHolidayCalendar };
// 개정 기록 | 2026-11-11 | 최초 작성 | 설계서 §1 구글 인증·토큰 보관, 읽기 전용 두 범위
// 개정 기록 | 2026-11-11 | v1.3 | 화면 문구(가져오기 오류·연결 완료 페이지)를 lang()에 맞춰 생성, 제목 없는 일정은 빈 제목 | docs/v1.3-i18n-brief.md
// 개정 기록 | 2026-11-12 | 사람 여러 명 | 사용자 결정: 토큰·연결·가져오기를 사람 id별로, prompt=select_account consent, 옛 단일 토큰 파일 이관(migrateLegacy)
