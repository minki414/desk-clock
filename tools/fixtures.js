// 테마 확인용 예시 모델 6종(전부 가상의 시험 자료, 실제 일정·메모·위치가 아님).
// 사용자 의도 [docs/theme-contract.md]: 테마는 모델만 보고 그린다. 예시 자료는 테마 안이 아니라 여기에만 둔다.
// 사용자 의도 [docs/v1.3-i18n-brief.md]: 예시 모델은 언어 무관 원자료 + 핵심 앱과 같은 형식화 함수(ClockModel.buildModel)로 만든다.
// 개발 판단: 일정·메모 제목과 슬롯 이름은 사용자 자료라 번역하지 않고, 언어별로 그 언어를 쓰는 사람이 적을 법한 가상 자료를 따로 둔다(서체 확인용).
// 날짜·요일·날씨 이름·'외 n건'·타이머 안내·상태 문장은 번역 대상이라 buildModel 이 만든다.
// 불러오는 순서: i18n.js → timer-parse.js → model.js → 이 파일.
(function () {
  var M = window.ClockModel;
  var at = function (d, h, m) { return new Date(2026, 10, d, h, m || 0).getTime(); };   // 2026-11-11(수) 기준

  // 언어별 가상 사용자 자료
  var TEXT = {
    ko: {
      place: '마포구',
      slots: ['유튜브', 'LP Lounge', '티빙', '넷플릭스', '라디오'],
      today: [['아침 수영', ''], ['점심 약속', '망원동'], ['독서 모임', '온라인']],
      week: ['수영', '회식', '장보기', '가족 식사', null, '세탁소', null],
      memos: ['우유·달걀 사기', 'LP 세척액 주문', '택배 반품 접수'],
      long: ['가족 사진 인화본 찾으러 가는 날 잊지 않기', '합정 사진관', '치과 정기 검진과 스케일링 예약 확인 전화', '서울 마포구 월드컵북로 아주 긴 주소', '독서 모임: 이번 달 책 『느리게 사는 법』 토론', '넷플릭스 보기'],
      weekLong: '아주 긴 일정 제목이 칸을 넘칠 때', monday: '월요 회의', hospital: '병원',
      memosLong: ['우유·달걀 사기', 'LP 세척액 주문하기 (지난번과 같은 것으로, 용량 확인)', '택배 반품 접수', '구청 서류 떼기'],
      people: ['민기', '지수', '하늘', '다온'],
      memosP: [['우유·달걀 사기', 'LP 세척액 주문', '택배 반품 접수', '구청 서류 떼기'], ['세탁소 맡긴 옷 찾기', '화분 분갈이 흙 주문', '엄마께 전화드리기', '도서관 책 반납', '여권 사진 찍기'],
        ['치과 예약 전화하기', '자동차 보험 갱신 서류 확인', '택배 상자 정리'], ['수영장 회원권 갱신', '쌀 20kg 주문하기', '현관 센서등 교체']],
      mine: '요가 수업', yoga: '요가',
    },
    zh: {
      place: '麻浦区',
      slots: ['视频', 'LP Lounge', '音乐', '新闻', '电台'],
      today: [['晨间游泳', ''], ['午餐聚会', '望远洞'], ['读书会', '线上']],
      week: ['游泳', '聚餐', '逛超市', '家庭聚餐', null, '取干洗衣物', null],
      memos: ['买牛奶和鸡蛋', '订购唱片清洁液', '办理快递退货'],
      long: ['记得去取家庭合影的冲印照片，千万别忘了', '合井照相馆', '牙科定期检查和洗牙，预约确认电话', '首尔市麻浦区世界杯北路一个特别长的地址', '读书会：本月共读《慢慢生活的方法》讨论', '看电影'],
      weekLong: '一个特别长的日程标题超出格子时', monday: '周一例会', hospital: '医院',
      memosLong: ['买牛奶和鸡蛋', '订购唱片清洁液（和上次同一款，确认容量）', '办理快递退货', '到区政府开证明材料'],
      people: ['小明', '小红', '小华', '小丽'],
      memosP: [['买牛奶和鸡蛋', '订购唱片清洁液', '办理快递退货', '到区政府开证明材料'], ['去取干洗的衣服', '订购花盆换盆用土', '给妈妈打电话', '归还图书馆的书', '拍护照照片'],
        ['打电话预约牙医', '确认汽车保险续保材料', '整理快递箱'], ['游泳馆会员续费', '订购二十公斤大米', '更换玄关感应灯']],
      mine: '瑜伽课', yoga: '瑜伽',
    },
    en: {
      place: 'Mapo-gu',
      slots: ['YouTube', 'LP Lounge', 'Netflix', 'Music', 'Radio'],
      today: [['Morning swim', ''], ['Lunch with Sam', 'Mangwon'], ['Book club', 'Online']],
      week: ['Swim', 'Team dinner', 'Groceries', 'Family dinner', null, 'Dry cleaner', null],
      memos: ['Buy milk and eggs', 'Order LP cleaning fluid', 'Return the parcel'],
      long: ['Remember to pick up the family photo prints', 'Hapjeong photo studio', 'Dentist check-up and cleaning, confirm appointment by phone', '12 World Cup-buk-ro, Mapo-gu, Seoul, a very long address', 'Book club: discussing this month’s pick, The Art of Living Slowly', 'Watch a movie'],
      weekLong: 'A very long event title that overflows the cell', monday: 'Monday meeting', hospital: 'Clinic',
      memosLong: ['Buy milk and eggs', 'Order LP cleaning fluid (same as last time, check the size)', 'Return the parcel', 'Pick up documents from the district office'],
      people: ['Alex', 'Sam', 'Jo', 'Kim'],
      memosP: [['Buy milk and eggs', 'Order LP cleaning fluid', 'Return the parcel', 'Pick up district office papers'], ['Collect the dry cleaning', 'Order repotting soil', 'Call Mom', 'Return library books', 'Take passport photos'],
        ['Call the dentist to book', 'Check car insurance renewal papers', 'Sort the parcel boxes'], ['Renew the pool membership', 'Order a 20 kg bag of rice', 'Replace the porch sensor light']],
      mine: 'Yoga class', yoga: 'Yoga',
    },
  };

  function ev(title, location, start, end, extra) { return Object.assign({ title: title, location: location || '', allDay: false, holiday: false, start: start, end: end }, extra || {}); }

  function base(lang) {
    var T = TEXT[lang];
    var events = [
      ev(T.today[0][0], T.today[0][1], at(11, 9), at(11, 10)),
      ev(T.today[1][0], T.today[1][1], at(11, 12, 30), at(11, 13, 30)),
      ev(T.today[2][0], T.today[2][1], at(11, 19), at(11, 21)),
    ];
    T.week.forEach(function (title, i) { if (title) events.push(ev(title, '', at(12 + i, 12), at(12 + i, 13))); });   // 내일(11/12)부터 7칸
    return {
      lang: lang, now: new Date(2026, 10, 11, 10, 9, 32), mode: 'light',
      weather: { place: T.place, tempC: 8, code: 3, hiC: 12, loC: 3, umbrella: true, mask: false },
      events: events, tasks: T.memos.slice(), who: T.people[0],
      slots: T.slots.map(function (n, i) { return { key: i + 1, name: n, target: 'x' }; }),
      timer: { phase: 'hidden', input: '', invalidAt: 0, remainingMs: 0, totalMs: 0 },
      hotkeysOn: true, pressedKey: null, sync: {}, health: 'ok',
    };
  }

  // 기본 일정·메모를 사람 1의 것으로 감싸고, 사람 여러 명 예시는 o.people 를 직접 채운다
  function person(id, name, events, memos, sync) {
    return { id: id, name: name, calendarOn: true, tasksOn: true, events: events, memos: memos, sync: sync || {} };
  }
  function finish(o) {
    if (!o.people) o.people = [person('p1', o.who, o.events, o.tasks, { calendar: o.sync.calendar, tasks: o.sync.tasks })];
    o.sync = { weather: o.sync.weather };
    delete o.events; delete o.tasks; delete o.who;
    return o;
  }

  var builders = {
    // 아침: 타이머 진행 중, 2번 눌림
    morning: function (o) {
      o.timer = { phase: 'running', input: '', invalidAt: 0, remainingMs: 204000, totalMs: 300000 };
      o.pressedKey = '2';
    },
    // 저녁: 일정·메모가 상한까지 차고 제목이 길다(말줄임·'외 n건' 확인), 일정 갱신 실패 + 네트워크 끊김
    evening: function (o, T) {
      o.now = new Date(2026, 10, 11, 19, 20, 5);
      o.weather = { place: T.place, tempC: -3, code: 73, hiC: 1, loC: -6, umbrella: true, mask: true };
      var rest = o.events.filter(function (e) { return e.start >= at(13, 0); });   // 금(11/13)부터는 기본 주간 일정 그대로
      o.events = [
        ev(T.long[0], T.long[1], at(11, 0), at(12, 0), { allDay: true }),
        ev(T.long[2], T.long[3], at(11, 17), at(11, 18)),
        ev(T.long[4], 'Online', at(11, 19, 30), at(11, 21)),
        ev(T.long[5], '', at(11, 21), at(11, 23)),
        ev(T.today[0][0], '', at(11, 22), at(11, 23)),
        ev(T.today[1][0], '', at(11, 23), at(11, 23, 30)),
      ].concat(rest);
      var wk = [[0, T.weekLong, 3], [4, T.monday, 1], [6, T.hospital, 1]];
      wk.forEach(function (w) { for (var i = 0; i < w[2]; i++) o.events.push(ev(w[1], '', at(12 + w[0], 8 + i), at(12 + w[0], 9 + i))); });
      o.tasks = T.memosLong.concat(T.memos.slice(0, 3));
      o.sync = { calendar: { state: 'failed', at: at(11, 19, 20) } };
      o.health = 'net';
    },
    // 빈 상태: 연결 전·자료 없음, 단축키 끔
    empty: function (o) {
      o.weather = null; o.events = []; o.tasks = [];
      o.sync = { calendar: { state: 'needAuth' }, tasks: { state: 'failed' }, weather: { state: 'failed' } };
      o.hotkeysOn = false;
    },
    timerInput: function (o) { o.timer = { phase: 'input', input: '1.35', invalidAt: 0, remainingMs: 0, totalMs: 0 }; },
    timerRinging: function (o) { o.timer = { phase: 'ringing', input: '', invalidAt: 0, remainingMs: 0, totalMs: 300000 }; },
    // 서버 이상 + 일시정지
    offline: function (o) {
      o.timer = { phase: 'paused', input: '', invalidAt: 0, remainingMs: 95000, totalMs: 300000 };
      o.weather.mask = true;
      o.sync = { calendar: { state: 'failed', at: at(11, 9, 35) } };
      o.health = 'server';
    },
    // 2인(v1.4): 공유 일정은 '우리'(사람 2는 제목 뒤 공백까지 같은 일정으로 판정), 개인 일정은 이름, 메모는 2묶음(각각 '외 n건')
    couple: function (o, T) {
      var book = o.events.filter(function (e) { return e.title === T.today[2][0]; });
      var mine = o.events.filter(function (e) { return e.title !== T.today[2][0]; });
      var family = o.events.filter(function (e) { return e.title === T.week[3]; });
      var hers = [ev(' ' + T.today[1][0] + ' ', T.today[1][1], at(11, 12, 30), at(11, 13, 30))].concat(book, family, [ev(T.yoga, '', at(14, 18), at(14, 19))]);
      o.people = [person('p1', T.people[0], mine, T.memosP[0].slice(), {}), person('p2', T.people[1], hers, T.memosP[1].slice(), {})];
    },
    // 3인·4인 극단 예시: 개인 일정이 섞여 오늘 칸이 가득 차고, 묶음마다 메모 3개를 넘겨 '외 n건'이 모두 나온다(묶음당 2개로 줄어듦)
    trio: function (o, T) { builders.couple(o, T); addMore(o, T, 3); },
    quad: function (o, T) { builders.couple(o, T); addMore(o, T, 4); },
  };
  function addMore(o, T, n) {
    var p3 = [ev(T.long[2], T.long[3], at(11, 15, 30), at(11, 16, 30)), ev(T.mine, '', at(15, 9), at(15, 10))];
    var p4 = [ev(T.long[0], '', at(11, 0), at(12, 0), { allDay: true }), ev(T.long[1], '', at(11, 20), at(11, 21)), ev(T.mine, '', at(15, 9), at(15, 10))];
    o.people.push(person('p3', T.people[2], p3, T.memosP[2].slice(), {}));
    if (n > 3) o.people.push(person('p4', T.people[3], p4, T.memosP[3].slice(), {}));
  }

  window.ClockFixtures = {
    names: Object.keys(builders),
    // get(이름, 언어) → 테마 계약 모델(호출마다 새 객체)
    get: function (name, lang) {
      lang = TEXT[lang] ? lang : 'ko';
      var o = base(lang);
      (builders[name] || builders.morning)(o, TEXT[lang]);
      return M.buildModel(finish(o));
    },
  };
})();
// 개정 기록 | 2026-11-11 | v1 | 예시 모델 6종 작성(가상 자료)
// 개정 기록 | 2026-11-11 | v1.3 | 언어 무관 원자료 + ClockModel.buildModel 로 모델 생성(get(이름, 언어)), 언어별 가상 사용자 자료 | docs/v1.3-i18n-brief.md
// 개정 기록 | 2026-11-12 | 사람 여러 명 | 사용자 결정: 모델 입력을 people 로, 2인(couple)·3인(trio)·4인(quad) 예시 추가 | docs/v1.4-people-brief.md
