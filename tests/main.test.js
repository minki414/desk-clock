const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { defaults, normPeople } = require('../src/main/store');

// Electron·OS·OAuth는 가짜 주입. 실제 main.js의 IPC와 생명주기를 그대로 실행한다.
async function boot() {
  const handlers = {}, sent = [], calls = [], registered = new Map();
  let settings = defaults(), connected = false, syncOptions, googleOptions, win;
  settings.people[0].google = { connected: false, expired: true, account: 'old@example.test' };
  settings.people[0].calendar.ids = ['chosen']; settings.people[0].tasks.listId = 'chosen-list';
  const store = { settings: () => settings, patch(p) { settings = { ...settings, ...p }; if (p.people) settings.people = normPeople(p.people, settings.lang); return settings; } };
  const app = new EventEmitter(); Object.assign(app, { requestSingleInstanceLock: () => true, whenReady: async () => {}, getPath: () => '', quit: () => {}, getVersion: () => 'test' });
  class Window extends EventEmitter {
    constructor() { super(); win = this; this.fullscreen = true; this.focused = false; this.webContents = { send: (ch,v) => sent.push([ch,v]), on: () => {}, setWindowOpenHandler: () => {} }; }
    isDestroyed() { return false; } isFocused() { return this.focused; } isMinimized() { return false; }
    setAlwaysOnTop(v) { calls.push(['top',v]); } show() {} focus() { calls.push(['focus']); }
    setMenuBarVisibility() {} loadFile() {} isFullScreen() { return this.fullscreen; }
    setFullScreen(on) { this.fullscreen=on;this.emit(on?'enter-full-screen':'leave-full-screen'); }
    maximize() { calls.push(['maximize']); }
  }
  const google = { hasClient: () => true, isConnected: () => connected, migrateLegacy: () => {},
    connect: async (id,opts) => { calls.push(['connect',id,opts.loginHint]); connected=true; },
    lists: async () => ({ calendars: [{ id:'new@example.test',primary:true }], taskLists:[] }),
    disconnect: async () => {connected=false;},
  };
  const shortcut = { register: (a,cb) => { registered.set(a,cb);return true; }, unregister: a => registered.delete(a) };
  const modules = {
    './hotkey': require('../src/main/hotkey'),
    electron: { app, BrowserWindow: Window, Menu: { setApplicationMenu() {} }, ipcMain: { handle: (n,fn) => handlers[n]=fn }, powerSaveBlocker: { start() {} }, powerMonitor:new EventEmitter(), shell:{},dialog:{},safeStorage:{},globalShortcut:shortcut },
    './store': { createStore: () => store }, './timer': { createTimer: () => ({ snapshot: () => ({phase:'idle'}) }) },
    './launcher': {}, './foreground': { createForeground: () => ({ cancelWait: () => calls.push(['cancel']) }) },
    './system': { createHealth: () => ({start(){},check(){}}), createDimmer: () => ({start(){},tick(){},restoreSync(){}}) },
    './weather': {}, './sync': { createSync: opts => {syncOptions=opts;return {start(){},refresh: v=>calls.push(['refresh',v]),clearPerson:()=>{}};} },
    './google': { createGoogle: opts => { googleOptions=opts; return google; } }, './autostart': { apply() {} },
  };
  const main = path.join(__dirname,'../src/main/main.js');
  vm.runInNewContext(fs.readFileSync(main,'utf8'), { require: n => n in modules ? modules[n] : require(n.startsWith('../renderer/') ? path.join(__dirname,'../src/renderer',path.basename(n)) : n), __dirname:path.dirname(main), setTimeout:()=>0, Date, console });
  await Promise.resolve(); await Promise.resolve();
  return { handlers, sent, calls, registered, win, app, store, syncOptions, googleOptions, google };
}

