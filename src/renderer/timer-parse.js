// 타이머 입력 해석(순수 함수). 노드 시험과 렌더러가 같은 파일을 씁니다.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ClockTimerParse = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const MAX_LEN = 7;

  // 형식 '분.초': 소수점 뒤는 초 그대로(1.3=1분 3초, 1.35=1분 35초, 1.03=1분 3초)
  function parse(input) {
    const bad = { ok: false, ms: 0, hint: '' };
    const m = /^(\d*)(?:\.(\d*))?$/.exec(String(input || ''));
    if (!m) return bad;
    const minStr = m[1] || '0';
    const secStr = m[2] || '';
    if (minStr.length > 3 || secStr.length > 2) return bad;   // 분 4자리 이상, 소수 셋째 자리 이상
    const min = Number(minStr);
    const sec = Number(secStr || '0');
    if (sec >= 60 || min * 60 + sec === 0) return bad;
    const hint = [min ? `${min}분` : '', sec ? `${sec}초` : ''].filter(Boolean).join(' ');
    return { ok: true, ms: (min * 60 + sec) * 1000, hint };
  }

  return { parse, MAX_LEN };
});
// 개정 기록 | 2026-11-11 | 최초 작성 | 설계서 §5 해석 규칙
