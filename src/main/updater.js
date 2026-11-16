// Manual updates only; the transport is injected for isolated tests.
function createUpdater({ autoUpdater, isSupported, onState = () => {} }) {
  let state = { phase: isSupported() ? 'idle' : 'unsupported' };
  Object.assign(autoUpdater, { autoDownload: false, autoInstallOnAppQuit: false, allowPrerelease: false, allowDowngrade: false, logger: null });
  const emit = (next) => { state = next; onState({ ...state }); return { ...state }; };
  const supported = () => isSupported();
  const fail = () => { if (supported() && ['checking', 'downloading'].includes(state.phase)) emit({ phase: 'error', message: 'ui.update.error' }); };
  autoUpdater.on('update-available', (info) => {
    if (!supported() || state.phase !== 'checking') return;
    const raw = Array.isArray(info.releaseNotes) ? info.releaseNotes.map((n) => n.note || '').join('\n') : String(info.releaseNotes || '');
    const notes = raw.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]*>/g, '').replace(/&(?:lt|gt|amp|quot|#39|nbsp);/g, (x) => ({ '&lt;': '<', '&gt;': '>', '&amp;': '&', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' }[x])).slice(0, 600);
    emit({ phase: 'available', version: String(info.version || ''), notes });
  });
  autoUpdater.on('update-not-available', () => { if (supported() && state.phase === 'checking') emit({ phase: 'latest' }); });
  autoUpdater.on('download-progress', ({ percent }) => {
    if (!supported() || state.phase !== 'downloading' || !Number.isFinite(percent)) return;
    percent = Math.max(0, Math.min(100, Math.round(percent)));
    if (percent !== state.percent) emit({ phase: 'downloading', percent });
  });
  autoUpdater.on('update-downloaded', () => { if (supported() && state.phase === 'downloading') emit({ phase: 'ready' }); });
  autoUpdater.on('error', fail);
  async function run(from, next, operation) {
    if (!supported()) return { phase: 'unsupported' };
    if (!from.includes(state.phase)) return { ...state };
    emit(next);
    try { await operation(); } catch { fail(); }
    return { ...state };
  }
  return {
    state: () => supported() ? { ...state } : { phase: 'unsupported' },
    check: () => run(['idle', 'latest', 'error'], { phase: 'checking' }, () => autoUpdater.checkForUpdates()),
    download: () => run(['available'], { phase: 'downloading', percent: 0 }, () => autoUpdater.downloadUpdate()),
    install() {
      if (!supported()) return { phase: 'unsupported' };
      if (state.phase !== 'ready') return { ...state };
      emit({ phase: 'installing' });
      autoUpdater.quitAndInstall(true, true);
      return { ...state };
    },
  };
}
module.exports = { createUpdater };
// 개정 기록 | 2026-11-17 | 수동 업데이트 상태 관리 | 사용자 요청
