// 창·전원·IPC 배선만 담당합니다. 실제 일은 각 모듈이 합니다.
const { app, BrowserWindow, Menu, ipcMain, powerSaveBlocker, powerMonitor, globalShortcut, shell, dialog, safeStorage } = require('electron');
const path = require('node:path');
const { createStore } = require('./store');
const { createTimer } = require('./timer');
const { launchSlot } = require('./launcher');
const { createForeground } = require('./foreground');
const system = require('./system');
const weather = require('./weather');
const { createSync } = require('./sync');
const { createGoogle } = require('./google');
const autostart = require('./autostart');

let win = null;
let store = null;
let timer = null;
let foreground = null;
let sync = null;
let google = null;
let health = null;
let dimmer = null;
let drawerOpen = false;
// 렌더러로 보내는 최신 자료 묶음(캐시에서 시작해 갱신 때마다 덮어씀)
const data = { weather: null, events: [], tasks: [], sync: {}, health: 'ok', dimOverlay: 0 };

const send = (ch, v) => { if (win && !win.isDestroyed()) win.webContents.send(ch, v); };
const pushData = () => send('data', data);
const toast = (text) => send('toast', text);

// 맨 앞으로: Windows가 포커스 훔치기를 막을 수 있어 최상위를 잠깐 켰다 끕니다.
function bringToFront() {
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.setAlwaysOnTop(true);
  win.show();
  win.focus();
  win.setAlwaysOnTop(false);
}

// 설정에 연결 상태(클라이언트 JSON 유무·토큰 유무)를 반영하고 화면에 알림
function googleFlags() {
  send('settings', store.patch({ google: { hasClient: google.hasClient(), connected: google.isConnected() } }));
}

// 전역 단축키: 단축키 끔이거나 설정 서랍이 열려 있으면 전부 해제(숫자를 입력할 수 있어야 함)
function applyHotkeys() {
  for (const k of ['num0', 'numadd', 'numsub']) globalShortcut.unregister(k);
  if (!store.settings().hotkeysOn || drawerOpen) return;
  // 대시보드가 포커스면 렌더러의 키 라우팅(타이머 숫자 0·알림 끄기)으로, 아니면 대시보드 복귀
  globalShortcut.register('num0', () => (win && win.isFocused() ? send('key', 'Numpad0') : bringToFront()));
  globalShortcut.register('numadd', () => system.volume(true));
  globalShortcut.register('numsub', () => system.volume(false));
}

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
    title: '식탁 시계',
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
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

