# 식탁 시계 — 구조 설계서 (v1)

설계: Opus · 구현: Sonnet · 감사: Codex(최소, 고위험 구간만)
의도 원문: 사용자 의도 브리프(2026-11-11 대화) · 제품 정의: `../PRODUCT.md` · 시각 설계: `../DESIGN.md`(테마 확정 후 작성)

## 1. 확정 결정

| 항목 | 결정 | 근거 |
|---|---|---|
| 런타임 | Electron(정확한 버전 고정) + 순수 HTML/CSS/JS, 번들러 없음 | 전체화면·전원 차단·외부 실행을 한 런타임에서 처리 / 빌드 단계 최소화 |
| 배포 | electron-builder `portable` x64 `.exe` | 이 PC에서 만들어 LG그램에 복사만 하면 실행 |
| 단축키 범위 | 전역 단축키 없음. 시계 창이 포커스일 때만 렌더러 `keydown`으로 처리 | 사용자 결정(2026-11-11): 유튜브 등 다른 창에서는 숫자키가 그대로 입력돼야 함. NumLock이 켜져 있어야 동작(설명서에 명시) |
| 1~9 실행 | 렌더러 `keydown`의 `e.code === 'Numpad1'..'Numpad9'` | 대시보드에 포커스가 있을 때만 이벤트가 오므로 유튜브 창에서는 구조적으로 실행 불가 |
| 화면 꺼짐 방지 | `powerSaveBlocker.start('prevent-display-sleep')` | 앱 실행 중에만 유지되고, 끄면 원래 전원 설정으로 돌아감 |
| 웹 링크 | 기본 Brave `--app=<URL>`(사용자의 기존 프로필), 설정에서 Brave/Chrome/Edge/기본 브라우저 선택 | 광고 차단·로그인 유지(사용자 답변) |
| 날씨 | IP 위치(ipwho.is, 하루 1회) → Open-Meteo `models=kma_seamless`, 30분 주기 | 키 없음·개인용 무료 / 설정에서 지명 검색(Open-Meteo geocoding `language=ko`)으로 변경 |
| 일정 | Google Calendar API `calendar.readonly`, 5분 주기 | 휴대폰 입력이 바로 반영 |
| 메모 | Google Tasks API `tasks.readonly`, 5분 주기 | Keep은 개인 계정 공식 API 없음(조사), 사용자 선택 |
| 구글 인증 | LP Lounge의 Google Cloud 프로젝트 재사용, 데스크톱 OAuth(루프백+PKCE), 게시 상태 '프로덕션' | 테스트 상태 refresh token 7일 만료 회피(사용자 선택) |
| 볼륨 | 시계 창 포커스 + 단축키 켜짐일 때 렌더러가 `NumpadAdd`/`NumpadSubtract` → IPC `system:volume` → koffi `keybd_event(VK_VOLUME_UP/DOWN)` 1회 누름당 2번(약 4%) | Windows 기본 볼륨 표시가 뜸. 다른 창이 앞이면 동작하지 않음 |
| 야간 감광 | 야간 시간대 시작 시 현재 패널 밝기를 저장하고 WMI `WmiSetBrightness`로 최소(설정값, 기본 0%)로, 끝나면 저장값 복구. WMI 실패 시 화면 위 검은 막(불투명도 0.6) | 하드웨어 밝기가 눈부심·전력에 실제로 효과. 전환은 하루 두 번뿐이라 PowerShell 호출 비용 무시 가능 |
| 우산·마스크 | Open-Meteo 일 강수확률 최대 ≥60% 또는 남은 시간 강수량 ≥1mm → 우산 / Open-Meteo Air Quality 앞으로 12시간 PM10 최대 ≥81 또는 PM2.5 ≥36㎍/㎥(환경부 '나쁨') → 마스크 | 키 없음. 수치는 표시하지 않음 |
| 상태 점 | 60초마다 네트워크(`https://www.google.com/generate_204`)와 설정에 등록한 서버 주소(HTTP 3초 안 응답=정상) 확인 | 기본 목록은 비어 있고 네트워크만 감시. 설정에서 이름·주소 추가(예: `http://127.0.0.1:4410`) |
| 토큰 보관 | refresh token을 `safeStorage`(Windows DPAPI)로 암호화해 userData에 저장, 평문 저장 금지 | LP Lounge와 같은 원칙 |
| 설정·캐시 | `app.getPath('userData')/settings.json`, `cache.json` | 혼자 쓰는 노트북 내부 저장(기본값 가정). 재시작·오프라인 때 마지막 정보 표시 |

