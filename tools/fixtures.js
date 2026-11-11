// 테마 확인용 예시 모델 6종(전부 가상의 시험 자료, 실제 일정·메모·위치가 아님).
// 사용자 의도 [docs/theme-contract.md]: 테마는 모델만 보고 그린다. 예시 자료는 테마 안이 아니라 여기에만 둔다.
// 개발 판단: 정상·긴 글·빈 상태·타이머 입력·울림·끊김을 한 파일에 모아 6테마 × 라이트/다크를 같은 자료로 비교한다.
(function () {
  var legend = [
    { key: '1', name: '유튜브' }, { key: '2', name: 'LP Lounge' }, { key: '3', name: '티빙' },
    { key: '4', name: '넷플릭스' }, { key: '5', name: '라디오' }, { key: '0', name: '시계' }, { key: 'T', name: '타이머' }
  ];
  function base() {
    return {
      now: new Date(2026, 10, 11, 10, 9, 32),
      mode: 'light',
      weather: { place: '마포구', tempC: 8, label: '흐림', hiC: 12, loC: 3, umbrella: true, mask: false },
      today: [
        { time: '09:00', title: '아침 수영', location: '', state: 'past' },
        { time: '12:30', title: '점심 약속', location: '망원동', state: 'next' },
        { time: '19:00', title: '독서 모임', location: '온라인', state: 'later' }
      ],
      todayMore: 0,
      week: [
        { dow: '목', isSunday: false, isHoliday: false, first: '수영', count: 1 },
        { dow: '금', isSunday: false, isHoliday: false, first: '회식', count: 1 },
        { dow: '토', isSunday: false, isHoliday: false, first: '장보기', count: 1 },
        { dow: '일', isSunday: true, isHoliday: false, first: '가족 식사', count: 1 },
        { dow: '월', isSunday: false, isHoliday: false, first: null, count: 0 },
        { dow: '화', isSunday: false, isHoliday: false, first: '세탁소', count: 1 },
        { dow: '수', isSunday: false, isHoliday: false, first: null, count: 0 }
      ],
      memos: ['우유·달걀 사기', 'LP 세척액 주문', '택배 반품 접수'],
      memoMore: 0,
      timer: { phase: 'hidden', input: '', hint: '', invalidAt: 0, remainingMs: 0, totalMs: 0 },
      legend: legend,
      hotkeysOn: true,
      pressedKey: null,
      status: { calendar: null, tasks: null, weather: null },
      health: 'ok'
    };
  }

  var morning = base();
  morning.timer = { phase: 'running', input: '', hint: '', invalidAt: 0, remainingMs: 204000, totalMs: 300000 };
  morning.pressedKey = '2';

  // 오후: 일정·메모가 상한까지 차고 제목이 길다(말줄임·'외 n건' 확인), 일정 갱신 실패 + 네트워크 끊김
  var evening = base();
  evening.now = new Date(2026, 10, 11, 19, 20, 5);
  evening.weather = { place: '마포구', tempC: -3, label: '눈', hiC: 1, loC: -6, umbrella: true, mask: true };
  evening.today = [
    { time: '종일', title: '가족 사진 인화본 찾으러 가는 날 잊지 않기', location: '합정 사진관', state: 'past' },
    { time: '17:00', title: '치과 정기 검진과 스케일링 예약 확인 전화', location: '서울 마포구 월드컵북로 아주 긴 주소', state: 'past' },
    { time: '19:30', title: '독서 모임: 이번 달 책 『느리게 사는 법』 토론', location: '온라인', state: 'next' },
    { time: '21:00', title: '넷플릭스 보기', location: '', state: 'later' }
  ];
  evening.todayMore = 2;
  evening.week = evening.week.map(function (w, i) {
    if (i === 0) { w.first = '아주 긴 일정 제목이 칸을 넘칠 때'; w.count = 3; }
    if (i === 4) { w.first = '월요 회의'; w.count = 1; }
    if (i === 6) { w.first = '병원'; w.count = 1; }
    return w;
  });
  evening.memos = ['우유·달걀 사기', 'LP 세척액 주문하기 (지난번과 같은 것으로, 용량 확인)', '택배 반품 접수', '구청 서류 떼기'];
  evening.memoMore = 3;
  evening.status = { calendar: '일정 갱신 실패 · 19:20 기준', tasks: null, weather: null };
  evening.health = 'net';

  // 빈 상태: 연결 전·자료 없음, 단축키 끔
  var empty = base();
  empty.weather = null;
  empty.today = []; empty.week = empty.week.map(function (w) { w.first = null; w.count = 0; return w; });
  empty.memos = [];
  empty.status = { calendar: '캘린더 연결 필요', tasks: '메모 연결 필요', weather: '날씨 갱신 실패' };
  empty.hotkeysOn = false;

  var timerInput = base();
  timerInput.timer = { phase: 'input', input: '1.35', hint: '1분 35초', invalidAt: 0, remainingMs: 0, totalMs: 0 };

  var timerRinging = base();
  timerRinging.timer = { phase: 'ringing', input: '', hint: '', invalidAt: 0, remainingMs: 0, totalMs: 300000 };

  // 서버 이상 + 일시정지
  var offline = base();
  offline.timer = { phase: 'paused', input: '', hint: '', invalidAt: 0, remainingMs: 95000, totalMs: 300000 };
  offline.weather.mask = true;
  offline.status = { calendar: '일정 갱신 실패 · 09:35 기준', tasks: null, weather: null };
  offline.health = 'server';

  window.ClockFixtures = { morning: morning, evening: evening, empty: empty, timerInput: timerInput, timerRinging: timerRinging, offline: offline };
})();
// 개정 기록 | 2026-11-11 | v1 | 예시 모델 6종 작성(가상 자료)