test('복귀 단축키는 포커스 밖에서 대기만 취소하고 창 모드는 보존, 종료 시 자기 등록 해제', async () => {
  const b = await boot(), press = b.registered.get('Control+H');
  b.win.focused=true; press(); assert.equal(b.calls.length,0);
  b.win.focused=false; press(); assert.deepEqual(b.calls[0],['cancel']);assert.ok(b.calls.some(c=>c[0]==='focus'));
  assert.equal(b.win.fullscreen,true);
  b.handlers['settings:set'](null,{hotkeysOn:false});assert.ok(b.registered.has('Control+H'));
  b.handlers['settings:set'](null,{returnHotkey:''});assert.equal(b.registered.size,0);
  b.handlers['settings:set'](null,{returnHotkey:'Alt+H'});b.app.emit('will-quit');assert.equal(b.registered.size,0);
});

test('전체화면 왕복은 maximize와 창 이벤트·초기 상태를 전달하고 설정에 저장하지 않음', async () => {
  const b = await boot();assert.equal(b.handlers['app:init']().fullscreen,true);
  b.handlers['window:toggleFullscreen'](); assert.equal(b.win.fullscreen,false); assert.ok(b.calls.some(c=>c[0]==='maximize'));
  b.handlers['window:toggleFullscreen'](); assert.equal(b.win.fullscreen,true);
  assert.deepEqual(b.sent.filter(([ch])=>ch==='window').map(([,v])=>v.fullscreen),[false,true]);
  assert.equal(b.store.settings().fullscreen,undefined);
});

test('만료 플래그 푸시와 재로그인은 계정 힌트를 전달하며 캘린더·메모 선택 보존, 해제는 계정 초기화', async () => {
  const b = await boot();
  b.store.patch({people:b.store.settings().people.map(p=>({...p,google:{...p.google,expired:false}}))});
  b.syncOptions.onExpired('p1');
  assert.equal(b.store.settings().people[0].google.expired,true);
  assert.equal(b.store.settings().people[0].google.account,'old@example.test');
  assert.equal(b.sent.at(-1)[0],'settings');
  assert.equal((await b.handlers['google:connect'](null,'p1')).ok,true);
  assert.deepEqual(b.calls.find(c=>c[0]==='connect'),['connect','p1','old@example.test']);
  const p=b.store.settings().people[0];assert.deepEqual(p.google,{connected:true,expired:false,account:'new@example.test'});
  assert.deepEqual(p.calendar.ids,['chosen']);assert.equal(p.tasks.listId,'chosen-list');
  assert.ok(b.calls.some(c=>c[0]==='focus'));assert.ok(b.calls.some(c=>c[0]==='refresh'));
  await b.handlers['google:disconnect'](null,'p1');assert.deepEqual(b.store.settings().people[0].google,{connected:false,expired:false,account:''});
});
// 개정 기록 | 2026-11-16 | 격리된 메인 배선 회귀 시험 | 사용자 요청

test('lists expiry pushes settings with feeds off and is idempotent', async () => {
  const b = await boot();
  await b.google.connect('p1', {});
  b.store.patch({people:b.store.settings().people.map(p=>({...p,calendar:{...p.calendar,on:false},tasks:{...p.tasks,on:false},google:{...p.google,connected:true,expired:false}}))});
  b.google.lists = async (id) => {
    await b.google.disconnect(id);
    b.googleOptions.onExpired(id);
    throw Object.assign(new Error('expired'), {code:'expired'});
  };
  assert.equal(await b.handlers['google:lists'](null,'p1'),null);
  assert.deepEqual(b.store.settings().people[0].google,{connected:false,expired:true,account:'old@example.test'});
  assert.equal(b.sent.filter(([ch])=>ch==='settings').length,1);
  b.googleOptions.onExpired('p1'); b.syncOptions.onExpired('p1');
  assert.equal(b.sent.filter(([ch])=>ch==='settings').length,1);
});
// 개정 기록 | 2026-11-16 | 목록 만료·일시 오류·멱등성 회귀 시험 | 사용자 요청

test('connect account lookup preserves expiry reported by the common callback', async () => {
  const b = await boot();
  b.google.lists = async (id) => {
    await b.google.disconnect(id);
    b.googleOptions.onExpired(id);
    throw Object.assign(new Error('expired'), {code:'expired'});
  };
  await b.handlers['google:connect'](null,'p1');
  assert.deepEqual(b.store.settings().people[0].google,{connected:false,expired:true,account:'old@example.test'});
});
