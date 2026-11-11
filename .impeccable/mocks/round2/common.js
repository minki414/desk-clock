// 시안 공통: 예시 자료와 SVG 도우미 (실제 앱 코드 아님)
window.SAMPLE = {
  h: 10, m: 9, s: 32,
  date: '11월 11일 수요일', dateShort: '11.11', dow: '수', day: 11,
  weather: { t: 8, label: '흐림', hi: 12, lo: 3, place: '마포구', rain: true, dust: false },
  today: [
    { t: '09:00', n: '아침 수영', st: 'past' },
    { t: '12:30', n: '점심 약속', p: '망원동', st: 'next' },
    { t: '19:00', n: '독서 모임', p: '온라인', st: 'later' }
  ],
  week: [['목', '수영'], ['금', '회식'], ['토', '장보기'], ['일', '가족 식사', 'sun'], ['월', ''], ['화', '세탁소'], ['수', '']],
  memos: ['우유·달걀 사기', 'LP 세척액 주문', '택배 반품 접수'],
  slots: ['유튜브', 'LP Lounge', '티빙', '넷플릭스', '라디오'],
  timer: '3:24'
};
window.svgEl = function (parent, tag, attrs) {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  parent.appendChild(e); return e;
};
window.polar = function (r, deg) { const a = (deg - 90) * Math.PI / 180; return [r * Math.cos(a), r * Math.sin(a)]; };
window.angles = function () { const S = window.SAMPLE; return { h: (S.h % 12) * 30 + S.m / 2, m: S.m * 6 + S.s / 10, s: S.s * 6 }; };
// 그린 아이콘(한 줄 굵기 통일): 우산, 마스크
window.ICON = {
  umbrella: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 18 0z"/><path d="M12 12v6.5a2 2 0 0 1-4 0"/><path d="M12 3v0"/></svg>',
  mask: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8.5c4-1.6 10-1.6 14 0v4.5c0 3-3.5 5-7 5s-7-2-7-5z"/><path d="M5 10H3.2a1.2 1.2 0 0 0 0 4.4L5.6 15M19 10h1.8a1.2 1.2 0 0 1 0 4.4L18.4 15"/><path d="M8.5 11h7M8.5 13.5h7"/></svg>'
};
