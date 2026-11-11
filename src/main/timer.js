// 타이머 마감 시각(endAt)을 메인 프로세스가 보관합니다. 창이 가려져 렌더러가 느려져도 정확히 울리게 하려는 것입니다.
const RING_MS = 3 * 60 * 1000;   // 알림은 최대 3분 뒤 자동 정지

function createTimer({ onChange, onFinish }) {
  let s = { phase: 'idle', endAt: 0, remainingMs: 0, totalMs: 0 };
  let tFinish = null;
  let tRing = null;

  const clear = () => { clearTimeout(tFinish); clearTimeout(tRing); tFinish = tRing = null; };
  const set = (patch) => { s = { ...s, ...patch }; onChange(s); return s; };

  function arm() {
    clearTimeout(tFinish);
    tFinish = setTimeout(check, Math.max(0, s.endAt - Date.now()));
  }

  // 절전 복귀 뒤에는 setTimeout이 늦을 수 있어 resume 때도 호출합니다.
  function check() {
    if (s.phase !== 'running') return;
    if (Date.now() < s.endAt) return arm();   // 일찍 깨어난 경우 다시 대기
    set({ phase: 'ringing', remainingMs: 0 });
    onFinish();
    tRing = setTimeout(() => set({ phase: 'idle' }), RING_MS);
  }

  return {
    snapshot: () => s,
    check,
    start(ms) {
      clear();
      set({ phase: 'running', endAt: Date.now() + ms, remainingMs: ms, totalMs: ms });
      arm();
    },
    pause() {
      if (s.phase !== 'running') return;
      clear();
      set({ phase: 'paused', remainingMs: Math.max(0, s.endAt - Date.now()) });
    },
    resume() {
      if (s.phase !== 'paused') return;
      set({ phase: 'running', endAt: Date.now() + s.remainingMs });
      arm();
    },
    cancel() {
      clear();
      set({ phase: 'idle', endAt: 0, remainingMs: 0, totalMs: 0 });
    },
  };
}

module.exports = { createTimer, RING_MS };
// 개정 기록 | 2026-11-11 | 최초 작성 | 설계서 §5 마감 시각은 메인이 보관
