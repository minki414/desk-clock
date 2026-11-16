// 창·전원·IPC 배선만 담당합니다. 실제 일은 각 모듈이 합니다.
const { app, BrowserWindow, Menu, ipcMain, powerSaveBlocker, powerMonitor, shell, dialog, safeStorage, globalShortcut } = require('electron');
const path = require('node:path');
const { createStore, newPerson, MAX_PEOPLE } = require('./store');
const { createHotkeys } = require('./hotkey');
const { createDispatcher } = require('./hotkeyActions');
const dispatch = createDispatcher({ now: () => Date.now() });
const { createTimer } = require('./timer');
const { launchSlot } = require('./launcher');
const { createForeground, shouldReturn } = require('./foreground');
const system = require('./system');
const weather = require('./weather');
const { createSync } = require('./sync');
const { createGoogle } = require('./google');
const autostart = require('./autostart');
const { parseCombo } = require('../renderer/keycombo.js');
const { t } = require('../renderer/i18n.js');

let win = null;
let store = null;
let timer = null;
let foreground = null;
let sync = null;
let google = null;
let health = null;
let dimmer = null;
let hotkey = null;
let updater = null;
// 렌더러로 보내는 최신 자료 묶음(캐시에서 시작해 갱신 때마다 덮어씀)
const data = { weather: null, people: {}, sync: {}, health: 'ok', dimOverlay: 0 };

const send = (ch, v) => { if (win && !win.isDestroyed()) win.webContents.send(ch, v); };
const pushData = () => send('data', data);
const lang = () => (store ? store.settings().lang : 'ko');
const toast = (key, vars) => send('toast', t(lang(), key, vars));

// 맨 앞으로: Windows가 포커스 훔치기를 막을 수 있어 최상위를 잠깐 켰다 끕니다.
function bringToFront() {
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.setAlwaysOnTop(true);
  win.show();
  win.focus();
  win.setAlwaysOnTop(false);
}

// 설정에 연결 상태(클라이언트 JSON 유무·사람별 토큰 유무)를 반영하고 화면에 알림
function applyFlags() {
  return store.patch({ google: { hasClient: google.hasClient() }, people: store.settings().people.map((p) => ({ ...p, google: { ...p.google, connected: google.isConnected(p.id) } })) });
}
const googleFlags = () => send('settings', applyFlags());
// 설정창이 보낸 사람 id 가 실제 목록에 있는 것인지 확인(파일 이름에 쓰이므로)
const personOf = (id) => store.settings().people.find((p) => p.id === id);
function markExpired(id) {
  const p = personOf(id);
  if (!p || (p.google.expired && !p.google.connected)) return;
  store.patch({ people: store.settings().people.map((p) => p.id === id ? { ...p, google: { ...p.google, expired: true } } : p) });
  googleFlags();
}

// 일정·메모 받아오기 설정(켬/끔·캘린더 선택·메모 목록)이 바뀌었는지 비교하는 표식
const feedSig = () => JSON.stringify(store.settings().people.map((p) => [p.id, p.calendar, p.tasks]));

// 자정에 일정 범위(오늘~7일 뒤)가 하루 밀리므로 바로 다시 가져옴
function scheduleMidnight() {
  const n = new Date();
  const next = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 0, 5);
  setTimeout(() => { sync.refresh(); scheduleMidnight(); }, next - n);
}

function createWindow() {
  win = new BrowserWindow({
    fullscreen: true,
    autoHideMenuBar: true,
    backgroundColor: '#000000',
    title: t(lang(), 'app.title'),
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      autoplayPolicy: 'no-user-gesture-required',   // 알림음이 사용자 입력 없이 울려야 함
    },
  });
  win.setMenuBarVisibility(false);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  for (const event of ['enter-full-screen', 'leave-full-screen']) win.on(event, () => send('window', { fullscreen: win.isFullScreen() }));
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

