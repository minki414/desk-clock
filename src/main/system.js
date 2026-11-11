// 시스템 연동: 볼륨 키 전송, 상태 점 감시, 야간 감광.
const { execFile, execFileSync } = require('node:child_process');
const { isNight } = require('../renderer/model.js');

// ----- 볼륨 -----
const VK_VOLUME_DOWN = 0xae, VK_VOLUME_UP = 0xaf, KEYUP = 2;

let keybd = null;
function press(vk) {
  if (keybd === null) {
    try { keybd = require('koffi').load('user32.dll').func('void __stdcall keybd_event(uint8_t bVk, uint8_t bScan, uint32_t dwFlags, uintptr_t dwExtraInfo)'); }
    catch { keybd = false; }
  }
  if (!keybd) return;
  keybd(vk, 0, 0, 0);
  keybd(vk, 0, KEYUP, 0);
}

// 1회 누름당 볼륨 키 2번(약 4%) — 설계서 §1
function volume(up) {
  const vk = up ? VK_VOLUME_UP : VK_VOLUME_DOWN;
  press(vk); press(vk);
}

// ----- 상태 점: 네트워크와 등록한 서버 주소를 60초마다 확인 -----
const NET_URL = 'https://www.google.com/generate_204';

// HTTP 응답이 3초 안에 오면 정상(상태 코드는 따지지 않음)
async function reachable(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000), redirect: 'manual' });
    if (res.body) res.body.cancel().catch(() => {});
    return true;
  } catch { return false; }
}

async function checkHealth(servers) {
  if (!(await reachable(NET_URL))) return 'net';
  const up = await Promise.all(servers.filter((s) => s.url).map((s) => reachable(s.url)));
  return up.every(Boolean) ? 'ok' : 'server';
}

// 설정창의 서버별 상태 점용: 서버마다 true/false, 주소가 빈 행은 null
const serverStates = (servers) => Promise.all(servers.map((s) => (s.url ? reachable(s.url) : null)));

function createHealth({ getServers, onChange }) {
  let last = null, iv = null;
  async function check() {
    const h = await checkHealth(getServers());
    if (h !== last) { last = h; onChange(h); }
  }
  return { check, start() { check(); iv = setInterval(check, 60 * 1000); }, stop() { clearInterval(iv); } };
}

// ----- 야간 감광: WMI로 패널 밝기를 낮추고, 안 되면 검은 막 -----
const OVERLAY = 0.6;
const PS_ARGS = ['-NoProfile', '-NonInteractive', '-Command'];
const READ = '(Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness | Select-Object -First 1).CurrentBrightness';
const setCmd = (n) => `Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods | Invoke-CimMethod -MethodName WmiSetBrightness -Arguments @{Timeout=1;Brightness=${Math.max(0, Math.min(100, Math.round(n)))}} | Out-Null`;

const ps = (cmd) => new Promise((resolve, reject) => {
  execFile('powershell.exe', [...PS_ARGS, cmd], { windowsHide: true, timeout: 15000 }, (err, out) => (err ? reject(err) : resolve(String(out))));
});

async function readBrightness() {
  try {
    const n = parseInt(await ps(READ), 10);
    return Number.isFinite(n) ? n : null;
  } catch { return null; }
}
const writeBrightness = (n) => ps(setCmd(n)).then(() => true, () => false);

// setDim(patch): settings.dim에 기록(비정상 종료 뒤 다음 시작 때 복구하기 위함)
function createDimmer({ getSettings, setDim, onOverlay }) {
  let busy = false, iv = null;
  async function tick() {
    if (busy) return;
    busy = true;
    try {
      const s = getSettings(), d = s.dim;
      const want = s.nightDim && isNight(new Date(), s);
      if (want && !d.active) {
        // 사용자가 야간 중에 직접 바꾼 밝기를 존중하려고, 전환 시점에 한 번만 낮춤
        const orig = await readBrightness();
        if (orig !== null && (await writeBrightness(s.minBrightness))) setDim({ active: true, mode: 'wmi', original: orig });
        else setDim({ active: true, mode: 'overlay', original: null });
      } else if (!want && d.active) {
        if (d.mode === 'wmi' && d.original !== null) await writeBrightness(d.original);
        setDim({ active: false, mode: 'wmi', original: null });
      }
      const now = getSettings().dim;
      onOverlay(now.active && now.mode === 'overlay' ? OVERLAY : 0);
    } finally { busy = false; }
  }
  // 종료 때는 비동기를 기다릴 수 없어 동기 호출로 원래 밝기를 되돌림
  function restoreSync() {
    const d = getSettings().dim;
    if (!d.active) return;
    if (d.mode === 'wmi' && d.original !== null) {
      try { execFileSync('powershell.exe', [...PS_ARGS, setCmd(d.original)], { windowsHide: true, timeout: 8000 }); } catch { /* 다음 시작 때 다시 시도 */ }
    }
    setDim({ active: false, mode: 'wmi', original: null });
  }
  return { tick, restoreSync, start() { tick(); iv = setInterval(tick, 60 * 1000); }, stop() { clearInterval(iv); } };
}

module.exports = { volume, createHealth, checkHealth, serverStates, createDimmer, readBrightness };
// 개정 기록 | 2026-11-11 | 최초 작성 | 설계서 §1 볼륨·상태 점, §8 야간 감광
// 개정 기록 | 2026-11-11 | v1.2 | serverStates 추가 | 설정창 감시 서버 행별 상태 점
