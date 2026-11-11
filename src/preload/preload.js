// 렌더러에 필요한 최소 통로만 노출합니다(네트워크·파일 접근은 전부 메인이 대신함).
const { contextBridge, ipcRenderer } = require('electron');

const invoke = (ch) => (...a) => ipcRenderer.invoke(ch, ...a);
const on = (ch) => (cb) => { ipcRenderer.on(ch, (_e, v) => cb(v)); };

contextBridge.exposeInMainWorld('clockApi', {
  init: invoke('app:init'),
  setSettings: invoke('settings:set'),
  launch: invoke('launch'),
  volume: invoke('system:volume'),
  timerStart: invoke('timer:start'),
  timerPause: invoke('timer:pause'),
  timerResume: invoke('timer:resume'),
  timerCancel: invoke('timer:cancel'),
  pickClient: invoke('google:pickClient'),
  googleConnect: invoke('google:connect'),
  googleDisconnect: invoke('google:disconnect'),
  googleLists: invoke('google:lists'),
  searchPlace: invoke('weather:search'),
  pickProgram: invoke('slot:pickProgram'),
  serverStates: invoke('health:servers'),
  autoStartAvailable: invoke('autostart:available'),
  openFolder: invoke('app:folder'),
  version: invoke('app:version'),
  quit: invoke('app:quit'),
  onData: on('data'),
  onTimer: on('timer'),
  onToast: on('toast'),
  onSettings: on('settings'),
});
// 개정 기록 | 2026-11-11 | 단축키 포커스 전용 | 사용자 결정: onKey·drawer 통로 제거, volume 추가
