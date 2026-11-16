const { toAccelerator } = require('../renderer/keycombo');
function createHotkey({ shortcut, onPress }) {
  let combo = '', registered = null, suspended = false, status = 'off';
  function unregister() {
    if (registered) shortcut.unregister(registered);
    registered = null;
  }
  function apply(value) {
    unregister(); combo = value;
    const acc = toAccelerator(combo);
    if (!acc) return status = combo === '' ? 'off' : 'invalid';
    if (suspended) return status = 'off';
    try {
      if (!shortcut.register(acc, onPress)) return status = 'taken';
    } catch { return status = 'taken'; }
    registered = acc; return status = 'ok';
  }
  return { apply, state: () => status,
    suspend(on) { suspended = !!on; if (suspended) unregister(); else apply(combo); },
    dispose() { unregister(); status = 'off'; },
  };
}
module.exports = { createHotkey };

// 개정 기록 | 2026-11-16 | 전역 복귀 단축키 설정·녹화·배선 | 사용자 요청
