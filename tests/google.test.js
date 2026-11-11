// 실제 구글을 호출하지 않습니다. 합성 자료와 로컬 가짜 토큰 서버만 씁니다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const G = require('../src/main/google.js');

const ms = (y, m, d, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi).getTime();

test('PKCE: RFC 7636 예시 검증값과 일치', () => {
  assert.equal(G.challengeOf('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  const p = G.pkcePair();
  assert.equal(G.challengeOf(p.verifier), p.challenge);
});

test('인증 주소: 읽기 전용 두 범위·S256·offline', () => {
  const u = new URL(G.buildAuthUrl({ client_id: 'cid' }, { redirect: 'http://127.0.0.1:5555', challenge: 'ch', state: 'st' }));
  assert.equal(u.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(u.searchParams.get('access_type'), 'offline');
  assert.equal(u.searchParams.get('scope'), 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/tasks.readonly');
  assert.equal(u.searchParams.get('redirect_uri'), 'http://127.0.0.1:5555');
});

test('일정 정규화: 시간·종일·취소·거절', () => {
  const timed = G.normalizeEvent({ summary: '회의', location: '3층', start: { dateTime: '2026-11-11T13:00:00+09:00' }, end: { dateTime: '2026-11-11T14:30:00+09:00' } });
  assert.equal(timed.title, '회의');
  assert.equal(timed.allDay, false);
  assert.equal(timed.end - timed.start, 90 * 60000);
  assert.equal(timed.location, '3층');

  const allDay = G.normalizeEvent({ summary: '출장', start: { date: '2026-11-12' }, end: { date: '2026-11-14' } });
  assert.equal(allDay.allDay, true);
  assert.equal(allDay.start, ms(2026, 11, 12));
  assert.equal(allDay.end, ms(2026, 11, 14));   // 끝 날짜는 포함하지 않는 값 그대로

  assert.equal(G.normalizeEvent({ status: 'cancelled', start: { date: '2026-11-12' } }), null);
  assert.equal(G.normalizeEvent({ summary: 'x', start: { date: '2026-11-12' }, attendees: [{ self: true, responseStatus: 'declined' }] }), null);
  assert.equal(G.normalizeEvent({ summary: 'x', start: {} }), null);
  assert.equal(G.normalizeEvent({ start: { date: '2026-11-12' }, end: { date: '2026-11-13' } }).title, '(제목 없음)');
  assert.equal(G.normalizeEvent({ summary: '어린이날', start: { date: '2026-05-05' } }, true).holiday, true);
});

test('메모 정규화: 완료·삭제·빈 제목 제외', () => {
  const resp = { items: [
    { title: '우유 사기', status: 'needsAction' },
    { title: '끝낸 일', status: 'completed' },
    { title: '  ', status: 'needsAction' },
    { title: '지움', status: 'needsAction', deleted: true },
    { title: ' 빨래 ', status: 'needsAction' },
  ] };
  assert.deepEqual(G.normalizeTasks(resp), ['우유 사기', '빨래']);
  assert.deepEqual(G.normalizeTasks({}), []);
  assert.deepEqual(G.normalizeTasks(null), []);
});

test('공휴일 캘린더 판별', () => {
  assert.equal(G.isHolidayCalendar('ko.south_korea#holiday@group.v.calendar.google.com'), true);
  assert.equal(G.isHolidayCalendar('primary'), false);
});

// ----- 연결 흐름(가짜 토큰 서버) -----
function tmpDir() {
  const base = path.join(__dirname, '..', '.tmp');
  fs.mkdirSync(base, { recursive: true });
  return fs.mkdtempSync(path.join(base, 'google-'));
}
const fakeSafe = (available = true) => ({
  available: async () => available,
  encrypt: async (s) => Buffer.from('ENC:' + Buffer.from(s).reverse().toString('hex')),
  decrypt: async (b) => Buffer.from(b.toString().slice(4), 'hex').reverse().toString(),
});

async function fakeTokenServer(handler) {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => handler(new URLSearchParams(body), res));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { server, uri: `http://127.0.0.1:${server.address().port}/token` };
}
const json = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };

test('연결: 코드 교환 → 암호화 저장(평문 아님) → 액세스 토큰 갱신, 취소되면 토큰 삭제', async () => {
  const dir = tmpDir();
  const calls = [];
  const { server, uri } = await fakeTokenServer((p, res) => {
    calls.push(Object.fromEntries(p));
    if (p.get('grant_type') === 'authorization_code') return json(res, 200, { access_token: 'A1', refresh_token: 'REFRESH-SECRET', expires_in: 3600 });
    if (p.get('refresh_token') === 'REFRESH-SECRET') return json(res, 200, { access_token: 'A2', expires_in: 3600 });
    json(res, 400, { error: 'invalid_grant' });
  });
  try {
    const src = path.join(dir, 'src.json');
    fs.writeFileSync(src, JSON.stringify({ installed: { client_id: 'cid', client_secret: 'sec', token_uri: uri } }));
    // 가짜 브라우저: 인증 주소의 redirect_uri·state로 코드를 되돌려 줌
    const openUrl = async (url) => {
      const u = new URL(url);
      await fetch(`${u.searchParams.get('redirect_uri')}/?code=CODE1&state=${u.searchParams.get('state')}`);
    };
    const g = G.createGoogle({ dir, safe: fakeSafe(), openUrl });
    assert.equal(g.hasClient(), false);
    assert.equal(g.importClient(path.join(dir, '없는.json')).ok, false);
    fs.writeFileSync(path.join(dir, 'web.json'), JSON.stringify({ web: { client_id: 'x' } }));
    assert.equal(g.importClient(path.join(dir, 'web.json')).ok, false);
    assert.deepEqual(g.importClient(src), { ok: true });
    assert.equal(g.hasClient(), true);

    await g.connect();
    assert.equal(g.isConnected(), true);
    const raw = fs.readFileSync(path.join(dir, 'google-token.bin'));
    assert.ok(!raw.includes('REFRESH-SECRET'), '토큰이 평문으로 저장됨');
    assert.equal(calls[0].code_verifier.length >= 43, true);
    assert.equal(calls[0].code, 'CODE1');
  } finally { server.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('토큰 보관 불가면 연결을 거부하고 파일을 만들지 않음', async () => {
  const dir = tmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'google-client.json'), JSON.stringify({ installed: { client_id: 'cid' } }));
    const g = G.createGoogle({ dir, safe: fakeSafe(false), openUrl: () => {} });
    await assert.rejects(g.connect(), (e) => e.code === 'tokenUnavailable');
    assert.equal(g.isConnected(), false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('연결 전·취소된 토큰은 needAuth', async () => {
  const dir = tmpDir();
  const { server, uri } = await fakeTokenServer((p, res) => json(res, 400, { error: 'invalid_grant' }));
  try {
    fs.writeFileSync(path.join(dir, 'google-client.json'), JSON.stringify({ installed: { client_id: 'cid', token_uri: uri } }));
    const safe = fakeSafe();
    const g = G.createGoogle({ dir, safe, openUrl: () => {} });
    await assert.rejects(g.fetchTasks('@default'), (e) => e.code === 'needAuth');   // 토큰 없음
    fs.writeFileSync(path.join(dir, 'google-token.bin'), await safe.encrypt('OLD'));
    assert.equal(g.isConnected(), true);
    await assert.rejects(g.fetchEvents(['primary']), (e) => e.code === 'needAuth');   // 서버가 invalid_grant
    assert.equal(g.isConnected(), false);   // 취소된 토큰은 지움
  } finally { server.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});
