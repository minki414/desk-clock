const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createUpdater } = require('../src/main/updater');
function fixture(supported = true) {
  const a = new EventEmitter(), calls = [], states = [];
  a.checkForUpdates = async () => calls.push('check');
  a.downloadUpdate = async () => calls.push('download');
  a.quitAndInstall = (...args) => calls.push(args);
  const u = createUpdater({ autoUpdater: a, isSupported: () => supported, onState: s => states.push(s) });
  return { a, u, calls, states };
}
test('manual updater follows transitions and ignores duplicate and invalid actions', async () => {
  const { a, u, calls, states } = fixture();
  assert.equal(a.autoDownload, false); assert.equal(a.autoInstallOnAppQuit, false);
  assert.equal(a.allowPrerelease, false); assert.equal(a.allowDowngrade, false);
  await u.download(); u.install(); assert.deepEqual(calls, []);
  await u.check(); await u.check(); assert.deepEqual(calls, ['check']);
  a.emit('update-not-available'); assert.equal(u.state().phase, 'latest');
  await u.check(); a.emit('update-available', { version: '1.8.1', releaseNotes: '<b>'+ 'x'.repeat(700) + '</b>' });
  assert.equal(u.state().notes.length, 600); assert.ok(!u.state().notes.includes('<'));
  await u.check(); assert.equal(u.state().phase, 'available');
  await u.download(); await u.download();
  a.emit('download-progress', { percent: 37.1 }); a.emit('download-progress', { percent: 37.2 });
  assert.equal(states.filter(s => s.percent === 37).length, 1);
  a.emit('update-downloaded'); assert.equal(u.state().phase, 'ready');
  u.install(); u.install(); assert.deepEqual(calls.at(-1), [true, true]);
  assert.equal(u.state().phase, 'installing');
});
test('unsupported updater does no transport work even on events', async () => {
  const { a, u, calls, states } = fixture(false);
  for (const result of [await u.check(), await u.download(), u.install(), u.state()]) assert.deepEqual(result, { phase: 'unsupported' });
  a.emit('update-available', { version: '1.8.1' }); a.emit('error', new Error('secret'));
  assert.deepEqual(calls, []); assert.deepEqual(states, []);
});
test('updater errors redact original text and allow retry', async () => {
  const { a, u } = fixture(); await u.check(); a.emit('error', new Error('private-token-path'));
  assert.deepEqual(u.state(), { phase: 'error', message: 'ui.update.error' });
  await u.check(); a.emit('update-available', { version: '1.8.1', releaseNotes: [{ note: '<script>secret</script><p>hello</p>' }] });
  assert.equal(u.state().notes, 'hello');
  a.downloadUpdate = async () => { throw new Error('secret'); }; await u.download();
  assert.equal(u.state().phase, 'error');
});
// 개정 기록 | 2026-11-17 | 가짜 업데이터 상태 및 오류 시험 | 사용자 요청
