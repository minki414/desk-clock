// OS·Electron을 직접 참조하지 않아 모든 동작을 fake로 검증할 수 있습니다.
async function dispatch(entry, deps) {
  try {
    switch (entry.action) {
      case 'return':
        if (!deps.isFocused()) { deps.cancelWait(); deps.bringToFront(); }
        break;
      case 'minimizeOthers': case 'closeOthers': {
        const n = deps.others(entry.action);
        deps.bringToFront();
        deps.toast(entry.action === 'minimizeOthers' ? 'toast.minimized' : 'toast.closed', { n });
        break;
      }
      case 'volumeUp': return await deps.volume(true);
      case 'volumeDown': return await deps.volume(false);
      case 'mute': case 'playPause': case 'nextTrack': case 'prevTrack': return await deps.media(entry.action);
      case 'slot': return await deps.runSlot(entry.arg, { allowWhenDisabled: true });
      case 'timer': deps.bringToFront(); deps.command({ type: 'timerOpen' }); break;
      case 'night': deps.command({ type: 'nightToggle' }); break;
      case 'fullscreen': return await deps.fullscreen();
      case 'screenOff': return await deps.screenOff();
    }
  } catch { deps.toast('toast.hotkeyFail'); }
}
function createDispatcher({ now = Date.now } = {}) {
  const lastAt = new Map();
  return (entry, deps) => {
    if (!['volumeUp', 'volumeDown'].includes(entry.action)) {
      const time = now(), previous = lastAt.get(entry.id);
      if (previous !== undefined && time - previous < 400) return;
      lastAt.set(entry.id, time);
    }
    return dispatch(entry, deps);
  };
}
module.exports = { dispatch, createDispatcher };
// 개정 기록 | 2026-11-16 | 사용자 단축키 기능 분기와 예외 격리 | 사용자 요청
// 개정 기록 | 2026-11-16 | 항목별 400ms 반복 억제와 전역 슬롯 권한 분리 | 사용자 요청