function wireIpc() {
  ipcMain.handle('app:init', () => ({ settings: store.settings(), data, timer: timer.snapshot() }));
  ipcMain.handle('settings:set', (_e, patch) => {
    const s = store.patch(patch && typeof patch === 'object' ? patch : {});
    applyHotkeys();
    if (patch && 'autoStart' in patch) autostart.apply(app, store.settings().autoStart);
    dimmer.tick();
    if (patch && (patch.location || patch.google)) sync.refresh();
    if (patch && patch.servers) health.check();
    send('settings', s);
    return s;
  });
  ipcMain.handle('timer:start', (_e, ms) => { if (Number.isFinite(ms) && ms > 0) timer.start(ms); });
  ipcMain.handle('timer:pause', () => timer.pause());
  ipcMain.handle('timer:resume', () => timer.resume());
  ipcMain.handle('timer:cancel', () => timer.cancel());
  ipcMain.handle('ui:drawer', (_e, open) => { drawerOpen = !!open; applyHotkeys(); });
  ipcMain.handle('launch', async (_e, n, force) => {
    const st = store.settings();
    if (!st.hotkeysOn && !force) return;   // force: 설정창의 '실행해 보기'는 단축키가 꺼져 있어도 동작
    const r = await launchSlot(st.slots.find((x) => x.key === n), st.browser, shell);
    if (r.ok) foreground.watch();
    else toast(`${n}번 ${r.reason === 'empty' ? '미등록' : '실행 실패'}`);
  });
  ipcMain.handle('google:pickClient', async () => {
    const r = await dialog.showOpenDialog(win, { filters: [{ name: 'JSON', extensions: ['json'] }], properties: ['openFile'] });
    if (r.canceled || !r.filePaths[0]) return { ok: false, canceled: true };
    const res = google.importClient(r.filePaths[0]);
    googleFlags();
    return res;
  });
  ipcMain.handle('google:connect', async () => {
    try {
      await google.connect();
      googleFlags();
      sync.refresh(['calendar', 'tasks']);
      return { ok: true };
    } catch (e) { return { ok: false, error: e.code === 'tokenUnavailable' ? '토큰 보관 불가' : '연결 실패' }; }
  });
  ipcMain.handle('google:disconnect', async () => {
    await google.disconnect();
    data.events = []; data.tasks = [];
    data.sync = { ...data.sync, calendar: { state: 'needAuth' }, tasks: { state: 'needAuth' } };
    store.saveCache({ events: [], tasks: [], eventsAt: null, tasksAt: null });
    googleFlags();
    pushData();
  });
  ipcMain.handle('google:lists', async () => {
    try { return await google.lists(); } catch { return null; }   // null = 목록을 가져오지 못함
  });
  ipcMain.handle('weather:search', async (_e, q) => {
    try { return typeof q === 'string' && q.trim() ? await weather.geocode(q.trim()) : []; } catch { return null; }   // null = 검색 실패
  });
  ipcMain.handle('slot:pickProgram', async () => {
    const r = await dialog.showOpenDialog(win, { filters: [{ name: '프로그램·바로가기', extensions: ['exe', 'lnk', 'bat', 'cmd'] }, { name: '모든 파일', extensions: ['*'] }], properties: ['openFile'] });
    return r.canceled || !r.filePaths[0] ? null : r.filePaths[0];
  });
  ipcMain.handle('health:servers', () => system.serverStates(store.settings().servers));
  ipcMain.handle('autostart:available', () => !!autostart.pickPath());   // 개발 실행이면 false → 설정창이 토글을 막음
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
    store = createStore(app.getPath('userData'));
    timer = createTimer({
      onChange: (s) => send('timer', s),
      onFinish: bringToFront,   // 렌더러가 가려져 있어도 마감 때 화면을 앞으로
    });
    wireIpc();
    foreground = createForeground(bringToFront);
    // safeStorage의 동기 API는 폐기 예정이라 비동기 어댑터로 감쌈
    const safe = {
      available: () => safeStorage.isAsyncEncryptionAvailable(),
      encrypt: (t) => safeStorage.encryptStringAsync(t),
      decrypt: async (b) => (await safeStorage.decryptStringAsync(b)).result,
    };
    google = createGoogle({ dir: store.dir, safe, openUrl: (u) => shell.openExternal(u) });
    store.patch({ google: { hasClient: google.hasClient(), connected: google.isConnected() } });
    sync = createSync({ store, data, push: pushData, google });
    health = system.createHealth({ getServers: () => store.settings().servers, onChange: (h) => { data.health = h; pushData(); } });
    dimmer = system.createDimmer({
      getSettings: store.settings,
      setDim: (d) => store.patch({ dim: d }),
      onOverlay: (v) => { if (data.dimOverlay !== v) { data.dimOverlay = v; pushData(); } },
    });
    // exe를 다른 폴더로 옮기면 등록 경로가 낡으므로, 켜져 있으면 시작 때 현재 경로로 다시 등록
    if (store.settings().autoStart) autostart.apply(app, true);
    powerSaveBlocker.start('prevent-display-sleep');
    applyHotkeys();
    createWindow();
    sync.start();
    health.start();
    dimmer.start();
    scheduleMidnight();
    // 절전 복귀: 모든 값을 즉시 다시 확인
    powerMonitor.on('resume', () => { sync.refresh(); health.check(); dimmer.tick(); timer.check(); });
  });
  app.on('before-quit', () => { dimmer && dimmer.restoreSync(); });
  app.on('will-quit', () => globalShortcut.unregisterAll());
  app.on('window-all-closed', () => app.quit());
}
// 개정 기록 | 2026-11-11 | 최초 작성 | 설계서 §2 main.js: 창·전원·IPC 배선
// 개정 기록 | 2026-11-11 | v1.2 | autoStart 적용·시작 때 재등록, 실행해 보기(force)·프로그램 찾아보기·서버별 상태·설정 폴더·버전 통로 | docs/v1.2-brief.md §2·§3
