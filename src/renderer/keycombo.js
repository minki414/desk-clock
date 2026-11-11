// 키 조합 문자열('Ctrl+Alt+Shift+V') <-> Windows 가상 키 코드. 순수 함수라 DOM·Electron 없이 시험합니다.
// 사용자 의도 [2026-11-11 요청]: 슬롯 실행 뒤 ChatGPT 음성 채팅 같은 단축키를 자동으로 눌러 준다.
// 개발 판단: 설정 서랍(녹화·검증)과 메인(전송)이 같은 규칙을 쓰도록 렌더러 폴더에 UMD로 두고(model.js와 같은 방식), 지원 키는 보내기에 안전한 최소 집합만 둔다.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ClockKeyCombo = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const MODS = [['ctrl', 'Ctrl', 0x11], ['alt', 'Alt', 0x12], ['shift', 'Shift', 0x10], ['win', 'Win', 0x5b]];   // 표시 순서
  const NAMED = { space: ['Space', 0x20], enter: ['Enter', 0x0d], tab: ['Tab', 0x09], esc: ['Esc', 0x1b] };

  // 주 키 토큰 -> [표시 이름, vk]. 없으면 null
  function mainKey(tok) {
    const t = tok.toLowerCase();
    if (NAMED[t]) return NAMED[t];
    if (/^[a-z]$/.test(t) || /^[0-9]$/.test(t)) return [t.toUpperCase(), t.toUpperCase().charCodeAt(0)];
    const f = /^f([1-9]|1\d|2[0-4])$/.exec(t);
    return f ? ['F' + f[1], 0x6f + Number(f[1])] : null;
  }

  // 올바르면 { mods:[vk…](표시 순서), key:vk, text:정규화 문자열 }, 아니면 null
  function parseCombo(str) {
    if (typeof str !== 'string' || !str.trim()) return null;
    const have = new Set();
    let key = null;
    for (const raw of str.split('+')) {
      const tok = raw.trim();
      const m = MODS.find(([id]) => id === tok.toLowerCase());
      if (m) { if (have.has(m[0])) return null; have.add(m[0]); continue; }
      const k = mainKey(tok);
      if (!k || key) return null;   // 모르는 토큰·주 키 둘 이상
      key = k;
    }
    if (!key) return null;
    const mods = MODS.filter(([id]) => have.has(id));
    return { mods: mods.map((m) => m[2]), key: key[1], text: [...mods.map((m) => m[1]), key[0]].join('+') };
  }

  // 표시 순서 Ctrl+Alt+Shift+Win+키로 정리. 올바르지 않으면 ''
  const formatCombo = (str) => { const p = parseCombo(str); return p ? p.text : ''; };

  // keydown 이벤트(code·수정키) -> 조합 문자열. 수정키만 눌렀거나 지원하지 않는 키면 null
  function comboFromEvent(e) {
    const c = e.code || '';
    const name = /^Key([A-Z])$/.exec(c) || /^Digit([0-9])$/.exec(c);
    const main = name ? name[1] : /^F\d{1,2}$/.test(c) ? c : { Space: 'Space', Enter: 'Enter', Tab: 'Tab', Escape: 'Esc' }[c];
    if (!main) return null;
    const mods = [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Win'].filter(Boolean);
    const out = formatCombo([...mods, main].join('+'));
    return out || null;
  }

  return { parseCombo, formatCombo, comboFromEvent };
});
// 개정 기록 | 2026-11-11 | 실행 후 키 보내기 | 사용자 요청
