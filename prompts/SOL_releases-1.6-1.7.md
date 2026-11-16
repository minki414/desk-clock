You are publishing the missing GitHub Releases for DeskClock 1.6.0 and 1.7.0 (public repo `minki414/desk-clock`, `gh` is logged in). Follow the steps exactly and stop at the first unexpected state (report it instead of improvising).

Rules:
- Do not change `main` code.
- Do not touch the `public-release` branch history.
- Never force-push.
- Never touch `%APPDATA%\DeskClock`.
- Never launch or kill the user's browsers.
- Use only ASCII temp paths.
- Do not put local paths or personal emails in release notes.

1. Look at the existing releases (`gh release list`, `gh release view v1.5.0`) and copy their style: title `DeskClock X.Y.Z`, tag `vX.Y.Z`, Korean bullet notes written for end users, one asset `DeskClock-X.Y.Z-portable.exe`.

2. 1.7.0
   - Before uploading, confirm that `dist/DeskClock-1.7.0-portable.exe` was built from the current code: extract or compare its `resources/app.asar` file list and `src/**` contents with the `main` tree. If they differ, rebuild with `npm run dist`.
   - Then: `gh release create v1.7.0 dist/DeskClock-1.7.0-portable.exe --target 96d356dec0815b6fd940209d528dfbbba0f2944c --title "DeskClock 1.7.0" --notes-file <temp file>`. Mark it as Latest.
   - Write the notes from `docs/v1.7-report.md` and `docs/v1.7-brief.md`: user-defined global hotkeys recorded in Settings → 단축키, the list of functions, and the allowed keys (Ctrl/Alt/Win combos or F1–F24).

3. 1.6.0
   - Build the portable exe from release commit `5493017`. Use `git worktree add <ASCII temp dir> 5493017` (detached), run `npm ci` there, then `npx electron-builder --win portable --x64`, and wait for it to finish.
   - Run `gh release create v1.6.0 <that exe> --target 5493017 --title "DeskClock 1.6.0" --notes-file <temp> --latest=false`.
   - Write the notes from `docs/v1.6-brief.md` and the report: Ctrl+H 시계로 돌아오기, the bottom-left 전체화면 끄기 button, and 구글 로그인 만료 시 '다시 로그인'. Also add one line: "7일마다 끊기면 Google Cloud 콘솔에서 앱을 프로덕션으로 게시하세요(docs/setup.md)".
   - Afterwards run `git worktree remove` and delete the temp dir.

4. Verify:
   - `gh release list` shows 1.7.0 as Latest, then 1.6.0, then 1.5.0.
   - Each release has exactly one exe asset.
   - The SHA-256 of each downloaded asset matches the local file.
   - `git status` on main is clean, and `dist` still contains only `DeskClock-1.7.0-portable.exe`.

Report the release URLs and SHA-256 values, then send worker_done.
