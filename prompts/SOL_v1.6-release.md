You are publishing DeskClock 1.6.0 from this repository (root folder). Follow the steps exactly and stop at the first unexpected state (report it instead of improvising). Never force-push, never rewrite `main` history, never touch `%APPDATA%\DeskClock`, never launch or kill the user's browsers.

1. On `main`, the working tree must contain no changes except the untracked `prompts/SOL_v1.6-fix1.md` and `prompts/SOL_v1.6-release.md`. Anything else is unexpected.
2. Append this note to the end of `docs/v1.6-report.md` (Korean), under a heading `## 감사 결과`:
   - 1차 감사(Astra): A·B·회귀 PASS, C FAIL(목록 조회 경로의 만료 미반영) → 수정 1035f1e·afb3e39.
   - 재감사: 기존 FAIL 해결. 남은 지적 1건: `google:connect` 직후 계정 조회에서 만료를 주입하면 설정 푸시가 2회 일어남. 조정자(Opus) 판단: 보류. 연결 직후에는 캐시된 액세스 토큰을 쓰므로 refresh 단계의 `invalid_grant`가 실제로는 일어나지 않고, 일어나더라도 같은 설정을 한 번 더 그릴 뿐 무해함.
   Then commit both prompt files and the report on `main`: `docs: v1.6 감사 결과와 후속 지시서`.
3. Bring the remote-only handoff doc into `main`: `git fetch origin`, then `git checkout origin/main -- docs/HANDOFF.md`. Read it and update only the facts that are now stale (current version 1.6.0, test count 118, the new v1.6 features in one line each). Keep it short. Commit on `main`: `docs: HANDOFF를 원격에서 가져와 v1.6 기준으로 갱신`.
4. Hygiene: `git grep -nE "사용자 입력 자료|C:\\\\Users|개인계정|@naver\.com|@gmail\.com"` must return nothing from tracked files. `package-lock.json` third-party package metadata is fine. If anything else matches, remove it, commit, and re-check. `npm test` must pass.
5. Release branch:
   - `git checkout public-release`, then `git merge --ff-only origin/main`. If it can't fast-forward, stop and report.
   - `git read-tree -u --reset main`.
   - Commit with author and committer `minki414 <282180622+minki414@users.noreply.github.com>`: `git -c user.name=minki414 -c user.email=282180622+minki414@users.noreply.github.com commit`. The message is the line `DeskClock 1.6.0 — 시계로 돌아오기 단축키(Ctrl+H), 전체화면 끄기 버튼, 구글 로그인 만료 시 바로 다시 로그인`, then a blank line, then `Co-Authored-By: Codex <noreply@openai.com>` and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
   - Verify that `git rev-parse public-release^{tree}` equals `git rev-parse main^{tree}`.
   - `git push origin public-release:main` (no force). Then `git checkout main`.
6. Report the pushed commit SHA, the `origin/main` log (top 3 lines), test count, and the final `git status`, then send worker_done.
