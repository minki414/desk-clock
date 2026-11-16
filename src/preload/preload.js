// 렌더러에 필요한 최소 통로만 노출합니다(네트워크·파일 접근은 전부 메인이 대신함).
const { contextBridge, ipcRenderer } = require('electron');

const invoke = (ch) => (...a) => ipcRenderer.invoke(ch, ...a);
const on = (ch) => (cb) => { ipcRenderer.on(ch, (_e, v) => cb(v)); };

contextBridge.exposeInMainWorld('clockApi', {
  init: invoke('app:init'),
  setSettings: invoke('settings:set'),
  launch: invoke('launch'),
  toggleFullscreen: invoke('window:toggleFullscreen'),
  onWindow: on('window'),
  onCommand: on('command'),
  hotkeyStates: invoke('hotkey:states'),
  hotkeySuspend: invoke('hotkey:suspend'),
  volume: invoke('system:volume'),
  timerStart: invoke('timer:start'),
  timerPause: invoke('timer:pause'),
  timerResume: invoke('timer:resume'),
  timerCancel: invoke('timer:cancel'),
  pickClient: invoke('google:pickClient'),
  googleConnect: invoke('google:connect'),
  googleDisconnect: invoke('google:disconnect'),
  googleLists: invoke('google:lists'),
  addPerson: invoke('people:add'),
  removePerson: invoke('people:remove'),
  searchPlace: invoke('weather:search'),
  pickProgram: invoke('slot:pickProgram'),
  serverStates: invoke('health:servers'),
  autoStartAvailable: invoke('autostart:available'),
  openFolder: invoke('app:folder'),
  version: invoke('app:version'),
  quit: invoke('app:quit'),
  setForcedNight: invoke('night:force'),
  onData: on('data'),
  onTimer: on('timer'),
  onToast: on('toast'),
  onSettings: on('settings'),
});
// 개정 기록 | 2026-11-11 | 단축키 포커스 전용 | 사용자 결정: onKey·drawer 통로 제거, volume 추가
// 개정 기록 | 2026-11-12 | 사람 여러 명 | 사용자 결정: addPerson·removePerson 통로 추가(연결·해제·목록은 사람 id를 인자로)
// 개정 기록 | 2026-11-15 | setForcedNight 통로 노출 | 사용자 요청

// 개정 기록 | 2026-11-16 | 전역 복귀 단축키 설정·녹화·배선 | 사용자 요청

// 개정 기록 | 2026-11-16 | 전체화면 전환 버튼과 창 상태 전달 | 사용자 요청

// 개정 기록 | 2026-11-16 | customHotkeys 목록 배선 | 사용자 요청
