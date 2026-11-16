# 이어하기 안내 (2026-11-16, v1.7.0 기준)

PC 포맷 전에 남긴 상태 기록입니다. 새 PC에서 이 저장소를 받은 뒤 이 문서부터 읽으면 이어서 작업할 수 있습니다.

## 현재 상태
- 현재 버전: v1.7.0 (`DeskClock-1.7.0-portable.exe`). 사용자 단축키 최대 12개와 기능 드롭다운을 지원합니다. 시험 결과는 `docs/v1.7-report.md`에 기록합니다.
- 정본 문서: `PRODUCT.md`(제품), `DESIGN.md`(테마 6종 시각 규칙), `docs/architecture.md`(구조), `docs/theme-contract.md`(핵심 앱↔테마 계약), `docs/setup.md`(설치·구글 연결 안내).
- 버전별 작업 지시: `docs/v1.2-brief.md` ~ `docs/v1.7-brief.md`, 결과 보고 `docs/v1.7-report.md`.
- 이 공개 저장소는 버전마다 커밋 1개(스냅숏)만 올립니다. 개발 중 세부 커밋 이력은 로컬 main에 유지합니다.

## v1.7 기능
- 사용자 전역 단축키 최대 12개(기능 선택·조합 녹화·삭제, 기본은 시계로 돌아오기 Ctrl+H 한 줄).
- 다른 창 최소화/닫기·볼륨·음소거·미디어·슬롯·타이머·야간 모드·전체화면·화면 끄기를 직접 지정. Ctrl·Alt·Win 조합 또는 F1~F24 단독을 지원하고 중복·점유 상태를 표시합니다.
- v1.6의 돌아오기 단축키를 한 번 이관하며, 지워 둔 사용자는 빈 목록을 유지합니다.
- 좌하단 버튼으로 전체화면 끄기·켜기.
- 구글 로그인 만료 표시와 계정별 다시 로그인.

## 작업 방식 (사용자 결정)
- 설계·결과 확인: Claude Opus. 구현: Gemini Flash High(`agy --model gemini-3.8-flash-high --dangerously-skip-permissions -p "<지시서 경로>를 읽고 수행"`, 지시서는 `prompts/FLASH_*.md`). 감사가 필요하면 Codex 최소 범위.
- 작업 지시 → 구현 → 설계자가 화면을 직접 찍어 확인 → 수정 지시 → 보안 점검(개인 경로·계정명·인증값) → 버전 스냅숏 푸시 + 릴리스.
- 실제 앱 시험 규칙: 임시 `--user-data-dir` + 슬롯 전부 비움 + 숫자패드 단축키 끔 + `customHotkeys: []`, 실제 앱에서 키 입력 금지, 사용자 브라우저·ChatGPT 실행/종료 금지. 창 최소화/닫기·화면 끄기·볼륨·미디어는 fake로만 시험합니다. 헤드리스 Edge는 임시 프로필·ASCII 스크린샷 경로를 쓰고 띄운 PID만 종료합니다.

## 사용자가 아직 확인하지 않은 것 (v1.5.0)
1. 숫자키를 다시 눌렀을 때 새 창 없이 기존 유튜브·ChatGPT 창이 앞으로 오는지.
2. 이미 실행 중인 ChatGPT 슬롯에서 음성 채팅이 켜지는지(‘실행 후 보낼 키’ Ctrl+Alt+Shift+V).
3. N 키 야간 모드 켜기/끄기와 밝기 복구.
4. 두 계정 구글 연결(사람 2 추가), 공유 캘린더 일정의 ‘우리’ 표시.
5. LG그램 실기기에서의 야간 밝기(WMI)·자동 실행·portable exe 실행.

## 새 PC 개발 환경
```powershell
git clone https://github.com/minki414/desk-clock.git
cd desk-clock
npm install
node node_modules/electron/install.js   # npm이 설치 스크립트를 막은 경우
npm test
npm start
```
- 구글 연동 시험에는 Google Cloud(LP Lounge 프로젝트)의 **데스크톱 OAuth 클라이언트 JSON**이 필요합니다. 콘솔에서 다시 내려받을 수 있습니다.
- 앱 설정은 `%APPDATA%\DeskClock\settings.json`에 있습니다(슬롯·사람·테마). 로그인 토큰은 Windows 계정 암호화라 포맷 후에는 다시 로그인해야 합니다.

## 다음 후보 (사용자 요청 대기)
- v1.5 실기기 확인 결과에 따른 수정.

// 개정 기록 | 2026-11-16 | v1.7 사용자 단축키 목록 검증 | 사용자 요청
