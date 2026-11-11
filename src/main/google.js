// 구글 연동: 데스크톱 OAuth(루프백 + PKCE), Calendar·Tasks 읽기 전용.
// electron 객체(safeStorage 어댑터·열기)는 주입받아 시험에서 실제 구글·실제 키 보관소를 쓰지 않습니다.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

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
    access_type: 'offline', prompt: 'consent',   // 매번 consent여야 refresh token이 확실히 옴
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
  return { title: item.summary || '(제목 없음)', location: item.location || '', allDay, start, end, holiday };
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
function createGoogle({ dir, safe, openUrl, now = Date.now }) {
  const clientFile = path.join(dir, 'google-client.json');
  const tokenFile = path.join(dir, 'google-token.bin');
  let access = null;   // { token, exp }

  function client() {
    try {
      const j = JSON.parse(fs.readFileSync(clientFile, 'utf8'));
      return j.installed && j.installed.client_id ? j.installed : null;
    } catch { return null; }
  }
  const hasClient = () => !!client();
  const isConnected = () => fs.existsSync(tokenFile);

  // 사용자가 고른 클라이언트 JSON을 검증해 userData로 복사(원본 경로는 저장하지 않음)
  function importClient(srcPath) {
    let j;
    try { j = JSON.parse(fs.readFileSync(srcPath, 'utf8')); } catch { return { ok: false, error: '파일을 읽을 수 없음' }; }
    if (!j.installed || !j.installed.client_id) return { ok: false, error: '데스크톱 앱용 클라이언트 JSON이 아님' };
    fs.writeFileSync(clientFile, JSON.stringify({ installed: j.installed }));
    return { ok: true };
  }

  // refresh token은 DPAPI(safeStorage)로 암호화해서만 저장. 불가하면 평문으로 대신 저장하지 않음
  async function saveRefresh(token) {
    if (!(await safe.available())) throw fail('tokenUnavailable', '토큰 보관 불가');
    fs.writeFileSync(tokenFile, await safe.encrypt(token));
  }
  async function loadRefresh() {
    if (!fs.existsSync(tokenFile)) return null;
    if (!(await safe.available())) throw fail('tokenUnavailable', '토큰 보관 불가');
    return safe.decrypt(fs.readFileSync(tokenFile));
  }
  function dropToken() { access = null; try { fs.unlinkSync(tokenFile); } catch { /* 없음 */ } }

  async function tokenRequest(c, params) {
    const body = new URLSearchParams({ client_id: c.client_id, ...(c.client_secret ? { client_secret: c.client_secret } : {}), ...params });
    const res = await fetch(c.token_uri || 'https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(15000),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw fail(j.error === 'invalid_grant' ? 'needAuth' : 'failed', j.error || `HTTP ${res.status}`);
    return j;
  }

  async function accessToken() {
    if (access && access.exp > now() + 60000) return access.token;
    const refresh = await loadRefresh();
    const c = client();
    if (!refresh || !c) throw fail('needAuth');
    try {
      const j = await tokenRequest(c, { grant_type: 'refresh_token', refresh_token: refresh });
      access = { token: j.access_token, exp: now() + (j.expires_in || 3600) * 1000 };
    } catch (e) {
      if (e.code === 'needAuth') dropToken();   // 취소·만료된 토큰이면 다시 연결하도록
      throw e;
    }
    return access.token;
  }

  async function connect() {
    const c = client();
    if (!c) throw fail('needAuth', '클라이언트 JSON 필요');
    if (!(await safe.available())) throw fail('tokenUnavailable', '토큰 보관 불가');
    const { verifier, challenge } = pkcePair();
    const state = b64url(crypto.randomBytes(16));
    const server = http.createServer();
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const redirect = `http://127.0.0.1:${server.address().port}`;
    try {
      const code = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(fail('failed', '연결 시간 초과')), 3 * 60 * 1000);
        server.on('request', (req, res) => {
          const u = new URL(req.url, redirect);
          if (u.pathname !== '/') { res.writeHead(404).end(); return; }   // favicon 등은 무시
          const ok = u.searchParams.get('state') === state && u.searchParams.get('code');
          res.writeHead(ok ? 200 : 400, { 'content-type': 'text/html; charset=utf-8' });
          res.end(`<meta charset="utf-8"><body style="font:18px sans-serif;padding:48px">${ok ? '연결되었습니다. 이 창을 닫아도 됩니다.' : '연결에 실패했습니다. 시계 설정에서 다시 시도해 주십시오.'}</body>`);
          clearTimeout(timer);
          ok ? resolve(u.searchParams.get('code')) : reject(fail('failed', u.searchParams.get('error') || '연결 거부'));
        });
        Promise.resolve().then(() => openUrl(buildAuthUrl(c, { redirect, challenge, state }))).catch((e) => { clearTimeout(timer); reject(e); });
      });
      const j = await tokenRequest(c, { grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: redirect });
      if (!j.refresh_token) throw fail('failed', 'refresh token 없음');
      await saveRefresh(j.refresh_token);
      access = { token: j.access_token, exp: now() + (j.expires_in || 3600) * 1000 };
    } finally { server.close(); }
  }

  async function disconnect() {
    try {
      const t = await loadRefresh();
      if (t) await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: t }), signal: AbortSignal.timeout(8000) });
    } catch { /* 폐기 요청 실패는 무시하고 로컬 토큰만 지움 */ }
    dropToken();
  }

  // ----- API -----
  async function api(url, retry = true) {
    const res = await fetch(url, { headers: { authorization: `Bearer ${await accessToken()}` }, signal: AbortSignal.timeout(15000) });
    if (res.status === 401 && retry) { access = null; return api(url, false); }
    if (!res.ok) throw fail('failed', `HTTP ${res.status}`);
    return res.json();
  }

  // 오늘 0시부터 8일 치(오늘 + 내일부터 7일)
  async function fetchEvents(calendarIds) {
    const from = new Date(); from.setHours(0, 0, 0, 0);
    const q = new URLSearchParams({ timeMin: from.toISOString(), timeMax: new Date(from.getTime() + 8 * DAY).toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '100' });
    const lists = await Promise.all(calendarIds.map(async (id) => normalizeEvents((await api(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(id)}/events?${q}`)).items, isHolidayCalendar(id))));
    return lists.flat();
  }
  async function fetchTasks(listId) {
    return normalizeTasks(await api(`https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(listId).replace('%40', '@')}/tasks?showCompleted=false&maxResults=100`));
  }
  async function lists() {
    const [c, t] = await Promise.all([
      api('https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader&maxResults=250'),
      api('https://tasks.googleapis.com/tasks/v1/users/@me/lists?maxResults=100'),
    ]);
    return {
      calendars: (c.items || []).map((x) => ({ id: x.id, name: x.summaryOverride || x.summary || x.id, primary: !!x.primary })),
      taskLists: (t.items || []).map((x) => ({ id: x.id, name: x.title })),
    };
  }

  return { hasClient, isConnected, importClient, connect, disconnect, fetchEvents, fetchTasks, lists };
}

module.exports = { createGoogle, pkcePair, challengeOf, buildAuthUrl, normalizeEvent, normalizeEvents, normalizeTasks, isHolidayCalendar };
// 개정 기록 | 2026-11-11 | 최초 작성 | 설계서 §1 구글 인증·토큰 보관, 읽기 전용 두 범위
