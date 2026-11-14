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

test('인증 주소: 읽기 전용 두 범위·S256·offline·계정 선택+동의', () => {
  const u = new URL(G.buildAuthUrl({ client_id: 'cid' }, { redirect: 'http://127.0.0.1:5555', challenge: 'ch', state: 'st' }));
  assert.equal(u.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(u.searchParams.get('access_type'), 'offline');
  assert.equal(u.searchParams.get('scope'), 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/tasks.readonly');
  assert.equal(u.searchParams.get('redirect_uri'), 'http://127.0.0.1:5555');
  assert.equal(u.searchParams.get('prompt'), 'select_account consent');   // 이미 로그인한 계정이 있어도 두 번째 사람의 계정을 고를 수 있음
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
  assert.equal(G.normalizeEvent({ start: { date: '2026-11-12' }, end: { date: '2026-11-13' } }).title, '');   // 빈 제목은 화면이 언어에 맞는 '(제목 없음)'으로 보임
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

    await g.connect('p1');
    assert.equal(g.isConnected('p1'), true);
    assert.equal(g.isConnected('p2'), false);   // 연결은 사람마다 따로
    const raw = fs.readFileSync(path.join(dir, 'google-token-p1.bin'));
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
    await assert.rejects(g.connect('p1'), (e) => e.code === 'tokenUnavailable');
    assert.equal(g.isConnected('p1'), false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('연결 전·취소된 토큰은 needAuth', async () => {
  const dir = tmpDir();
  const { server, uri } = await fakeTokenServer((p, res) => json(res, 400, { error: 'invalid_grant' }));
  try {
    fs.writeFileSync(path.join(dir, 'google-client.json'), JSON.stringify({ installed: { client_id: 'cid', token_uri: uri } }));
    const safe = fakeSafe();
    const g = G.createGoogle({ dir, safe, openUrl: () => {} });
    await assert.rejects(g.fetchTasks('p1', '@default'), (e) => e.code === 'needAuth');   // 토큰 없음
    fs.writeFileSync(path.join(dir, 'google-token-p1.bin'), await safe.encrypt('OLD'));
    assert.equal(g.isConnected('p1'), true);
    await assert.rejects(g.fetchEvents('p1', ['primary']), (e) => e.code === 'needAuth');   // 서버가 invalid_grant
    assert.equal(g.isConnected('p1'), false);   // 취소된 토큰은 지움
  } finally { server.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

// ----- 사람 여러 명(v1.4) -----
test('사람별 토큰 파일: 두 사람을 따로 연결하고, 한 사람을 해제하면 그 사람 파일만 삭제', async () => {
  const dir = tmpDir();
  let n = 0;
  const { server, uri } = await fakeTokenServer((p, res) => {
    if (p.get('grant_type') === 'authorization_code') return json(res, 200, { access_token: 'A', refresh_token: 'R-' + p.get('code'), expires_in: 3600 });
    json(res, 200, {});
  });
  // 연결 해제는 구글 폐기 주소를 부르므로, 실제 구글로 나가지 않게 그 주소만 가로챈다
  const realFetch = globalThis.fetch;
  const revoked = [];
  globalThis.fetch = (u, o) => (String(u).includes('oauth2.googleapis.com/revoke') ? (revoked.push(String(o.body)), Promise.resolve(new Response('{}'))) : realFetch(u, o));
  try {
    fs.writeFileSync(path.join(dir, 'google-client.json'), JSON.stringify({ installed: { client_id: 'cid', token_uri: uri } }));
    const openUrl = async (url) => { const u = new URL(url); await fetch(`${u.searchParams.get('redirect_uri')}/?code=C${++n}&state=${u.searchParams.get('state')}`); };
    const g = G.createGoogle({ dir, safe: fakeSafe(), openUrl });
    await g.connect('p1'); await g.connect('p2');
    const files = fs.readdirSync(dir).filter((f) => f.startsWith('google-token'));
    assert.deepEqual(files.sort(), ['google-token-p1.bin', 'google-token-p2.bin']);
    const a = fs.readFileSync(path.join(dir, files[0])), b = fs.readFileSync(path.join(dir, files[1]));
    assert.ok(!a.equals(b), '두 사람이 같은 토큰 파일을 씀');
    assert.ok(!a.includes('R-C1') && !b.includes('R-C2'), '토큰이 평문으로 저장됨');
    await g.disconnect('p1');
    assert.equal(g.isConnected('p1'), false);
    assert.equal(g.isConnected('p2'), true);   // 다른 사람 연결은 그대로
    assert.deepEqual(fs.readdirSync(dir).filter((f) => f.startsWith('google-token')), ['google-token-p2.bin']);
    assert.equal(revoked.length, 1);   // 해제한 사람의 토큰만 폐기 요청
  } finally { globalThis.fetch = realFetch; server.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('사람 id 형식이 아니면 거부(파일 경로로 새지 않음)', async () => {
  const dir = tmpDir();
  try {
    const g = G.createGoogle({ dir, safe: fakeSafe(), openUrl: () => {} });
    assert.throws(() => g.isConnected('../x'), (e) => e.code === 'badPerson');
    assert.throws(() => g.isConnected(''), (e) => e.code === 'badPerson');
    await assert.rejects(g.connect('p1/../../x'), (e) => e.code === 'badPerson');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('옛 단일 토큰 파일 이관: 사람 1 파일로 옮기고 옛 파일 삭제, 내용 그대로(재로그인 불필요)', async () => {
  const dir = tmpDir();
  try {
    const safe = fakeSafe();
    const enc = await safe.encrypt('OLD-REFRESH');
    fs.writeFileSync(path.join(dir, 'google-token.bin'), enc);
    const g = G.createGoogle({ dir, safe, openUrl: () => {} });
    assert.equal(g.isConnected('p1'), true);   // 옮기기 전에도 옛 파일을 읽어 연결됨
    assert.equal(g.migrateLegacy(), 'moved');
    assert.ok(!fs.existsSync(path.join(dir, 'google-token.bin')));
    assert.ok(fs.readFileSync(path.join(dir, 'google-token-p1.bin')).equals(enc));
    assert.ok(!fs.existsSync(path.join(dir, 'google-token-p1.bin.tmp')));
    assert.equal(g.isConnected('p1'), true);
    assert.equal(g.isConnected('p2'), false);
    assert.equal(g.migrateLegacy(), 'none');   // 두 번째 실행은 할 일 없음
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('이관 실패(되돌릴 길): 옛 파일을 건드리지 않아 계속 연결되고, 다음 시작에 다시 시도', async () => {
  const dir = tmpDir();
  try {
    const safe = fakeSafe();
    const enc = await safe.encrypt('OLD-REFRESH');
    fs.writeFileSync(path.join(dir, 'google-token.bin'), enc);
    fs.mkdirSync(path.join(dir, 'google-token-p1.bin.tmp'));   // 임시 파일 자리를 폴더로 막아 복사를 실패시킴
    const g = G.createGoogle({ dir, safe, openUrl: () => {} });
    assert.equal(g.migrateLegacy(), 'failed');
    assert.ok(fs.readFileSync(path.join(dir, 'google-token.bin')).equals(enc), '옛 파일이 바뀜');
    assert.ok(!fs.existsSync(path.join(dir, 'google-token-p1.bin')));
    assert.equal(g.isConnected('p1'), true);   // 폴백: 옛 파일로 계속 동작
    fs.rmdirSync(path.join(dir, 'google-token-p1.bin.tmp'));
    assert.equal(g.migrateLegacy(), 'moved');   // 다음 시작에는 성공
    assert.equal(g.isConnected('p1'), true);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('이관 중 꺼졌던 경우(새 파일과 옛 파일이 둘 다 있음): 새 파일을 지키고 옛 파일만 삭제', async () => {
  const dir = tmpDir();
  try {
    const safe = fakeSafe();
    fs.writeFileSync(path.join(dir, 'google-token.bin'), await safe.encrypt('OLD'));
    const fresh = await safe.encrypt('NEW');
    fs.writeFileSync(path.join(dir, 'google-token-p1.bin'), fresh);
    const g = G.createGoogle({ dir, safe, openUrl: () => {} });
    assert.equal(g.migrateLegacy(), 'moved');
    assert.ok(fs.readFileSync(path.join(dir, 'google-token-p1.bin')).equals(fresh));
    assert.ok(!fs.existsSync(path.join(dir, 'google-token.bin')));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
// 개정 기록 | 2026-11-12 | 사람 여러 명 | 사용자 결정: 사람별 토큰 파일 분리·삭제, 이관·되돌릴 길, 계정 선택 prompt 시험
