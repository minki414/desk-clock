You are the implementer for the DeskClock Electron app in this folder (the repository root, git branch `main`).

Read `docs/v1.8-brief.md` completely and implement ALL of sections A through G exactly as written. Follow its 공통 규칙 (rules) strictly. The most important rules:
- NEVER run the produced installer on this machine. Verify it statically instead.
- Pin `electron-updater` to an exact version that is at least 2 weeks old.
- Never use `--publish` and never put a GitHub token in the environment.
- Use ASCII-only screenshot paths, and run headless Edge only with a temp profile, killing only the PIDs you started.
- Never touch `%APPDATA%\DeskClock`.
- Put no local paths or personal emails in tracked files.
- Commit only on `main`. Never push, never touch `public-release`, and never run `gh release`.

Before editing, read `docs/architecture.md` §1, §10 and §12, plus the code you change: `package.json` build config, `src/main/main.js`, `src/main/autostart.js`, `src/preload/preload.js`, the about tab in `src/renderer/settings.js`, and `src/renderer/i18n.js`.

Work in small steps and commit after each section. Run `npm test` after each section; it must stay green.

You MUST open the about-tab screenshots and fix any overlap or clipping.

When done, write `docs/v1.8-report.md` in Korean as the brief describes, commit it, and stop. If `dist` intermediates cannot be deleted, ask the coordinator.
