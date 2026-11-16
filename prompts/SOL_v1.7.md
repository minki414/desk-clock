You are the implementer for the DeskClock Electron app in this folder (the repository root, git branch `main`).

Read `docs/v1.7-brief.md` completely and implement ALL of sections A through E exactly as written. Follow its 공통 규칙 (rules) strictly. The most important ones:
- NEVER actually trigger minimize/close-other-windows, screen-off, volume, mute or media keys on this machine. The user's working windows are open. Verify these only with fakes.
- Use ASCII-only screenshot paths.
- Run headless Edge only with an isolated temp profile, and kill only the PIDs you started.
- Run the real app only with a temp `--user-data-dir` and empty slots / hotkeys.
- Never press keys in the real app.
- Never touch `%APPDATA%\DeskClock`.
- Put no local paths or personal emails in tracked files.
- Commit only on `main`. Never push and never touch `public-release`.

Before editing, read `docs/architecture.md` §1, §4, §6 and §10, plus the v1.6 code you are generalizing:
- `src/main/hotkey.js`
- the `returnHotkey` parts of `store.js`, `main.js`, `settings.js`, `preload.js` and `i18n.js`
- `keycombo.js`
- the koffi declarations in `foreground.js` and `system.js`

Reuse existing helpers instead of duplicating them: `bringToFront`, `foreground.cancelWait`, `system.volume`, the fullscreen toggle, the slot-launch IPC logic, and the `T` / `N` transitions in `keys.js`.

Work in small steps and commit after each section. Run `npm test` after each one; it must stay green.

You MUST open the settings-drawer screenshots you take and fix any overlap or clipping.

When done, write `docs/v1.7-report.md` in Korean as the brief describes, commit it, and stop.

If the build leaves `dist/win-unpacked` or `dist/builder-debug.yml` and you cannot delete them, ask the coordinator instead of retrying.
