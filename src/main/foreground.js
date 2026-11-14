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
    const kernel32 = koffi.load('kernel32.dll');
    fns = {
      hwnd: user32.func('uintptr_t __stdcall GetForegroundWindow()'),
      cls: user32.func('int __stdcall GetClassNameW(uintptr_t hWnd, _Out_ uint16_t *buf, int n)'),
      allowSetForegroundWindow: user32.func('int __stdcall AllowSetForegroundWindow(uint32_t dwProcessId)'),
      isWindow: user32.func('int __stdcall IsWindow(uintptr_t hWnd)'),
      isIconic: user32.func('int __stdcall IsIconic(uintptr_t hWnd)'),
      showWindow: user32.func('int __stdcall ShowWindow(uintptr_t hWnd, int nCmdShow)'),
      setForegroundWindow: user32.func('int __stdcall SetForegroundWindow(uintptr_t hWnd)'),
      bringWindowToTop: user32.func('int __stdcall BringWindowToTop(uintptr_t hWnd)'),
      getWindowThreadProcessId: user32.func('uint32_t __stdcall GetWindowThreadProcessId(uintptr_t hWnd, uintptr_t lpdwProcessId)'),
      attachThreadInput: user32.func('int __stdcall AttachThreadInput(uint32_t idAttach, uint32_t idAttachTo, int fAttach)'),
      getCurrentThreadId: kernel32.func('uint32_t __stdcall GetCurrentThreadId()'),
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
// 사용자 의도 [2026-11-11 요청]: 슬롯 실행 뒤 ChatGPT 창이 시계를 가리면, 키를 보낸 뒤(키가 없으면 앱 창이 안정된 뒤) 1.5초 지나 시계를 다시 앞으로 가져온다.
// 개발 판단: 켠 슬롯(=== true)만 대상이라 누락·잘못된 값은 끔. 지연은 cancelWait가 함께 취소해 다른 슬롯을 누르면 돌아오기도 취소된다.
const RETURN_DELAY_MS = 1500;
const shouldReturn = (slot) => !!slot && slot.returnToClock === true;
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

const SW_RESTORE = 9;
const SW_SHOW = 5;
const ASFW_ANY = -1;

function allowSetForegroundWindow(pid = ASFW_ANY) {
  const f = native();
  if (!f) return false;
  try {
    return f.allowSetForegroundWindow(pid) !== 0;
  } catch {
    return false;
  }
}

function isWindowAlive(hwnd, f = native()) {
  if (!hwnd || !f) return false;
  try {
    return f.isWindow(BigInt(hwnd)) !== 0;
  } catch {
    return false;
  }
}

function isWindowMinimized(hwnd, f = native()) {
  if (!hwnd || !f) return false;
  try {
    return f.isIconic(BigInt(hwnd)) !== 0;
  } catch {
    return false;
  }
}

function focusWindow(hwnd, f = native()) {
  if (!hwnd || !f) return false;
  try {
    const h = BigInt(hwnd);
    if (!f.isWindow(h)) return false;
    const iconic = f.isIconic(h);
    f.showWindow(h, iconic ? SW_RESTORE : SW_SHOW);
    f.allowSetForegroundWindow(ASFW_ANY);
    const ok = f.setForegroundWindow(h);
    if (!ok) {
      const curThread = f.getCurrentThreadId ? f.getCurrentThreadId() : 0;
      const targetThread = f.getWindowThreadProcessId ? f.getWindowThreadProcessId(h, 0) : 0;
      let attached = false;
      try {
        if (curThread && targetThread && curThread !== targetThread) {
          attached = f.attachThreadInput(curThread, targetThread, 1) !== 0;
        }
        f.setForegroundWindow(h);
        f.bringWindowToTop(h);
      } finally {
        if (attached) {
          f.attachThreadInput(curThread, targetThread, 0);
        }
      }
    }
    return true;
  } catch {
    return false;
  }
}

function decideLaunch({ rememberedAlive, isMinimized } = {}) {
  if (rememberedAlive) return 'focus-existing';
  return 'launch';
}

function createForeground(bringToFront) {
  let iv = null, wait = null, back = null;
  const slotWindows = new Map();
  const stop = () => { clearInterval(iv); iv = null; };
  const cancelWait = () => { clearInterval(wait); wait = null; clearTimeout(back); back = null; };
  return {
    stop,
    cancelWait,
    rememberSlotWindow(slotKey, hwnd) {
      if (hwnd) slotWindows.set(Number(slotKey), String(hwnd));
      else slotWindows.delete(Number(slotKey));
    },
    getSlotWindow(slotKey) {
      return slotWindows.get(Number(slotKey)) || null;
    },
    clearSlotWindows() {
      slotWindows.clear();
    },
    allowSetForegroundWindow,
    isWindowAlive,
    isWindowMinimized,
    focusWindow,
    decideLaunch,
    // 안정된 앱 창이 뜨면 onReady(hwnd), 10초 안에 안 뜨면(또는 창을 읽을 수 없으면) onTimeout(). 새로 부르면 앞의 대기는 취소
    waitStable(selfHwnd, onReady, onTimeout) {
      cancelWait();
      const t0 = Date.now(), samples = [];
      let cand = null, confirmAt = 0;   // 안정 판정이 난 창과 재확인 시각
      const tick = () => {
        const now = Date.now(), i = foregroundInfo();
        if (i) samples.push({ t: now, ...i });
        if (samples.length > 60) samples.shift();
        if (cand !== null && !confirmSend(cand, i, selfHwnd)) cand = null;   // 그 사이 창이 바뀌면 처음부터 다시 판정
        if (cand !== null && now >= confirmAt) {
          const readyHwnd = cand;
          cancelWait();
          return onReady(readyHwnd);
        }
        if (cand === null && shouldSend(samples, selfHwnd, now)) { cand = samples[samples.length - 1].hwnd; confirmAt = now + CONFIRM_MS; }
        if (!i || now - t0 > SEND_TIMEOUT_MS) { cancelWait(); onTimeout(); }
      };
      wait = setInterval(tick, POLL_MS);
    },
    // 1.5초 뒤 시계를 앞으로(새 슬롯 실행·cancelWait 시 취소)
    returnLater() { clearTimeout(back); back = setTimeout(() => { back = null; bringToFront(); }, RETURN_DELAY_MS); },
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

module.exports = {
  createForeground,
  foregroundClass,
  foregroundInfo,
  shouldSend,
  confirmSend,
  shouldReturn,
  allowSetForegroundWindow,
  isWindowAlive,
  isWindowMinimized,
  focusWindow,
  decideLaunch,
  RETURN_DELAY_MS,
  DESKTOP,
  STABLE_MS,
  CONFIRM_MS,
  SW_RESTORE,
  SW_SHOW,
  ASFW_ANY,
};
// 개정 기록 | 2026-11-11 | 최초 작성 | 설계서 §6 복귀 보조 장치
// 개정 기록 | 2026-11-11 | 실행 후 키 보내기 | 사용자 요청: 맨 앞 창 핸들·표본 판정(shouldSend)·대기(waitStable) 추가
// 개정 기록 | 2026-11-11 | 실행 후 키 보내기 | 사용자 요청: 안정 창 시간 600→1000ms, 판정 뒤 700ms 재확인(confirmSend) 추가(첫 실행이 느린 앱 대비)
// 개정 기록 | 2026-11-11 | 실행 후 시계로 돌아오기 | 사용자 요청: shouldReturn·returnLater 추가(키 보낸 뒤/앱 창 안정 뒤 1.5초 후 시계를 앞으로, cancelWait 로 함께 취소)
// 개정 기록 | 2026-11-15 | 슬롯 창 기억·재사용과 포그라운드 허락 | 사용자 요청
