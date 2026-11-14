You are fixing visual problems found by the designer in the DeskClock app in this folder (the repository root, branch `main`). Same rules as `docs/v1.5-brief.md` 공통 규칙 (ASCII screenshot paths, no real-app key presses, never launch/kill browsers or ChatGPT, never touch `%APPDATA%\DeskClock`, commit only on main, never push). Keep all 102 tests green.

Problems (designer looked at `tools/theme-preview.html?...&fx=couple`):

1. **receiver** theme, '오늘' window week row: the weekday labels (목 금 토 일 월 화 수 / Thu… / 周四…) render huge (~44px). They must be small engraved-style labels like before v1.5 (about 15–16px, the theme's secondary/engrave colour), with the lamp above and the tiny VFD title + who below. Check ko/zh/en, light/dark, w=1350 and 1600.

2. **standby** theme:
   a. Week: the 7 tiny chips truncate titles to 'Swi…' at w=1350 (and are cramped at 1600) while the '오늘' card has a large empty area below. Replace the chip row with a compact 2-column list inside the today card using that empty space: each row = weekday (bold, Sunday red) + first event title (ellipsis) + small who text, plus '+n' when more; 4 rows left column, 3 right column; row height ≈ 26–28px; thin divider above the list. Titles must be readable at w=1350.
   b. Memos: with exactly 2 groups, stack the groups vertically (full card width each, name label + up to 3 items, thin divider between) instead of two narrow side-by-side columns; keep the 2×2 grid only for 3–4 groups. Let the memo card grow as needed while keeping the right column within 900px height (shrink the today card's empty space accordingly). No truncation of normal-length memos like 'Buy milk and eggs' at w=1350.

3. After fixing, screenshot all 6 themes × ko/en/zh × light/dark at w=1350 and 1600 with fx=couple, plus fx=morning (1 person) and fx=quad (4 people) at 1600 light for standby and receiver, open each PNG and make sure nothing overlaps, clips, wraps badly, or looks heavier than the surrounding design. Regenerate `docs/theme-shots/<id>-<mode>.png` (w=1600, fx=morning, lang=ko) only for themes whose 1-person appearance changed.

4. `npm test` green, rebuild `npm run dist` (wait until finished; only `dist/DeskClock-1.5.0-portable.exe` remains), commit with a Korean message ending `Co-Authored-By: Gemini 3.8 Flash High <noreply@google.com>`, append a short '수정(디자이너 검토 반영)' section to `docs/v1.5-report.md` and commit. Then stop.
