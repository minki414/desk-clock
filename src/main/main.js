// 창·전원·IPC 배선만 담당합니다. 실제 일은 각 모듈이 합니다.
const { app, BrowserWindow, Menu, ipcMain, powerSaveBlocker, powerMonitor, shell, dialog, safeStorage } = require('electron');
const path = require('node:path');
const { createStore } = require('./store');
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
// 렌더러로 보내는 최신 자료 묶음(캐시에서 시작해 갱신 때마다 덮어씀)
const data = { weather: null, events: [], tasks: [], sync: {}, health: 'ok', dimOverlay: 0 };

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

// 설정에 연결 상태(클라이언트 JSON 유무·토큰 유무)를 반영하고 화면에 알림
function googleFlags() {
  send('settings', store.patch({ google: { hasClient: google.hasClient(), connected: google.isConnected() } }));
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
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

function wireIpc() {
  ipcMain.handle('app:init', () => ({ settings: store.settings(), data, timer: timer.snapshot() }));
  ipcMain.handle('settings:set', (_e, patch) => {
    const s = store.patch(patch && typeof patch === 'object' ? patch : {});
    if (patch && 'autoStart' in patch) autostart.apply(app, store.settings().autoStart);
    dimmer.tick();
    if (patch && (patch.location || patch.google)) sync.refresh();
    else if (patch && 'lang' in patch) sync.refresh(['weather']);   // 날씨 지명도 새 언어로
    if (patch && patch.servers) health.check();
    send('settings', s);
    return s;
  });
  ipcMain.handle('timer:start', (_e, ms) => { if (Number.isFinite(ms) && ms > 0) timer.start(ms); });
  ipcMain.handle('timer:pause', () => timer.pause());
  ipcMain.handle('timer:resume', () => timer.resume());
  ipcMain.handle('timer:cancel', () => timer.cancel());
  // 볼륨: 시계 창이 포커스일 때 렌더러 키 라우팅이 보냄(전역 단축키 없음)
  ipcMain.handle('system:volume', (_e, up) => system.volume(!!up));
  ipcMain.handle('launch', async (_e, n, force) => {
    const st = store.settings();
    if (!st.hotkeysOn && !force) return;   // force: 설정창의 '실행해 보기'는 단축키가 꺼져 있어도 동작
    foreground.cancelWait();   // 다른 슬롯을 누르면 앞 슬롯의 키 보내기 대기는 취소
    const slot = st.slots.find((x) => x.key === n);
    const r = await launchSlot(slot, st.browser, shell);
    if (r.ok) {
      foreground.watch();
      const combo = parseCombo(slot.sendKeys);
      // 사용자 의도 [2026-11-11 요청]: 실행한 앱이 맨 앞에 뜬 뒤에만 키를 보내고, 시계 창에는 절대 보내지 않는다.
      // 개발 판단: 시계 창 핸들을 제외 대상으로 넘겨 foreground.waitStable이 판정한다. 시간 초과·전송 실패는 같은 문구로 알린다.
      // 사용자 의도 [2026-11-11 요청]: 실행 후 시계로 돌아오기를 켠 슬롯은 키를 보낸 뒤(키가 없으면 앱 창이 안정된 뒤) 1.5초 지나 시계를 앞으로 가져온다.
      // 개발 판단: 전송 실패·시간 초과면 앞으로 가져오지 않는다(실패 알림이 이미 뜸). 키 없는 슬롯은 시간 초과 시 조용히 포기한다. 다른 앱은 최소화·종료하지 않는다.
      const back = shouldReturn(slot);
      const self = String(win.getNativeWindowHandle().readBigUInt64LE());
      if (combo) {
        const fail = () => toast('toast.sendFail', { n });
        foreground.waitStable(self, async () => { if (!(await system.sendCombo(combo))) fail(); else if (back) foreground.returnLater(); }, fail);
      } else if (back) foreground.waitStable(self, foreground.returnLater, () => {});
    } else toast(r.reason === 'empty' ? 'toast.empty' : 'toast.fail', { n });
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
    } catch (e) { return { ok: false, error: t(lang(), e.code === 'tokenUnavailable' ? 'status.token' : 'err.connect') }; }
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
    try { return typeof q === 'string' && q.trim() ? await weather.geocode(q.trim(), 5, lang()) : []; } catch { return null; }   // null = 검색 실패
  });
  ipcMain.handle('slot:pickProgram', async () => {
    const r = await dialog.showOpenDialog(win, { filters: [{ name: t(lang(), 'dialog.programs'), extensions: ['exe', 'lnk', 'bat', 'cmd'] }, { name: t(lang(), 'dialog.all'), extensions: ['*'] }], properties: ['openFile'] });
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
    google = createGoogle({ dir: store.dir, safe, openUrl: (u) => shell.openExternal(u), lang });
    store.patch({ google: { hasClient: google.hasClient(), connected: google.isConnected() } });
    sync = createSync({ store, data, push: pushData, google, onSettings: () => send('settings', store.settings()) });
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
  app.on('before-quit', () => { dimmer && dimmer.restoreSync(); });
  app.on('window-all-closed', () => app.quit());
}
// 개정 기록 | 2026-11-11 | 최초 작성 | 설계서 §2 main.js: 창·전원·IPC 배선
// 개정 기록 | 2026-11-11 | v1.2 | autoStart 적용·시작 때 재등록, 실행해 보기(force)·프로그램 찾아보기·서버별 상태·설정 폴더·버전 통로 | docs/v1.2-brief.md §2·§3
// 개정 기록 | 2026-11-11 | 단축키 포커스 전용 | 사용자 결정: 전역 단축키·key 전달·ui:drawer 제거, 볼륨은 system:volume 통로로
// 개정 기록 | 2026-11-11 | 실행 후 키 보내기 | 사용자 요청: 실행 성공 뒤 sendKeys 가 있으면 맨 앞 창 안정 대기 후 전송, 다른 슬롯 실행 시 대기 취소
// 개정 기록 | 2026-11-11 | 실행 후 시계로 돌아오기 | 사용자 요청: returnToClock 슬롯은 키 전송(또는 앱 창 안정) 뒤 1.5초 후 bringToFront
// 개정 기록 | 2026-11-11 | v1.3 | 토스트·오류·대화상자 문구를 설정 언어로, 언어 변경 시 날씨 갱신, 지오코딩에 언어 전달 | docs/v1.3-i18n-brief.md
