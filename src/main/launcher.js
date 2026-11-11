// 슬롯 실행: 웹은 선택한 브라우저를 --app=URL로(사용자의 기존 프로필 그대로), 프로그램은 shell.openPath.
const { execFile, spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const BROWSERS = {
  brave: { exe: 'brave.exe', rel: ['BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'] },
  chrome: { exe: 'chrome.exe', rel: ['Google', 'Chrome', 'Application', 'chrome.exe'] },
  edge: { exe: 'msedge.exe', rel: ['Microsoft', 'Edge', 'Application', 'msedge.exe'] },
};

// reg.exe 출력에서 (기본값) 경로만 꺼냄
function parseRegDefault(text) {
  const m = /REG_SZ\s+(.+?)\s*$/m.exec(String(text));
  return m ? m[1].replace(/^"|"$/g, '') : null;
}

function regQuery(hive, exe) {
  return new Promise((resolve) => {
    const key = [hive, 'SOFTWARE', 'Microsoft', 'Windows', 'CurrentVersion', 'App Paths', exe].join(path.sep);
    execFile('reg', ['query', key, '/ve'], { encoding: 'buffer', windowsHide: true, timeout: 5000 }, (err, out) => {
      if (err) return resolve(null);
      // 한국어 Windows의 reg 출력은 CP949라 경로에 한글이 있어도 읽히게 디코딩
      let text;
      try { text = new TextDecoder('euc-kr').decode(out); } catch { text = out.toString('utf8'); }
      resolve(parseRegDefault(text));
    });
  });
}

const cache = {};
async function findBrowser(kind) {
  const b = BROWSERS[kind];
  if (!b) return null;
  if (cache[kind] && fs.existsSync(cache[kind])) return cache[kind];
  const candidates = [await regQuery('HKLM', b.exe), await regQuery('HKCU', b.exe)];
  for (const root of [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA]) {
    if (root) candidates.push(path.join(root, ...b.rel));
  }
  const found = candidates.find((p) => p && fs.existsSync(p));
  if (found) cache[kind] = found;
  return found || null;
}

// 실행 파일이 시작에 성공했는지(spawn 이벤트)만 확인하고 분리해서 둠
function spawnDetached(exe, args) {
  return new Promise((resolve) => {
    const child = spawn(exe, args, { detached: true, stdio: 'ignore', windowsHide: false });
    child.once('error', () => resolve(false));
    child.once('spawn', () => { child.unref(); resolve(true); });
  });
}

const isWebUrl = (u) => /^https?:\/\/\S+$/i.test(u);

// 반환: { ok } 또는 { ok:false, reason:'empty'|'fail' } — 실패해도 창·대화상자는 띄우지 않음
async function launchSlot(slot, browser, shell) {
  if (!slot || !slot.target) return { ok: false, reason: 'empty' };
  try {
    if (slot.kind === 'program') return (await shell.openPath(slot.target)) === '' ? { ok: true } : { ok: false, reason: 'fail' };
    if (!isWebUrl(slot.target)) return { ok: false, reason: 'fail' };
    if (browser === 'default') { await shell.openExternal(slot.target); return { ok: true }; }
    const exe = await findBrowser(browser);
    if (!exe) return { ok: false, reason: 'fail' };
    const ok = await spawnDetached(exe, slot.appWindow ? [`--app=${slot.target}`] : [slot.target]);
    return ok ? { ok: true } : { ok: false, reason: 'fail' };
  } catch {
    return { ok: false, reason: 'fail' };
  }
}

module.exports = { launchSlot, findBrowser, parseRegDefault, isWebUrl };
// 개정 기록 | 2026-11-11 | 최초 작성 | 설계서 §6 실행·복귀
