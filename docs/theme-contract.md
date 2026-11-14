# 테마 계약 (핵심 앱 ↔ 테마)

핵심 앱과 테마를 병렬로 만들기 위한 고정 약속입니다. 바꾸려면 설계자(Opus) 승인이 필요합니다.

## 소유 범위
- 핵심 앱 담당: `package.json`, `src/main/**`, `src/preload/**`, `src/renderer/index.html`, `src/renderer/app.js`, `keys.js`, `timer-parse.js`, `i18n.js`, `model.js`, `settings.*`, `tests/**`, `docs/setup.md`, 빌드 설정.
- 테마 담당: `src/renderer/themes/**`, `src/renderer/icons.js`, `src/renderer/fonts.css`, `assets/fonts/**`, `tools/theme-preview.html`, `tools/fixtures.js`.
- 서로의 파일은 건드리지 않습니다.

## 불러오기
번들러 없음, ES 모듈 없음(file:// 모듈 제약 회피). `index.html`이 아래 순서로 일반 `<script>`를 넣습니다.
```html
<link rel="stylesheet" href="fonts.css">
<link rel="stylesheet" href="themes/<id>/theme.css">   <!-- 6개 모두 -->
<script src="icons.js"></script>
<script src="themes/<id>/theme.js"></script>             <!-- 6개 모두 -->
<script src="i18n.js"></script> … <script src="model.js"></script>   <!-- 사전·모델 조립(테마는 직접 쓰지 않음) -->
<script src="app.js"></script>
```
테마 id: `bauhaus`(기본), `sector`, `navy`, `receiver`, `flip`, `standby`.

## 등록 API
```js
window.ClockThemes = window.ClockThemes || {};
window.ClockThemes['bauhaus'] = {
  kind: 'analog',
  mount(stage) {},      // stage: 높이 900 고정·너비 가변(1200~1800) div. 테마는 이 안에만 그림. 루트 클래스 `theme-<id>`를 스스로 붙임
  render(model) {},     // 1초마다 + 상태 변화 시 호출. 바뀐 부분만 갱신(매번 innerHTML 전체 교체 금지)
  unmount() {}          // 타이머·애니메이션 정리
};
```
- 테마 이름(설정 카드 글자)은 등록 객체가 아니라 사전 `theme.<id>`(`src/renderer/i18n.js`)가 언어별로 줍니다(v1.3).
- 다크/라이트는 `stage`의 `data-mode="light|dark"` 속성으로 핵심 앱이 바꿉니다. 테마 CSS는 `.theme-<id>[data-mode=dark]`로 두 벌 정의.
- 화면 맞춤(scale)·마우스 숨김·설정 서랍·야간 막은 핵심 앱이 stage 밖에서 처리합니다.

## 스테이지 크기 (v1.2, 설계자 승인으로 '고정 1440' 가정 폐기)
- 핵심 앱이 `stage.style.width`와 CSS 변수 `--stage-w`(예: `1600px`)를 정하고 창 크기가 바뀔 때마다 다시 계산합니다. 높이는 늘 900입니다.
  `W = clamp(올림(900 × 창너비/창높이), 1200, 1800)` → 16:10 1440, 16:9 1600, 3:2 1350. 배율은 `창높이/900`.
- 테마는 **스테이지 너비 100%에 맞춰 배치**합니다. 루트는 `width: var(--stage-w, 1440px)`로 두고,
  - 바탕(그라디언트 포함)은 루트에 칠합니다(안쪽 요소가 바탕 역할을 하면 가변 폭에서 띠가 보임).
  - 좌측 덩어리는 `left`, 우측 덩어리는 `right` 기준으로 고정하고 남는 폭은 둘 사이 간격이 흡수합니다. 3단 대칭은 `grid-template-columns: <열> 1fr <열>`.
  - 시계 지름·글자 크기는 높이 기준이라 바꾸지 않습니다. 3:2(1350)에서 모자라는 곳만 열 폭·여백을 줄이고(`calc(var(--stage-w) …)` 또는 컨테이너 쿼리 `@container`), 겹침·말줄임이 없어야 합니다.
- 확인은 `tools/theme-preview.html?theme=<id>&mode=<light|dark>&fx=morning&w=<1440|1600|1350>&lang=<ko|zh|en>`로 합니다(창 너비를 `w`와 같게).
- 모든 CSS는 `.theme-<id>` 아래로 범위를 한정합니다.

## 모델 (render 인자)
```js
{
  now: Date,
  mode: 'light'|'dark',
  lang: 'ko'|'zh'|'en',                   // v1.3: 화면 언어(stage 루트에는 lang="ko|zh-CN|en" 속성이 붙음)
  L: {                                    // v1.3: 현재 언어로 이미 번역된 고정 문구
    today, schedule, week, memo, timer, weather, clock,        // 소제목·'시계'·'타이머'
    noEvents, noMemos, noWeather,                              // 빈 상태
    todayMore,                                                 // '외 3건'/'另有 3 项'/'+3 more' 결과 문장(0건이면 ''). 메모의 '외 n건'은 묶음마다 memoGroups[i].moreText
    umbrella, umbrellaTip, mask, maskTip, high, low, now, next, allDay, untitled, paused, timeUp
  },
  dateLong: '11월 11일 수요일',            // 한 줄 긴 날짜. zh '11月11日 星期三', en 'Wednesday, November 11'
  dateShort: '11.11 수',                  // zh '11.11 周三', en 'Wed 11.11'
  dateMonthDay: '11월 11일', dateMonth: '11월', dateDow: '수요일',   // 여러 줄 배치용 조각
  dateNum: '11.11', dateDowShort: '수',                            // 숫자·짧은 요일을 따로 꾸미는 테마용
  weather: { place:'마포구', tempC:8, code:3, label:'흐림', icon:'cloud', hiC:12, loC:3, umbrella:true, mask:false } | null,
                                          // label 은 언어별 날씨 이름, icon 은 'sun'|'cloud'|'rain'|'snow'|'fog'(언어 무관)
  today: [{ time:'12:30'|'종일', title, location, who:'우리'|'지수'|null, state:'past'|'now'|'next'|'later' }],  // 최대 4, '종일' 자리는 L.allDay. who 는 v1.4(아래)
  todayMore: 0,
  week: [{ dow:'목', isSunday:false, isHoliday:false, first:'수영'|null, count:1, tip:'수영 외 1건' }],  // 내일부터 7칸, dow 는 짧은 요일(zh '周四', en 'Thu'), tip 은 말풍선 글
  memoGroups: [{ name:'지수'|null, items:['우유·달걀 사기'], more:2, moreText:'외 2건'|'' }],   // v1.4: 메모를 켠 사람 순서대로 묶음(메모 없는 사람은 묶음 없음). 아래 '사람 여러 명'
  timer: { phase:'hidden'|'input'|'running'|'paused'|'ringing',
           input:'1.35', hint:'1분 35초'|'일시정지'|'시간 종료'|'', invalidAt: 0|ms타임스탬프,   // hint 는 입력 중엔 해석, 일시정지·울림엔 상태 이름(언어별)
           remainingMs, totalMs },
  legend: [{ key:'1', name:'유튜브' }, …, { key:'0', name:'시계' }, { key:'T', name:'타이머' }],   // 슬롯 이름은 사용자 입력, 시계·타이머만 번역
  hotkeysOn: true,
  pressedKey: null|'1'..'9'|'0',          // 0.2초 동안만 값(D1 버튼 눌림 표시)
  status: { calendar:null|'캘린더 연결 필요', tasks:null|'…', weather:null|'…' },   // 언어별 문장
  health: 'ok'|'net'|'server'
}
```
- **테마 안에 한국어(또는 어떤 언어든) 글자를 쓰지 않습니다.** 날짜·요일·타이머 안내·날씨 이름·'외 n건'은 핵심 앱이 이미 형식화해 넘기고(`ClockModel.buildModel`, 예시 모델도 같은 함수), 고정 문구는 `model.L`에서 읽습니다. 고정 문구는 `mount`가 아니라 `render`에서 `K.text(el, m.L.xxx)`로 채웁니다(언어를 바꾸면 다음 그림에서 바로 바뀌도록).
- 일정·메모 제목, 슬롯 이름은 사용자 자료라 번역하지 않습니다.
- `weather`가 null이면 날씨 자리는 `L.noWeather`. 목록이 비면 `L.noEvents`·`L.noMemos`.

## 서체와 언어 (v1.3)
- 숫자·라틴 표시용 서체(Jost, Barlow Condensed, Bodoni Moda, Archivo, Nunito, DSEG7)는 언어와 무관하게 유지합니다.
- 한글 자리에 쓰던 서체는 CSS 변수로만 바꿉니다. 테마 CSS는 `"Pretendard Variable"` 대신 `var(--f-sans)`, `Hahmlet, "Pretendard Variable"` 대신 `var(--f-serif), var(--f-sans)`를 씁니다. 변수는 `fonts.css`가 정하고, 중국어(`[lang|="zh"]`)에서는 `--f-sans`=Noto Sans SC 우선, `--f-serif`=Noto Serif SC 우선으로 바뀝니다. 영어는 Pretendard(라틴 포함)·Hahmlet(라틴)을 그대로 씁니다.
- 영어는 글자가 길고 중국어는 글자 폭이 넓으므로 말줄임·줄바꿈·겹침을 `tools/theme-preview.html?...&lang=zh|en`으로 확인합니다(필요하면 `[lang=en]`·`[lang|=zh]` 선택자로 그 언어에서만 크기·간격 조정).

## 아이콘
`icons.js`가 `window.ClockIcons = { umbrella, mask, cloud, sun, rain, snow, fog }` SVG 문자열(선 굵기 1.6, `currentColor`)을 제공합니다. 날씨 아이콘 키는 `model.weather.icon`입니다(v1.3, 문구 정규식 폐기).

## 시안
각 테마의 정본 시안과 변경점은 `DESIGN.md`. 예시 모델은 `tools/fixtures.js`(`ClockFixtures.get(이름, 언어)`, 이름: `morning`·`evening`·`empty`·`timerInput`·`timerRinging`·`offline`).

// 개정 기록 | 2026-11-11 | v1.2 | 스테이지를 1440 고정에서 가변 너비(--stage-w)로 변경, 테마 배치 규칙 추가 | docs/v1.2-brief.md §1
## 사람 여러 명 (v1.4)
한 집에서 최대 4명이 구글 캘린더·메모를 각자 연결합니다. 모델의 변화는 아래 둘뿐이고, 테마는 **하위 호환 없이** 이 형식만 읽습니다(`memos`·`memoMore`·`L.memoMore` 폐기).
- `today[i].who: string|null` — 일정의 출처 표시. 캘린더를 켠 사람이 2명 이상일 때만 값이 있습니다: 2명 이상에게서 온 같은 일정(시작 시각 또는 종일이면 날짜 + 앞뒤 공백 뺀 제목이 완전히 같음)은 `'우리'`(zh `我们`, en `Us`), 한 사람에게서만 온 일정은 그 사람 이름. 1명뿐이면 늘 `null`이라 한 사람 화면은 v1.3과 같습니다. 공휴일은 늘 `null`. `week[i]`의 개수·첫 일정도 같은 중복 제거 뒤 기준이고 `who`는 없습니다.
- `memoGroups: [{ name, items, more, moreText }]` — `name`은 메모를 켠 사람이 2명 이상일 때만(1명이면 `null`, 한 묶음에 최대 4개). 묶음당 `items` 상한은 3개(보이는 묶음이 3개 이상이면 2개), 넘친 개수는 `more`·`moreText`('외 n건' 3언어 문장). 목록이 비면 `[]` → `L.noMemos`.
- 테마가 그리는 방법(`ClockKit`, `icons.js`): 일정 줄은 `K.nameCell(row)`로 제목 칸을 만들고 `K.setName(cell, title, who)`로 채웁니다(`.n` = flex, 제목 `.nt`만 말줄임, `who`는 `.w`). 메모는 `K.memoGroups(host, m.memoGroups, opt)`가 묶음 `.mg` = 이름표 줄 `.gh`(이름 `.gn` + 이름 있는 묶음의 '외 n건' `.gp`) + 목록 `.gl` + 이름 없는 묶음의 '외 n건' `.gm`을 만들고, 호스트에 `data-g`(묶음 수)·`data-c`(3개 이상이면 1)를 붙입니다.
- 모양 규칙: `who`는 제목 뒤 보조색·본문의 0.6~0.7배 글자(굵기 400, 지난 일정은 지난 일정 색, 플립은 행 오른쪽 끝, 리시버는 표시관 안 빛나지 않는 호박색 작은 글자, 스탠바이는 요일 칩과 같은 알약). 제목이 길면 제목이 먼저 줄고 `who`는 유지합니다. 이름표는 소제목보다 한 단계 작은 보조색이고 묶음 사이는 그 테마의 기존 hairline 색 1px 선입니다. 메모 칸 높이를 넘지 않도록 테마마다 묶음 수에 따라 줄 크기를 줄이고, 높이가 빠듯한 칸은 2열 격자(섹터·스탠바이) 또는 왼쪽 이름표 칸+2줄 목록(3명 이상: 바우하우스·네이비·리시버·플립)으로 배치합니다.
- 상태 문장(`status.calendar`·`status.tasks`): 사람이 2명 이상이면 사람 이름이 앞에 붙고(`지수 메모 갱신 실패 · 19:20 기준`) 여러 건이면 ` / `로 이어집니다.
- 예시 모델: `ClockFixtures.get('couple'|'trio'|'quad', lang)`(2·3·4명 예시. 공유 일정 '우리', 개인 일정 이름, 메모 묶음마다 '외 n건'). `buildModel`의 입력은 `people: [{ id, name, calendarOn, tasksOn, events, memos, sync }]`입니다.

// 개정 기록 | 2026-11-11 | v1.3 | 모델에 lang·L·사전 형식화 문자열(dateLong 등, week.tip, weather.icon, timer.hint 전 단계) 추가, 테마 name 폐기, 언어별 서체 변수 | docs/v1.3-i18n-brief.md(설계자 승인)
// 개정 기록 | 2026-11-12 | 사람 여러 명 | 모델의 memos·memoMore 를 memoGroups 로, today[i].who 추가(설계자 승인, 하위 호환 없음) | docs/v1.4-people-brief.md
