// 실행 직후 10분 동안만 1초마다 맨 앞 창을 확인해, 바탕화면·작업표시줄이면 대시보드를 앞으로 가져옵니다(복귀 보조 장치).
const DESKTOP = new Set(['Progman', 'WorkerW', 'Shell_TrayWnd']);
const WATCH_MS = 10 * 60 * 1000;
const NEEDED = 2;   // 창이 막 뜨는 순간의 일시적 '창 없음'을 복귀로 오인하지 않도록 연속 2회 확인

let fns = null;
function native() {
  if (fns) return fns;
  try {
    const koffi = require('koffi');
    const user32 = koffi.load('user32.dll');
    fns = {
      hwnd: user32.func('uintptr_t __stdcall GetForegroundWindow()'),
      cls: user32.func('int __stdcall GetClassNameW(uintptr_t hWnd, _Out_ uint16_t *buf, int n)'),
    };
  } catch { fns = false; }
  return fns;
}

// 맨 앞 창 { hwnd(문자열, 없으면 ''), cls }. 읽을 수 없으면 null
function foregroundInfo() {
  const f = native();
  if (!f) return null;
  const h = f.hwnd();
  if (!h) return { hwnd: '', cls: '' };
  const buf = new Uint16Array(256);
  const n = f.cls(h, buf, 256);
  return { hwnd: String(h), cls: String.fromCharCode(...buf.subarray(0, n)) };
}

// 맨 앞 창의 클래스 이름. 창이 없으면 '', 읽을 수 없으면 null
function foregroundClass() {
  const i = foregroundInfo();
  return i ? i.cls : null;
}

// 사용자 의도 [2026-11-11 요청]: 실행한 앱이 맨 앞에 완전히 뜬 뒤에만 키를 보낸다(시계나 바탕화면에 보내면 안 됨).
// 개발 판단: 맨 앞 창 표본을 순수 함수로 판정한다. 시계 창·바탕화면/작업표시줄이 아닌 같은 창이 STABLE_MS 이상 이어졌을 때만 true.
// 첫 실행이 느린 앱(ChatGPT 등)은 창이 떠도 아직 키를 못 받아 키가 사라지므로, true 이후 CONFIRM_MS를 더 기다려 같은 창이 맨 앞인지 다시 확인한 뒤 보낸다(전체 10초 제한 안).
const POLL_MS = 200;
const STABLE_MS = 1000;
const CONFIRM_MS = 700;
const SEND_TIMEOUT_MS = 10 * 1000;
// samples: [{ t, hwnd, cls }] 시간순, selfHwnd: 시계 창 핸들(문자열), now: 현재 시각(ms)
function shouldSend(samples, selfHwnd, now) {
  const last = samples[samples.length - 1];
  const usable = (s) => s.hwnd !== '' && s.hwnd !== selfHwnd && !DESKTOP.has(s.cls);
  if (!last || !usable(last)) return false;
  let start = last.t;
  for (let i = samples.length - 1; i >= 0 && samples[i].hwnd === last.hwnd; i--) start = samples[i].t;
  return now - start >= STABLE_MS;
}

// 재확인: 지금 맨 앞 창이 아직 같은 앱 창(시계·바탕화면 계열이 아님)인가
function confirmSend(hwnd, info, selfHwnd) {
  return !!info && info.hwnd === hwnd && hwnd !== selfHwnd && !DESKTOP.has(info.cls);
}

function createForeground(bringToFront) {
  let iv = null, wait = null;
  const stop = () => { clearInterval(iv); iv = null; };
  const cancelWait = () => { clearInterval(wait); wait = null; };
  return {
    stop,
    cancelWait,
    // 안정된 앱 창이 뜨면 onReady(), 10초 안에 안 뜨면(또는 창을 읽을 수 없으면) onTimeout(). 새로 부르면 앞의 대기는 취소
    waitStable(selfHwnd, onReady, onTimeout) {
      cancelWait();
      const t0 = Date.now(), samples = [];
      let cand = null, confirmAt = 0;   // 안정 판정이 난 창과 재확인 시각
      const tick = () => {
        const now = Date.now(), i = foregroundInfo();
        if (i) samples.push({ t: now, ...i });
        if (samples.length > 60) samples.shift();
        if (cand !== null && !confirmSend(cand, i, selfHwnd)) cand = null;   // 그 사이 창이 바뀌면 처음부터 다시 판정
        if (cand !== null && now >= confirmAt) { cancelWait(); return onReady(); }
        if (cand === null && shouldSend(samples, selfHwnd, now)) { cand = samples[samples.length - 1].hwnd; confirmAt = now + CONFIRM_MS; }
        if (!i || now - t0 > SEND_TIMEOUT_MS) { cancelWait(); onTimeout(); }
      };
      wait = setInterval(tick, POLL_MS);
    },
    watch() {
      stop();
      const until = Date.now() + WATCH_MS;
      let streak = 0;
      iv = setInterval(() => {
        if (Date.now() > until) return stop();
        const c = foregroundClass();
        streak = c !== null && (c === '' || DESKTOP.has(c)) ? streak + 1 : 0;
        if (streak >= NEEDED) { streak = 0; bringToFront(); }
      }, 1000);
    },
  };
}

module.exports = { createForeground, foregroundClass, foregroundInfo, shouldSend, confirmSend, DESKTOP, STABLE_MS, CONFIRM_MS };
// 개정 기록 | 2026-11-11 | 최초 작성 | 설계서 §6 복귀 보조 장치
// 개정 기록 | 2026-11-11 | 실행 후 키 보내기 | 사용자 요청: 맨 앞 창 핸들·표본 판정(shouldSend)·대기(waitStable) 추가
// 개정 기록 | 2026-11-11 | 실행 후 키 보내기 | 사용자 요청: 안정 창 시간 600→1000ms, 판정 뒤 700ms 재확인(confirmSend) 추가(첫 실행이 느린 앱 대비)
