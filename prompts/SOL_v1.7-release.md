You are publishing DeskClock 1.7.0 from this repository (root folder). Follow the steps exactly and stop at the first unexpected state (report it instead of improvising). Never force-push, never rewrite `main` history, never touch `%APPDATA%\DeskClock`, never launch or kill the user's browsers, never trigger the real window/screen/volume/media actions.

1. On `main`, the working tree must be clean except the untracked `prompts/SOL_v1.7-release.md`.
2. Append to the end of `docs/v1.7-report.md` (Korean), under a heading `## 감사 결과`:
   - 1차(Astra): 설정·이관·창 고르기·회귀 PASS, FAIL 2건(녹화 취소 뒤 행 상태 미갱신, 전역 단축키 경로의 슬롯 중복 실행) → 수정.
   - 2차: 두 건 해결, 새 FAIL 1건(숫자패드·전역 단축키 혼용 시 렌더러 중복 판정 간섭) → 중복 판정을 메인 공통 runSlot 한 곳으로 일원화.
   - 3차(좁은 범위): PASS, 시험 136개.
   Commit it together with this prompt file on `main`: `docs: v1.7 감사 결과와 공개 지시서`.
3. Hygiene: run the same tracked-file check you used for 1.6 (local drive/user-folder paths, the Windows user name, personal email domains), excluding `package-lock.json` third-party metadata. It must find nothing. `npm test` must pass. `dist` must contain only `DeskClock-1.7.0-portable.exe`.
4. Release branch:
   - `git fetch origin`
   - `git checkout public-release`
   - `git merge --ff-only origin/main`. If that fails, stop and report.
   - `git read-tree -u --reset main`
   - Commit with author/committer `minki414 <282180622+minki414@users.noreply.github.com>` (`git -c user.name=minki414 -c user.email=282180622+minki414@users.noreply.github.com commit`). Message: first line `DeskClock 1.7.0 — 사용자 단축키 여러 개(녹화로 지정): 시계로 돌아오기·다른 창 최소화/닫기·볼륨·미디어·슬롯·타이머·야간·전체화면·화면 끄기`, then a blank line, then `Co-Authored-By: Codex <noreply@openai.com>` and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
   - Verify that the `public-release` tree equals the `main` tree.
   - `git push origin public-release:main` (no force)
   - `git checkout main`
5. Report the pushed SHA, the top 3 lines of `origin/main`, the test count, and the final `git status`, then send worker_done.
