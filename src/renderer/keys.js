// 키 라우팅 상태 기계(설계서 §4). route(state, key) -> { state, actions }
// 순수 함수라 DOM 없이 시험합니다. 상태가 바뀌지 않으면 같은 state 객체를 돌려줍니다.
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./timer-parse.js') : root.ClockTimerParse);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ClockKeys = api;
})(typeof self !== 'undefined' ? self : this, function (P) {
  const STOP = ['Enter', 'NumpadEnter', 'Space', 'NumpadMultiply', 'Numpad0'];

  const initial = () => ({ settingsOpen: false, hotkeysOn: true, phase: 'hidden', input: '', forcedNight: false });
  function transition(state, type) {
    if (state.settingsOpen) return { state, actions: [] };
    if (type === 'timerOpen' && state.phase === 'hidden') return { state: { ...state, phase: 'input', input: '' }, actions: [] };
    if (type === 'nightToggle') return { state: { ...state, forcedNight: !state.forcedNight }, actions: [{ type: 'night.toggle', on: !state.forcedNight }] };
    return { state, actions: [] };
  }

  function route(state, k) {
    const same = { state, actions: [] };
    const out = (patch, ...actions) => ({ state: { ...state, ...patch }, actions });
    const code = k.code;
    if (k.ctrl || k.alt || k.meta) return same;

    // 1. 설정 서랍이 열려 있으면 Esc만 처리
    if (state.settingsOpen) return code === 'Escape' ? out({ settingsOpen: false }, { type: 'settings.close' }) : same;

    // 1-1. 볼륨(+/−): 창이 포커스일 때만 도착하는 키. 꾹 누르면 계속 오르도록 repeat 허용
    if (state.hotkeysOn && (code === 'NumpadAdd' || code === 'NumpadSubtract')) {
      return { state, actions: [{ type: 'volume', up: code === 'NumpadAdd' }] };
    }

    // 2. 알림 울림: 끄기 키 외에는 무시
    if (state.phase === 'ringing') {
      return STOP.includes(code) ? out({ phase: 'hidden', input: '' }, { type: 'timer.cancel' }) : same;
    }

    // 3. 입력 중: 숫자패드 1~9도 숫자로만 쓰임(실행 아님)
    if (state.phase === 'input') {
      const digit = /^(?:Digit|Numpad)([0-9])$/.exec(code);
      if (digit) return state.input.length < P.MAX_LEN ? out({ input: state.input + digit[1] }) : same;
      if (code === 'Period' || code === 'NumpadDecimal') {
        if (state.input.includes('.')) return same;   // 두 번째 '.'는 키 자체를 무시
        const next = state.input === '' ? '0.' : state.input + '.';
        return next.length <= P.MAX_LEN ? out({ input: next }) : same;
      }
      if (code === 'Backspace') return state.input ? out({ input: state.input.slice(0, -1) }) : same;
      if (code === 'Escape') return out({ phase: 'hidden', input: '' });
      if (code === 'Enter' || code === 'NumpadEnter') {
        const r = P.parse(state.input);
        // 무효면 입력 단계를 유지하고 '0.00'(빈 입력의 표시값)으로 되돌림
        return r.ok ? out({ phase: 'running', input: '' }, { type: 'timer.start', ms: r.ms })
                    : out({ input: '' }, { type: 'timer.invalid' });
      }
      return same;
    }

    // 4. 동작/정지 중: 일시정지·초기화. 그 밖의 키는 5로 넘어감(타이머를 돌리며 유튜브를 켤 수 있게)
    if (state.phase === 'running' || state.phase === 'paused') {
      if (code === 'Space' || code === 'NumpadMultiply') {
        return state.phase === 'running' ? out({ phase: 'paused' }, { type: 'timer.pause' })
                                         : out({ phase: 'running' }, { type: 'timer.resume' });
      }
      if (code === 'Enter' || code === 'NumpadEnter') return out({ phase: 'input', input: '' }, { type: 'timer.cancel' });
    }

    // 5. 그 밖
    if (k.repeat) return same;
    const slot = /^Numpad([1-9])$/.exec(code);
    if (slot && state.hotkeysOn) {
      return { state, actions: [{ type: 'launch', slot: Number(slot[1]) }] };
    }
    if (code === 'KeyT' || code === 'NumpadDivide') return transition(state, 'timerOpen');
    if (code === 'KeyN') return transition(state, 'nightToggle');
    return same;
  }

  const command = (state, type) => route(state, { code: { timerOpen: 'KeyT', nightToggle: 'KeyN' }[type] });
  return { initial, route, command };
});
// 개정 기록 | 2026-11-11 | 최초 작성 | 설계서 §4 키 라우팅
// 개정 기록 | 2026-11-11 | 중복 실행 차단을 슬롯별로 | Codex 감사 FAIL(1→2→1 재실행) 수정
// 개정 기록 | 2026-11-11 | 단축키 포커스 전용 | 사용자 결정: NumpadAdd/Subtract -> volume 액션(전역 단축키 대체)
// 개정 기록 | 2026-11-15 | N 키 야간 강제 토글 라우팅 | 사용자 요청
// 개정 기록 | 2026-11-16 | 전역 명령과 T·N 상태 전이 공유 | 사용자 요청
// 개정 기록 | 2026-11-16 | 슬롯 중복 판정을 메인 공통 실행 경로로 통합 | 사용자 요청