const slotLastAt = new Map();
async function runSlot(n, { force = false, allowWhenDisabled = false } = {}) {
    const st = store.settings();
    if (!st.hotkeysOn && !force && !allowWhenDisabled) return;
    if (!force) {
      const now = Date.now(), previous = slotLastAt.get(n);
      if (previous !== undefined && now - previous < 1500) return;
      slotLastAt.set(n, now);
    }
    foreground.cancelWait();   // 다른 슬롯을 누르면 앞 슬롯의 키 보내기 대기는 취소
    const slot = st.slots.find((x) => x.key === n);
    if (!slot || !slot.target) {
      toast('toast.empty', { n });
      return;
    }

    // 1. 실행 직전 포그라운드 허락: 시계가 맨 앞일 때만 효과가 있으므로 실행 직전에 호출
    foreground.allowSetForegroundWindow();

    // 2. 슬롯별 창 기억·재사용 판정: 살아있는 창이 있으면 새로 실행하지 않고 앞으로 꺼냄
    const rememberedHwnd = foreground.getSlotWindow(n);
    const alive = foreground.isWindowAlive(rememberedHwnd);
    const decision = foreground.decideLaunch({
      rememberedAlive: alive,
      isMinimized: alive ? foreground.isWindowMinimized(rememberedHwnd) : false,
    });

    let ok = false;
    if (decision === 'focus-existing') {
      ok = foreground.focusWindow(rememberedHwnd);
    }
    if (!ok) {
      const r = await launchSlot(slot, st.browser, shell);
      if (!r.ok) {
        toast(r.reason === 'empty' ? 'toast.empty' : 'toast.fail', { n });
        return;
      }
      ok = true;
    }

    foreground.watch();
    const combo = parseCombo(slot.sendKeys);
    const back = shouldReturn(slot);
    const self = String(win.getNativeWindowHandle().readBigUInt64LE());

    // 3. 안정 판정 대기 (기존 창 꺼냄·새 실행 모두)
    foreground.waitStable(self, async (readyHwnd) => {
      if (readyHwnd) foreground.rememberSlotWindow(n, readyHwnd);
      if (combo) {
        if (!(await system.sendCombo(combo))) toast('toast.sendFail', { n });
        else if (back) foreground.returnLater();
      } else if (back) {
        foreground.returnLater();
      }
    }, () => {
      // 10초 안에 다른 창이 맨 앞이 되지 않으면 기억하지 않고, 상태 문장은 띄우지 않음(키 전송 실패 시만 토스트)
      if (combo) toast('toast.sendFail', { n });
    });
}

function toggleFullscreen() {
  if (win.isFullScreen()) { win.setFullScreen(false); win.maximize(); }
  else win.setFullScreen(true);
}

