// Windows 시작 시 자동 실행. portable exe는 실행할 때마다 임시 폴더에 풀려 process.execPath가 임시 경로가 되므로,
// 로그인 항목에는 반드시 원래 exe 경로(PORTABLE_EXECUTABLE_FILE)를 등록합니다.
const fs = require('node:fs');

// 등록할 exe 경로. 설치본(portable)이 아니면 null(개발 실행에서는 토글을 쓸 수 없음)
function pickPath(env = process.env, exists = fs.existsSync) {
  const p = env && env.PORTABLE_EXECUTABLE_FILE;
  return typeof p === 'string' && p.trim() && exists(p) ? p : null;
}

// app: electron app. 켜짐·꺼짐을 시스템에 반영하고 실제 적용 여부를 돌려줌
function apply(app, enabled, env = process.env, exists = fs.existsSync) {
  const exe = pickPath(env, exists);
  if (!exe) return false;
  // name을 따로 주지 않으면 레지스트리 값 이름이 'electron.app.Electron'이라 다른 Electron 앱과 겹칠 수 있음
  app.setLoginItemSettings({ openAtLogin: !!enabled, path: exe, name: 'DeskClock' });
  return true;
}

module.exports = { pickPath, apply };
// 개정 기록 | 2026-11-11 | 최초 작성 | v1.2 §3: PORTABLE_EXECUTABLE_FILE로 로그인 항목 등록
// 개정 기록 | 2026-11-11 | v1.2 | 등록 이름을 DeskClock으로 고정 | 실제 portable 빌드에서 값 이름이 electron.app.Electron으로 잡히는 것을 확인