## 2. 폴더 구조

```
clock/
  package.json            electron, electron-builder, koffi 정확한 버전 고정
  src/main/
    main.js               창·전원·IPC 배선만
    store.js              settings.json / cache.json 읽기·쓰기(원자적 쓰기: tmp→rename)
    launcher.js           슬롯 실행(웹/프로그램), 브라우저 경로 찾기
    foreground.js         koffi로 GetForegroundWindow/GetClassNameW, 실행 세션 중에만 1초 감시
    timer.js              타이머 마감 시각 보관·알림 발화(메인 프로세스, 백그라운드 제약 없음)
    google.js             OAuth·Calendar·Tasks
    weather.js            IP 위치·Open-Meteo·대기질·WMO 코드·우산/마스크 판정
    system.js             볼륨 키 전송, 패널 밝기 읽기·쓰기(WMI), 상태 점 감시
    sync.js               주기 갱신 스케줄러, 실패 시 마지막 값 유지
  src/preload/preload.js  contextBridge로 좁은 API만 노출
  src/renderer/
    index.html, app.js    상태 모델·1초 렌더 루프·테마 전환·다크모드
    keys.js               키 라우팅 상태 기계(순수 함수 + 얇은 DOM 연결)
    timer-parse.js        타이머 입력 해석(순수 함수)
    labels.js             화면 문구 사전(합니다체·명사형 상태)
    settings.js/.css      설정 서랍
    themes/<id>/          theme.css + theme.js (테마마다 배치까지 다름, docs/theme-contract.md)
  assets/fonts/           오프라인용 woff2(OFL 등 재배포 가능한 것만)
  tests/                  node:test 단위 시험
  docs/                   이 설계서, 사용자 설치 안내
```

