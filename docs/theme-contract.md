# 테마 계약 (핵심 앱 ↔ 테마)

핵심 앱과 테마를 병렬로 만들기 위한 고정 약속입니다. 바꾸려면 설계자(Opus) 승인이 필요합니다.

## 소유 범위
- 핵심 앱 담당: `package.json`, `src/main/**`, `src/preload/**`, `src/renderer/index.html`, `src/renderer/app.js`, `keys.js`, `timer-parse.js`, `labels.js`, `settings.*`, `tests/**`, `docs/setup.md`, 빌드 설정.
- 테마 담당: `src/renderer/themes/**`, `src/renderer/icons.js`, `src/renderer/fonts.css`, `assets/fonts/**`, `tools/theme-preview.html`, `tools/fixtures.js`.
- 서로의 파일은 건드리지 않습니다.

## 불러오기
번들러 없음, ES 모듈 없음(file:// 모듈 제약 회피). `index.html`이 아래 순서로 일반 `<script>`를 넣습니다.
```html
<link rel="stylesheet" href="fonts.css">
<link rel="stylesheet" href="themes/<id>/theme.css">   <!-- 6개 모두 -->
<script src="icons.js"></script>
<script src="themes/<id>/theme.js"></script>             <!-- 6개 모두 -->
<script src="app.js"></script>
```
테마 id: `bauhaus`(기본), `sector`, `navy`, `receiver`, `flip`, `standby`.

## 등록 API
```js
window.ClockThemes = window.ClockThemes || {};
window.ClockThemes['bauhaus'] = {
  name: '바우하우스', kind: 'analog',
  mount(stage) {},      // stage: 높이 900 고정·너비 가변(1200~1800) div. 테마는 이 안에만 그림. 루트 클래스 `theme-<id>`를 스스로 붙임
  render(model) {},     // 1초마다 + 상태 변화 시 호출. 바뀐 부분만 갱신(매번 innerHTML 전체 교체 금지)
  unmount() {}          // 타이머·애니메이션 정리
};
```
- 다크/라이트는 `stage`의 `data-mode="light|dark"` 속성으로 핵심 앱이 바꿉니다. 테마 CSS는 `.theme-<id>[data-mode=dark]`로 두 벌 정의.
- 화면 맞춤(scale)·마우스 숨김·설정 서랍·야간 막은 핵심 앱이 stage 밖에서 처리합니다.

## 스테이지 크기 (v1.2, 설계자 승인으로 '고정 1440' 가정 폐기)
- 핵심 앱이 `stage.style.width`와 CSS 변수 `--stage-w`(예: `1600px`)를 정하고 창 크기가 바뀔 때마다 다시 계산합니다. 높이는 늘 900입니다.
  `W = clamp(올림(900 × 창너비/창높이), 1200, 1800)` → 16:10 1440, 16:9 1600, 3:2 1350. 배율은 `창높이/900`.
- 테마는 **스테이지 너비 100%에 맞춰 배치**합니다. 루트는 `width: var(--stage-w, 1440px)`로 두고,
  - 바탕(그라디언트 포함)은 루트에 칠합니다(안쪽 요소가 바탕 역할을 하면 가변 폭에서 띠가 보임).
  - 좌측 덩어리는 `left`, 우측 덩어리는 `right` 기준으로 고정하고 남는 폭은 둘 사이 간격이 흡수합니다. 3단 대칭은 `grid-template-columns: <열> 1fr <열>`.
  - 시계 지름·글자 크기는 높이 기준이라 바꾸지 않습니다. 3:2(1350)에서 모자라는 곳만 열 폭·여백을 줄이고(`calc(var(--stage-w) …)` 또는 컨테이너 쿼리 `@container`), 겹침·말줄임이 없어야 합니다.
- 확인은 `tools/theme-preview.html?theme=<id>&mode=<light|dark>&fx=morning&w=<1440|1600|1350>`로 합니다(창 너비를 `w`와 같게).
- 모든 CSS는 `.theme-<id>` 아래로 범위를 한정합니다.

## 모델 (render 인자)
```js
{
  now: Date,
  mode: 'light'|'dark',
  weather: { place:'마포구', tempC:8, label:'흐림', hiC:12, loC:3, umbrella:true, mask:false } | null,
  today: [{ time:'12:30'|'종일', title, location, state:'past'|'now'|'next'|'later' }],  // 최대 4
  todayMore: 0,
  week: [{ dow:'목', isSunday:false, isHoliday:false, first:'수영'|null, count:1 }],     // 내일부터 7칸
  memos: ['우유·달걀 사기'],  memoMore: 0,                                               // 최대 4
  timer: { phase:'hidden'|'input'|'running'|'paused'|'ringing',
           input:'1.35', hint:'1분 35초'|'', invalidAt: 0|ms타임스탬프,
           remainingMs, totalMs },
  legend: [{ key:'1', name:'유튜브' }, …, { key:'0', name:'시계' }, { key:'T', name:'타이머' }],
  hotkeysOn: true,
  pressedKey: null|'1'..'9'|'0',          // 0.2초 동안만 값(D1 버튼 눌림 표시)
  status: { calendar:null|'캘린더 연결 필요', tasks:null|'…', weather:null|'…' },
  health: 'ok'|'net'|'server'
}
```
`weather`가 null이면 날씨 자리는 '날씨 정보 없음' 보조 문장. 목록이 비면 '일정 없음'·'메모 없음'.

## 아이콘
`icons.js`가 `window.ClockIcons = { umbrella, mask, cloud, sun, rain, snow, fog }` SVG 문자열(선 굵기 1.6, `currentColor`)을 제공합니다.

## 시안
각 테마의 정본 시안과 변경점은 `DESIGN.md`. 예시 모델은 `tools/fixtures.js`(`window.ClockFixtures = { morning, evening, empty, timerInput, timerRinging, offline }`).

// 개정 기록 | 2026-11-11 | v1.2 | 스테이지를 1440 고정에서 가변 너비(--stage-w)로 변경, 테마 배치 규칙 추가 | docs/v1.2-brief.md §1