function wireIpc() {
  ipcMain.handle('update:state', () => ({ ...updater.state(), portable: !!(process.env && process.env.PORTABLE_EXECUTABLE_FILE) }));
  ipcMain.handle('update:check', () => updater.check());
  ipcMain.handle('update:download', () => updater.download());
  ipcMain.handle('update:install', () => {
    if (updater.state().phase !== 'ready') return updater.state();
    if (timer.snapshot().phase !== 'idle') return { phase: 'ready', message: 'ui.update.timer' };
    dimmer.restoreSync();
    hotkey.dispose();
    return updater.install();
  });
  ipcMain.handle('update:releases', () => shell.openExternal('https://github.com/minki414/desk-clock/releases/latest'));
  ipcMain.handle('app:init', () => ({ settings: store.settings(), data, fullscreen: win.isFullScreen(), timer: timer.snapshot() }));
  ipcMain.handle('settings:set', (_e, patch) => {
    const sig = feedSig();
    store.patch(patch && typeof patch === 'object' ? patch : {});
    const s = patch && patch.people ? applyFlags() : store.settings();   // 연결 표시는 설정창의 낡은 값이 아니라 토큰 파일이 정본
    if (patch && 'customHotkeys' in patch) hotkey.apply(s.customHotkeys);
    if (patch && 'autoStart' in patch) autostart.apply(app, store.settings().autoStart);
    dimmer.tick();
    if (patch && patch.location) sync.refresh();
    else if (patch && 'lang' in patch) sync.refresh(['weather']);   // 날씨 지명도 새 언어로
    if (patch && patch.people && feedSig() !== sig) sync.refresh(['calendar', 'tasks']);
    if (patch && patch.servers) health.check();
    send('settings', s);
    return s;
  });
  ipcMain.handle('window:toggleFullscreen', toggleFullscreen);
  ipcMain.handle('hotkey:states', () => hotkey.states());
  ipcMain.handle('hotkey:suspend', (_e, on) => { hotkey.suspend(on === true); return hotkey.states(); });
  ipcMain.handle('timer:start', (_e, ms) => { if (Number.isFinite(ms) && ms > 0) timer.start(ms); });
  ipcMain.handle('timer:pause', () => timer.pause());
  ipcMain.handle('timer:resume', () => timer.resume());
  ipcMain.handle('timer:cancel', () => timer.cancel());
  // 볼륨: 시계 창이 포커스일 때 렌더러 키 라우팅이 보냄(전역 단축키 없음)
  ipcMain.handle('system:volume', (_e, up) => system.volume(!!up));
  ipcMain.handle('night:force', (_e, on) => dimmer.setForced(on));
  ipcMain.handle('launch', (_e, n, force) => runSlot(n, { force }));
  ipcMain.handle('google:pickClient', async () => {
    const r = await dialog.showOpenDialog(win, { filters: [{ name: 'JSON', extensions: ['json'] }], properties: ['openFile'] });
    if (r.canceled || !r.filePaths[0]) return { ok: false, canceled: true };
    const res = google.importClient(r.filePaths[0]);
    googleFlags();
    return res;
  });
  ipcMain.handle('google:connect', async (_e, id) => {
    if (!personOf(id)) return { ok: false, error: t(lang(), 'err.connect') };
    try {
      await google.connect(id, { loginHint: personOf(id).google.account });
      store.patch({ people: store.settings().people.map((p) => p.id === id ? { ...p, google: { ...p.google, expired: false } } : p) });
      let account = '';
      try {
        const lists = await google.lists(id);
        const primary = lists.calendars.find((c) => c.primary && c.id.includes('@'));
        if (primary) account = primary.id;
      } catch { /* 목록 실패는 완료된 로그인을 취소하지 않음 */ }
      store.patch({ people: store.settings().people.map((p) => p.id === id && !p.google.expired ? { ...p, google: { ...p.google, account } } : p) });
      googleFlags();
      bringToFront();
      sync.refresh(['calendar', 'tasks']);
      return { ok: true };
    } catch (e) { return { ok: false, error: t(lang(), e.code === 'tokenUnavailable' ? 'status.token' : 'err.connect') }; }
  });
  ipcMain.handle('google:disconnect', async (_e, id) => {
    if (!personOf(id)) return;
    await google.disconnect(id);
    store.patch({ people: store.settings().people.map((p) => p.id === id ? { ...p, google: { connected: false, expired: false, account: '' } } : p) });
    sync.clearPerson(id);
    googleFlags();
  });
  ipcMain.handle('google:lists', async (_e, id) => {
    if (!personOf(id)) return null;
    try { return await google.lists(id); } catch { return null; }   // null = 목록을 가져오지 못함
  });
  // 사람 추가(최대 4명)·삭제(마지막 한 명은 불가). 삭제하면 그 사람의 토큰 파일과 받아 둔 자료도 지움
  ipcMain.handle('people:add', () => {
    const st = store.settings();
    if (st.people.length < MAX_PEOPLE) { store.patch({ people: [...st.people, newPerson(st.people, st.lang)] }); googleFlags(); }
    return store.settings();
  });
  ipcMain.handle('people:remove', async (_e, id) => {
    const st = store.settings();
    if (st.people.length > 1 && personOf(id)) {
      await google.disconnect(id);
      store.patch({ people: st.people.filter((p) => p.id !== id) });
      sync.clearPerson(id, true);
      googleFlags();
    }
    return store.settings();
  });
  ipcMain.handle('weather:search', async (_e, q) => {
    try { return typeof q === 'string' && q.trim() ? await weather.geocode(q.trim(), 5, lang()) : []; } catch { return null; }   // null = 검색 실패
  });
  ipcMain.handle('slot:pickProgram', async () => {
    const r = await dialog.showOpenDialog(win, { filters: [{ name: t(lang(), 'dialog.programs'), extensions: ['exe', 'lnk', 'bat', 'cmd'] }, { name: t(lang(), 'dialog.all'), extensions: ['*'] }], properties: ['openFile'] });
    return r.canceled || !r.filePaths[0] ? null : r.filePaths[0];
  });
  ipcMain.handle('health:servers', () => system.serverStates(store.settings().servers));
  ipcMain.handle('autostart:available', () => !!autostart.pickPath(process.env, undefined, app));   // 개발 실행이면 false → 설정창이 토글을 막음
  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.handle('app:folder', () => shell.openPath(store.dir));
  ipcMain.handle('app:quit', () => app.quit());
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', bringToFront);
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    const { createUpdater } = require('./updater');
    const { autoUpdater } = require('electron-updater');
    updater = createUpdater({ autoUpdater, isSupported: () => app.isPackaged && !(process.env && process.env.PORTABLE_EXECUTABLE_FILE), onState: (s) => send('update', s) });
    store = createStore(app.getPath('userData'));
    timer = createTimer({
      onChange: (s) => send('timer', s),
      onFinish: bringToFront,   // 렌더러가 가려져 있어도 마감 때 화면을 앞으로
    });
    wireIpc();
    foreground = createForeground(bringToFront);
    hotkey = createHotkeys({ shortcut: globalShortcut, onPress: (entry) => dispatch(entry, {
      isFocused: () => !win || win.isDestroyed() || win.isFocused(),
      cancelWait: () => foreground.cancelWait(), bringToFront,
      others: (action) => system.affectOtherWindows(action, process.pid),
      volume: system.volume, media: system.mediaKey, runSlot,
      command: (command) => send('command', command), fullscreen: toggleFullscreen,
      screenOff: system.screenOff, toast,
    }) });
    hotkey.apply(store.settings().customHotkeys);
    // safeStorage의 동기 API는 폐기 예정이라 비동기 어댑터로 감쌈
    const safe = {
      available: () => safeStorage.isAsyncEncryptionAvailable(),
      encrypt: (t) => safeStorage.encryptStringAsync(t),
      decrypt: async (b) => (await safeStorage.decryptStringAsync(b)).result,
    };
    google = createGoogle({ dir: store.dir, safe, openUrl: (u) => shell.openExternal(u), lang, onExpired: markExpired });
    google.migrateLegacy();   // v1.3까지의 단일 토큰 파일 → 사람 1(실패하면 옛 파일 그대로 읽음)
    applyFlags();
    sync = createSync({ store, data, push: pushData, google, onSettings: () => send('settings', store.settings()), onExpired: markExpired });
    health = system.createHealth({ getServers: () => store.settings().servers, onChange: (h) => { data.health = h; pushData(); } });
    dimmer = system.createDimmer({
      getSettings: store.settings,
      setDim: (d) => store.patch({ dim: d }),
      onOverlay: (v) => { if (data.dimOverlay !== v) { data.dimOverlay = v; pushData(); } },
    });
    // exe를 다른 폴더로 옮기면 등록 경로가 낡으므로, 켜져 있으면 시작 때 현재 경로로 다시 등록
    if (store.settings().autoStart) autostart.apply(app, true);
    powerSaveBlocker.start('prevent-display-sleep');
    createWindow();
    sync.start();
    health.start();
    dimmer.start();
    scheduleMidnight();
    // 절전 복귀: 모든 값을 즉시 다시 확인
    powerMonitor.on('resume', () => { sync.refresh(); health.check(); dimmer.tick(); timer.check(); });
  });
  app.on('will-quit', () => hotkey && hotkey.dispose());
  app.on('before-quit', () => { dimmer && dimmer.restoreSync(); });
  app.on('window-all-closed', () => app.quit());
}
// 개정 기록 | 2026-11-11 | 최초 작성 | 설계서 §2 main.js: 창·전원·IPC 배선
// 개정 기록 | 2026-11-11 | v1.2 | autoStart 적용·시작 때 재등록, 실행해 보기(force)·프로그램 찾아보기·서버별 상태·설정 폴더·버전 통로 | docs/v1.2-brief.md §2·§3
// 개정 기록 | 2026-11-11 | 단축키 포커스 전용 | 사용자 결정: 전역 단축키·key 전달·ui:drawer 제거, 볼륨은 system:volume 통로로
// 개정 기록 | 2026-11-11 | 실행 후 키 보내기 | 사용자 요청: 실행 성공 뒤 sendKeys 가 있으면 맨 앞 창 안정 대기 후 전송, 다른 슬롯 실행 시 대기 취소
// 개정 기록 | 2026-11-11 | 실행 후 시계로 돌아오기 | 사용자 요청: returnToClock 슬롯은 키 전송(또는 앱 창 안정) 뒤 1.5초 후 bringToFront
// 개정 기록 | 2026-11-11 | v1.3 | 토스트·오류·대화상자 문구를 설정 언어로, 언어 변경 시 날씨 갱신, 지오코딩에 언어 전달 | docs/v1.3-i18n-brief.md
// 개정 기록 | 2026-11-12 | 사람 여러 명 | 사용자 결정: 구글 연결·해제·목록을 사람 id별로, people:add/remove 통로, 시작 때 옛 토큰 파일 이관
// 개정 기록 | 2026-11-15 | 슬롯 창 재사용과 실행 직전 AllowSetForegroundWindow 호출 | 사용자 요청
// 개정 기록 | 2026-11-15 | night:force 통로 배선 | 사용자 요청

// 개정 기록 | 2026-11-16 | 전역 복귀 단축키 설정·녹화·배선 | 사용자 요청

// 개정 기록 | 2026-11-16 | 전체화면 전환 버튼과 창 상태 전달 | 사용자 요청

// 개정 기록 | 2026-11-16 | 구글 만료 감지와 간편 재로그인 | 사용자 요청

// 개정 기록 | 2026-11-16 | 목록·동기화·연결 계정 조회의 만료 설정을 멱등하게 반영 | 사용자 요청

// 개정 기록 | 2026-11-16 | customHotkeys v4 | 사용자 요청

// 개정 기록 | 2026-11-16 | customHotkeys 목록 배선 | 사용자 요청

// 개정 기록 | 2026-11-16 | 감사 후속: 상태 복구와 반복 실행 제한 | 사용자 요청
// 개정 기록 | 2026-11-17 | 수동 업데이트 IPC와 설치 전 정리 | 사용자 요청