`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. 렌더러는 네트워크를 직접 호출하지 않고 메인이 가져온 모델만 받습니다.

## 3. 화면 모델(모든 테마 공통 입력) — 정본은 docs/theme-contract.md

```js
{
  now,                       // Date
  mode: 'light'|'dark',
  weather: { place, tempC, code, label, hiC, loC, umbrella, mask, updatedAt } | null,
  health: 'ok'|'net'|'server',      // 상태 점
  hotkeysOn: true|false,
  dimOverlay: 0..1,                // WMI 실패 시 막 불투명도
  today: [{ start, end, allDay, title, location, state: 'past'|'now'|'next'|'later' }],
  week:  [{ date, dow, isHoliday, items: [title...], more }],   // 내일부터 6일
  memos: [{ title }], memoMore,
  timer: { phase: 'hidden'|'input'|'running'|'paused'|'ringing', input, remainingMs, invalidFlash },
  slots: [{ key: 1..9, name }],                                 // 이름만, 경로 비노출
  status: [{ kind: 'calendar'|'tasks'|'weather', text }]         // 예: '캘린더 연결 필요', '일정 갱신 실패 · 19:20 기준'
}
```

테마 모듈 계약: `export function mount(root)`, `export function render(model)`, `export const meta = { id, name, secondsMotion }`. 테마가 정보 개수 상한을 스스로 정합니다(예: 오늘 최대 5건 + '외 n건').

## 4. 키 라우팅 (대시보드 포커스 상태)

우선순위 순서:

1. 설정 서랍 열림 → 단축키 전부 무시(Esc만 서랍 닫기).
2. 알림 울림(`ringing`) → Enter·NumpadEnter·Space·NumpadMultiply·Numpad0 = 알림 끄기 → 타이머 숨김.
3. 타이머 입력(`input`) → 숫자(상단·숫자패드), `.`(Period·NumpadDecimal), Backspace, Enter=시작 또는 무효 시 `0.00`으로 초기화, Esc=입력 닫기. 숫자패드 1~9는 실행이 아니라 숫자.
4. 타이머 동작/정지(`running`/`paused`) → Space·NumpadMultiply=일시정지/재개, Enter·NumpadEnter=초기화(입력 상태 `0.00`으로).
5. 그 밖 → Numpad1~9 = 슬롯 실행(단축키 켜짐일 때), `T`·NumpadDivide = 타이머 입력 열기.

전역 단축키는 없음(시계 창이 포커스일 때만 키를 받음). `Numpad0`=타이머 숫자 0 또는 알림 끄기, 그 밖에는 무동작. `NumpadAdd`/`NumpadSubtract`=`volume` 액션(설정 서랍 열림이면 무시, `e.repeat` 허용).
단축키 끄기: 1~9·볼륨 무시. 타이머(T)는 대시보드 안 기능이라 계속 동작.
키 반복(`e.repeat`)은 슬롯 실행에서 무시(볼륨은 허용), 같은 슬롯 1.5초 내 중복 실행 무시.

## 5. 타이머 해석 규칙 (사용자 확정)

- 형식 `분.초`. 소수점 뒤 숫자는 초 그대로: `1.3`=1분 3초, `1.35`=1분 35초, `1.03`=1분 3초, `10`=10분, `0.3`=3초.
- 무효: 초 ≥ 60(`1.60`~`1.99`), 소수 셋째 자리 이상(`0.001`), 합계 0, 빈 입력, 분 4자리 이상.
- 무효로 Enter → 입력 표시를 `0.00`으로 되돌리고 짧게 흔들림 표시, 입력 상태 유지(버리지 않고 다시 입력).
- 입력 중 두 번째 `.`와 7자 초과 입력은 키 자체를 무시.
- 마감 시각은 메인 `timer.js`가 보관(`endAt`)해 렌더러가 가려져 있어도 정확히 울림. 일시정지는 남은 ms 보관.
- 종료: 대시보드를 맨 앞으로(`setAlwaysOnTop(true)→show→focus→setAlwaysOnTop(false)`), 타이머 깜빡임, Web Audio 합성 알림음 반복(최대 3분 후 자동 정지).

## 6. 실행·복귀

- 웹 슬롯: 선택 브라우저의 실행 파일을 레지스트리 `App Paths`·표준 설치 경로 순으로 찾고, `--app=<URL>`로 실행(슬롯별 '주소창 없는 창' 기본 켬). '기본 브라우저'는 `shell.openExternal`.
- 프로그램 슬롯: `.exe`·`.lnk`·폴더를 `shell.openPath`.
- 실행 실패·빈 슬롯: 아무 창도 띄우지 않고 상태 줄에 3초간 '2번 실행 실패' 표시.
- 복귀: 실행 직전 대시보드가 맨 앞이므로, 실행 창을 닫거나 최소화하면 Windows가 다음 창인 대시보드를 활성화합니다. 보조 장치로, 실행 후 10분 동안만 `foreground.js`가 1초마다 확인해 맨 앞이 바탕화면·작업표시줄(`Progman`/`WorkerW`/`Shell_TrayWnd`)이면 대시보드를 앞으로 가져옵니다.
- 실행 후 키 보내기: 슬롯의 선택 항목 `sendKeys`(예: `Ctrl+Alt+Shift+V`, 빈 값=끔)가 올바르면(`keycombo.js` `parseCombo`) 실행 성공 뒤 `foreground.waitStable`이 200ms마다 맨 앞 창을 읽어, 시계 창·`Progman`/`WorkerW`/`Shell_TrayWnd`가 아닌 같은 창이 1000ms 이어지면(`shouldSend`) 700ms를 더 기다려 같은 창이 아직 맨 앞인지 다시 확인(`confirmSend`, 첫 실행이 느린 앱 대비)한 뒤 `system.sendCombo`가 koffi `keybd_event`로 수정키 누름→주 키 누름·뗌→수정키 뗌을 15ms 간격으로 보냅니다. 재확인 대기를 포함해 10초 안에 조건이 안 되면 보내지 않고 '7번 키 보내기 실패'를 3초 표시하며, 다른 슬롯을 실행하면 대기는 취소됩니다. 시계 창에는 절대 보내지 않습니다.

## 7. 갱신·오류

- 갱신 주기: 일정·메모 5분, 날씨 30분, IP 위치 24시간. 메인 `sync.js`가 담당하고 시작 직후 1회 실행.
- 실패하면 마지막 값을 유지하고 지수 백오프(최대 30분)로 재시도합니다. 상태는 테마 문법 안의 한 줄 안내로만 표시하며 오류 창은 띄우지 않습니다.
- 자정·절전 복귀(`powerMonitor` `resume`) 때 즉시 재갱신합니다.

## 8. 다크모드·야간 감광

설정: 라이트(기본) / 다크 / 자동(야간 19:00~07:00 다크, 시각 변경 가능; 2026-11-11 사용자 결정, 옛 설정은 `settingsVersion` 2 이관 때 한 번 라이트로 바꿈). 전환은 CSS 변수 2초 교차 페이드. 테마마다 라이트·다크 두 벌.
야간 감광(기본 끔 — 2026-11-11 사용자 결정, 옛 설정은 `settingsVersion` 2 이관 때 한 번 끔으로 바꿈; 최소 밝기 기본 0%): 야간 시간대 시작 시 밝기 저장→최소, 끝나면 복구. 앱 종료(`before-quit`) 때도 복구. 비정상 종료 대비로 '감광 중·원래 값'을 settings에 기록해 다음 시작 때 낮이면 복구. 야간 중 사용자가 직접 밝기를 바꾸면 그 값을 존중(다음 전환까지 다시 낮추지 않음).

## 9. 가벼움 예산

- 렌더는 초 경계 정렬 `setTimeout` 1초 1회. 초침 같은 연속 움직임은 CSS `transform` 애니메이션만 사용(합성 스레드).
- 대기 중 목표: CPU 평균 1% 미만, 메모리 250MB 미만(측정해 보고).
- 잔상 방지 이동은 넣지 않습니다(2026-11-11 사용자 지시).

## 10. 설정 서랍 (v1.2 재설계)

마우스를 움직이면 우측 하단에 작은 톱니가 3초간 나타납니다. 누르면 오른쪽에서 폭 520px 서랍이 0.28초 ease-out으로 밀려 나오고(닫기 0.2초), 뒤 화면은 `rgba(0,0,0,.35)`로 어두워집니다(바깥을 누르거나 Esc로 닫음). 마우스 커서는 평소 숨깁니다.
색은 패널 #17171a·구분선 #26262b·본문 #ececef·보조 #9a9aa3·강조 #e8a33d 하나(밝은 모드 없음), 서체는 Pretendard Variable. 저장 버튼은 없고 바꾸는 즉시 저장하며 항목 옆에 0.8초 '저장됨'이 뜹니다.
탭 4개(밑줄형, 방향키로 이동):
- **화면**: 테마 6종(실제 화면 축소 이미지 카드 2열, 현재 색 모드에 맞는 `thumbs/<id>-<light|dark>.webp`) / 색 모드(라이트·다크·자동) / 야간 시간 / 야간 감광 / 최소 밝기(0~30%) / Windows 시작 시 자동 실행.
- **단축키**: 숫자패드 단축키(0·+·−·1~9 일괄) / 웹 링크 브라우저 / 슬롯 1~9(이름·웹/프로그램·주소 또는 경로·찾아보기·주소창 없는 창·실행해 보기, 빈 슬롯은 흐리게).
- **연결**: 구글(상태·로그인/해제·클라이언트 파일·표시할 캘린더·메모 목록) / 날씨 위치(자동·지명 검색) / 감시할 서버(행마다 상태 점, 연결 탭이 열려 있는 동안 15초마다 확인).
- **정보**: 버전 / 설정 폴더 열기 / 앱 종료(붉은 외곽선, 한 번 더 눌러 확인).
썸네일은 `docs/theme-shots/<id>-<mode>.png`(1600) 가운데 w=1440으로 찍은 화면을 ffmpeg로 320×200으로 줄여 만듭니다.

### 10.1 화면 크기 (v1.2)
스테이지는 높이 900 고정, 너비 `W = clamp(올림(900 × 창너비/창높이), 1200, 1800)`이며 `--stage-w`로 테마에 알립니다. 배율은 `창높이/900`이라 16:9·16:10·3:2 모두 가장자리 띠가 없습니다. 1200·1800을 벗어나는 극단 비율만 남는 여백을 바탕색으로 채웁니다. 상세 규칙은 `theme-contract.md`.

## 11. 구현 순서 (Sonnet 단계별, 각 단계 끝에 시험·스크린샷)

1. 뼈대: Electron 창·전체화면·전원 차단·설정 저장·테마 1종(대표) 정적 렌더.
2. 키 라우팅·타이머(순수 함수 시험 먼저)·슬롯 실행·복귀 감시.
3. 날씨·캐시·상태 줄.
4. 구글 OAuth·캘린더·Tasks.
5. 나머지 테마·다크모드·설정 서랍.
6. portable 빌드, 사용자 설치 안내(`docs/setup.md`: Google Cloud 콘솔 단계 포함).

감사(Codex, 최소): 2단계 키 라우팅·타이머와 4단계 토큰 보관만 확인합니다.

테마(DESIGN.md 6종)는 3절 테마 계약에 맞춰 핵심 앱과 병렬로 구현하고, `tools/theme-preview.html`(예시 모델로 6종 × 라이트/다크 × 타이머 상태를 띄우는 확인용 페이지)로 검증합니다.

## 12. 자동 실행(v1.2 구현)·제외 항목

- **Windows 시작 시 자동 실행**: 설정 `autoStart`(기본 꺼짐). 켜면 `app.setLoginItemSettings({ openAtLogin: true, path })`. portable exe는 실행할 때마다 임시 폴더에 풀려 `process.execPath`가 임시 경로이므로 **`PORTABLE_EXECUTABLE_FILE`(원래 exe 경로)만** 등록합니다(`src/main/autostart.js`). 그 값이 없으면(`npm start` 개발 실행) 토글을 막고 '설치본에서만 쓸 수 있습니다'를 보입니다. exe를 옮기면 등록 경로가 낡으므로 앱 시작 때 켜져 있으면 현재 경로로 다시 등록합니다. 시작 직후 네트워크가 늦게 잡혀도 마지막 캐시를 보여 주고 §7의 백오프로 회복합니다(`sync.js` 시험 포함).
- 음력·절기 표시: 사용자 결정으로 하지 않습니다.

// 개정 기록 | 2026-11-11 | v1 작성 | 사용자 의도 브리프 + 메모·구글·브라우저·타이머 답변 반영
// 개정 기록 | 2026-11-11 | v1.1 | 추가 요구 4종(볼륨·야간 감광·우산/마스크·상태 점), 잔상 이동 제외, 테마 6종 확정
// 개정 기록 | 2026-11-11 | 단축키 포커스 전용 | 사용자 결정: 전역 단축키 제거(§1·§4), 야간 감광 기본 끔(§8)
// 개정 기록 | 2026-11-11 | 기본 라이트 | 사용자 결정: 색 모드 기본 라이트(§8)
// 개정 기록 | 2026-11-11 | v1.2 | §10 설정 서랍 재설계·화면 크기, §12 자동 실행 구현·음력 제외 | docs/v1.2-brief.md
// 개정 기록 | 2026-11-11 | 실행 후 키 보내기 | 사용자 요청: §6 실행 후 키 보내기 단락 추가(안정 1000ms·재확인 700ms)
