# 감사 지시서 — v1.6 전체(돌아오기 단축키·전체화면 버튼·구글 재로그인)

코드는 수정하지 말고 판정만 하십시오. 기준 문서: `docs/v1.6-brief.md`, `docs/architecture.md`. 범위: `git diff fc300ac..main`(v1.6 작업 전체)과 그 diff가 닿는 함수.

확인 항목:
1. **A 전역 단축키** (`src/main/hotkey.js`, `src/renderer/keycombo.js` `toAccelerator`, `main.js`, `settings.js`):
   - 수정키 없는 조합·Shift만 조합이 절대 등록되지 않는가(다른 프로그램의 일반 타이핑 탈취 방지).
   - 재적용·`dispose`가 자기 것만 해제하는가, `will-quit`에서 해제되는가.
   - 설정 녹화 중 `suspend(true)` 뒤 녹화 끝·취소·서랍 닫힘·탭 이동·창 닫힘 등 **모든 경로에서** 다시 등록되는가(영구 해제로 남는 경로가 없어야 함). 'invalid' 값이 저장되지 않는가.
   - 누름 처리: 시계가 이미 포커스면 무동작, 아니면 `cancelWait` + `bringToFront`, 창 모드를 바꾸지 않는가. `hotkeysOn`과 무관한가.
2. **B 전체화면 버튼**: 시작 때 항상 전체화면, 설정·파일에 창 모드가 저장되지 않는가, 끄면 `maximize`(작업 표시줄 보임), 아이콘·aria 상태가 실제 창 상태(`enter/leave-full-screen`)와 어긋나는 경로가 없는가.
3. **C 구글 재로그인** (`google.js`, `sync.js`, `store.js`, `main.js`, `settings.js`, `i18n.js`):
   - 갱신 중 `invalid_grant`만 `'expired'`이고 토큰 파일이 지워지는가, 다른 오류는 토큰을 지우지 않는가.
   - refresh token이 평문으로 디스크·로그·설정·IPC로 새는 경로가 없는가(v1.0 감사 기준 유지). `account`(이메일)가 토큰과 섞이지 않는가.
   - `applyFlags`가 `expired`·`account`를 덮어쓰지 않는가. 재로그인 성공 시 `expired=false`, 캘린더·메모 선택 유지, 해제·사람 삭제 시 초기화.
   - `'expired'`가 백오프를 걸지 않고 사람별로 격리되는가(한 사람 만료가 다른 사람 1분 갱신을 늦추지 않음).
   - `login_hint`가 저장된 `account`일 때만 붙고 `prompt=select_account consent`가 유지되는가. PKCE·state 검증·루프백 127.0.0.1 바인딩이 그대로인가.
4. **회귀**: `npm test` 실행 결과(시험 수), 3언어 키 일치, 공개 저장소 위생 — 추적 파일에 로컬 경로(드라이브 문자로 시작하는 사용자 폴더 경로, 사용자 홈 경로)·개인 이메일이 없는가(`git grep`으로 확인).

출력 형식(한국어, 짧게): 항목별 `PASS` 또는 `FAIL`. FAIL이면 파일:줄, 재현 입력, 기대 동작을 한 줄씩. 사소한 스타일 지적은 쓰지 마십시오. 마지막 줄에 `종합: PASS|FAIL`.
