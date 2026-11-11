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
      hwnd: user32.func('void* __stdcall GetForegroundWindow()'),
      cls: user32.func('int __stdcall GetClassNameW(void* hWnd, _Out_ uint16_t *buf, int n)'),
    };
  } catch { fns = false; }
  return fns;
}

// 맨 앞 창의 클래스 이름. 창이 없으면 '', 읽을 수 없으면 null
function foregroundClass() {
  const f = native();
  if (!f) return null;
  const h = f.hwnd();
  if (!h) return '';
  const buf = new Uint16Array(256);
  const n = f.cls(h, buf, 256);
  return String.fromCharCode(...buf.subarray(0, n));
}

function createForeground(bringToFront) {
  let iv = null;
  const stop = () => { clearInterval(iv); iv = null; };
  return {
    stop,
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

module.exports = { createForeground, foregroundClass, DESKTOP };
// 개정 기록 | 2026-11-11 | 최초 작성 | 설계서 §6 복귀 보조 장치
