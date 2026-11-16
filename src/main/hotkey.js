const { toAccelerator } = require('../renderer/keycombo');
function createHotkeys({ shortcut, onPress }) {
  let list = [], registered = [], suspended = false, status = {};
  function unregister() {
    for (const acc of registered) shortcut.unregister(acc);
    registered = [];
  }
  function apply(value) {
    unregister(); list = value.map((entry) => ({ ...entry })); status = {};
    const seen = new Set();
    for (const entry of list) {
      const acc = toAccelerator(entry.combo);
      let state;
      if (entry.combo === '') state = 'off';
      else if (!acc) state = 'invalid';
      else if (seen.has(acc)) state = 'dup';
      else {
        seen.add(acc);
        if (suspended) state = 'off';
        else {
          try {
            state = shortcut.register(acc, () => onPress({ ...entry })) ? 'ok' : 'taken';
            if (state === 'ok') registered.push(acc);
          } catch { state = 'taken'; }
        }
      }
      status[entry.id] = state;
    }
    return { ...status };
  }
  return { apply, states: () => ({ ...status }),
    suspend(on) { suspended = !!on; return apply(list); },
    dispose() { unregister(); status = Object.fromEntries(list.map((entry) => [entry.id, 'off'])); list = []; },
  };
}
module.exports = { createHotkeys };

// 개정 기록 | 2026-11-16 | customHotkeys 목록 배선 | 사용자 요청
