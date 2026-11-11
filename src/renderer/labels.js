// 화면 문구 사전. 문장은 합니다체, 상태는 명사형으로 씁니다.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ClockLabels = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const themes = [
    ['bauhaus', '바우하우스'], ['sector', '섹터 다이얼'], ['navy', '네이비 다이얼'],
    ['receiver', '리시버'], ['flip', '플립'], ['standby', '스탠바이'],
  ];

  // 설정 서랍 문구
  const ui = {
    title: '설정', close: '닫기', saved: '저장됨',
    tabs: [['screen', '화면'], ['keys', '단축키'], ['links', '연결'], ['about', '정보']],
    theme: '테마', mode: '색 모드', modes: [['light', '라이트'], ['dark', '다크'], ['auto', '자동']],
    night: '야간 시간', nightFrom: '시작', nightTo: '끝', nightNote: '자동 색 모드는 이 시간에 다크로 바뀝니다.',
    nightDim: '야간 감광', nightDimNote: '야간 시간에 화면 밝기를 최소 밝기까지 낮춥니다.', minBrightness: '최소 밝기',
    autoStart: 'Windows 시작 시 자동 실행', autoStartNote: '로그인하면 시계가 자동으로 열립니다.', autoStartOnly: '설치본에서만 쓸 수 있습니다',
    hotkeys: '숫자패드 단축키', hotkeysNote: '시계 화면이 맨 앞에 있을 때만 0~9·+/−가 동작합니다',
    browser: '웹 링크 브라우저', browsers: [['brave', 'Brave'], ['chrome', 'Chrome'], ['edge', 'Edge'], ['default', '기본 브라우저']],
    slots: '슬롯 1~9', slotName: '이름', slotWeb: '웹', slotProgram: '프로그램', slotWebTarget: '주소(https://…)', slotProgramTarget: '프로그램·폴더 경로', slotApp: '주소창 없는 창', slotBrowse: '찾아보기', slotTest: '실행해 보기',
    google: '구글', gNoClient: '클라이언트 파일 선택 필요', gDisconnected: '연결 전', gConnected: '연결됨', gPick: '클라이언트 파일 고르기', gConnect: '구글 로그인', gDisconnect: '연결 해제',
    gWaiting: '브라우저에서 승인해 주십시오', gLists: '목록 불러오기', gListFail: '목록 갱신 실패', gCalendars: '표시할 캘린더', gTaskList: '메모 목록', gDefaultList: '기본 목록',
    weather: '날씨 위치', locAuto: '자동(IP 추정)', locManual: '직접 지정', locReset: '자동으로 되돌리기', locSearch: '지명 검색', locGo: '검색', locNone: '검색 결과 없음', locFail: '검색 실패',
    servers: '감시할 서버', serverName: '이름', serverUrl: '주소(http://…)', serverAdd: '서버 추가', serverDel: '삭제', serverNone: '등록한 서버 없음(네트워크만 감시)',
    serverUp: '정상', serverDown: '응답 없음', serverWait: '확인 중',
    version: '버전', folder: '설정 폴더', folderOpen: '설정 폴더 열기', quit: '앱 종료', quitSure: '한 번 더 누르면 종료합니다', quitNote: '시계를 닫고 앱을 끝냅니다.',
  };

  const at = (ms) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const stale = (name, st) => (st.at ? `${name} 갱신 실패 · ${at(st.at)} 기준` : `${name} 갱신 실패`);

  // 동기화 상태(sync.js) → 테마 status 한 줄. 정상·대기 중이면 null
  function statusText(kind, st) {
    if (!st) return null;
    if (st.state === 'tokenUnavailable') return kind === 'calendar' ? '토큰 보관 불가' : null;
    if (st.state === 'needAuth') return kind === 'calendar' ? '캘린더 연결 필요' : null;
    if (st.state === 'failed') return stale({ calendar: '일정', tasks: '메모', weather: '날씨' }[kind], st);
    return null;
  }

  return { themes, ui, statusText, at };
});
// 개정 기록 | 2026-11-11 | 최초 작성 | 상태 문구 사전
// 개정 기록 | 2026-11-11 | v1.2 | 설정창 문구 재편(탭·저장됨·자동 실행·실행해 보기·서버 상태 등) | docs/v1.2-brief.md §2
// 개정 기록 | 2026-11-11 | 단축키 포커스 전용 | 사용자 결정: 단축키 설명 문구 변경
