// 화면 언어(한국어·简体中文·English) 사전과 형식화 도우미. 렌더러와 메인 프로세스가 같은 파일을 씁니다.
// 사용자 의도 [docs/v1.3-i18n-brief.md]: 앱이 만든 모든 글자가 설정의 언어를 따르고, 사용자 데이터(일정·메모 제목, 슬롯 이름)는 그대로 둔다.
// 개발 판단: 키는 평평한 점 표기('ui.title')로 두고 세 언어가 같은 키 집합을 갖는지 시험으로 검사한다. 문장은 합니다체, 상태는 명사형(ko).
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ClockI18n = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const ko = {
    'app.title': '식탁 시계',
    // ----- 시계 화면(테마) -----
    'stage.today': '오늘', 'stage.schedule': '일정', 'stage.week': '이번 주', 'stage.memo': '메모', 'stage.timer': '타이머', 'stage.weather': '날씨', 'stage.clock': '시계',
    'stage.noEvents': '일정 없음', 'stage.noMemos': '메모 없음', 'stage.noWeather': '날씨 정보 없음',
    'stage.more': '외 {n}건', 'stage.moreOf': '{first} 외 {n}건',
    'stage.umbrella': '우산', 'stage.umbrellaTip': '우산 챙기기', 'stage.mask': '마스크', 'stage.maskTip': '마스크 챙기기',
    'stage.high': '최고', 'stage.low': '최저', 'stage.now': '진행 중', 'stage.next': '다음', 'stage.allDay': '종일', 'stage.untitled': '(제목 없음)',
    'stage.paused': '일시정지', 'stage.timeUp': '시간 종료',
    // ----- 날씨 상태(WMO 코드 묶음) -----
    'wx.clear': '맑음', 'wx.mostlyClear': '대체로 맑음', 'wx.partlyCloudy': '구름 조금', 'wx.overcast': '흐림', 'wx.fog': '안개',
    'wx.drizzle': '이슬비', 'wx.freezingDrizzle': '어는 이슬비', 'wx.lightRain': '약한 비', 'wx.rain': '비', 'wx.heavyRain': '강한 비', 'wx.freezingRain': '어는 비',
    'wx.lightSnow': '약한 눈', 'wx.snow': '눈', 'wx.heavySnow': '강한 눈', 'wx.snowGrains': '싸락눈',
    'wx.showers': '소나기', 'wx.heavyShowers': '강한 소나기', 'wx.snowShowers': '소낙눈', 'wx.thunder': '뇌우', 'wx.hail': '우박 동반 뇌우',
    'wx.unknown': '정보 없음', 'wx.here': '현재 위치',
    // ----- 동기화 상태 한 줄 -----
    'status.token': '토큰 보관 불가', 'status.needCalendar': '캘린더 연결 필요',
    'status.kind.calendar': '일정', 'status.kind.tasks': '메모', 'status.kind.weather': '날씨',
    'status.failed': '{name} 갱신 실패', 'status.failedAt': '{name} 갱신 실패 · {time} 기준',
    // ----- 토스트·오류·대화상자 -----
    'toast.sendFail': '{n}번 키 보내기 실패', 'toast.empty': '{n}번 미등록', 'toast.fail': '{n}번 실행 실패',
    'err.connect': '연결 실패', 'err.unreadable': '파일을 읽을 수 없음', 'err.notDesktop': '데스크톱 앱용 클라이언트 JSON이 아님',
    'oauth.ok': '연결되었습니다. 이 창을 닫아도 됩니다.', 'oauth.fail': '연결에 실패했습니다. 시계 설정에서 다시 시도해 주십시오.',
    'dialog.programs': '프로그램·바로가기', 'dialog.all': '모든 파일',
    // ----- 테마 이름 -----
    'theme.bauhaus': '바우하우스', 'theme.sector': '섹터 다이얼', 'theme.navy': '네이비 다이얼', 'theme.receiver': '리시버', 'theme.flip': '플립', 'theme.standby': '스탠바이',
    // ----- 설정 서랍 -----
    'ui.title': '설정', 'ui.close': '닫기', 'ui.saved': '저장됨',
    'ui.tab.screen': '화면', 'ui.tab.keys': '단축키', 'ui.tab.links': '연결', 'ui.tab.about': '정보',
    'ui.lang': '언어',
    'ui.theme': '테마', 'ui.mode': '색 모드', 'ui.mode.light': '라이트', 'ui.mode.dark': '다크', 'ui.mode.auto': '자동',
    'ui.night': '야간 시간', 'ui.nightFrom': '시작', 'ui.nightTo': '끝', 'ui.nightNote': '자동 색 모드는 이 시간에 다크로 바뀝니다.',
    'ui.nightDim': '야간 감광', 'ui.nightDimNote': '야간 시간에 화면 밝기를 최소 밝기까지 낮춥니다.', 'ui.minBrightness': '최소 밝기',
    'ui.autoStart': 'Windows 시작 시 자동 실행', 'ui.autoStartNote': '로그인하면 시계가 자동으로 열립니다.', 'ui.autoStartOnly': '설치본에서만 쓸 수 있습니다',
    'ui.hotkeys': '숫자패드 단축키', 'ui.hotkeysNote': '시계 화면이 맨 앞에 있을 때만 0~9·+/−가 동작합니다',
    'ui.browser': '웹 링크 브라우저', 'ui.browser.default': '기본 브라우저',
    'ui.slots': '슬롯 1~9', 'ui.slotName': '이름', 'ui.slotWeb': '웹', 'ui.slotProgram': '프로그램', 'ui.slotWebTarget': '주소(https://…)', 'ui.slotProgramTarget': '프로그램·폴더 경로',
    'ui.slotApp': '주소창 없는 창', 'ui.slotBrowse': '찾아보기', 'ui.slotTest': '실행해 보기',
    'ui.slotNameAria': '{key}번 이름', 'ui.slotTargetAria': '{key}번 주소 또는 경로', 'ui.slotKindAria': '{key}번 종류',
    'ui.sendKeys': '실행 후 보낼 키', 'ui.sendNone': '없음', 'ui.sendRec': '녹화', 'ui.sendWait': '키를 눌러 주십시오', 'ui.sendClear': '지우기', 'ui.sendBad': '지원하지 않는 키',
    'ui.returnToClock': '실행 후 시계로 돌아오기',
    'ui.google': '구글', 'ui.gNoClient': '클라이언트 파일 선택 필요', 'ui.gDisconnected': '연결 전', 'ui.gConnected': '연결됨', 'ui.gPick': '클라이언트 파일 고르기', 'ui.gConnect': '구글 로그인',
    'ui.gDisconnect': '연결 해제', 'ui.gWaiting': '브라우저에서 승인해 주십시오', 'ui.gLists': '목록 불러오기', 'ui.gListFail': '목록 갱신 실패', 'ui.gCalendars': '표시할 캘린더',
    'ui.gTaskList': '메모 목록', 'ui.gDefaultList': '기본 목록',
    'ui.weather': '날씨 위치', 'ui.locAuto': '자동(IP 추정)', 'ui.locManual': '직접 지정', 'ui.locReset': '자동으로 되돌리기', 'ui.locSearch': '지명 검색', 'ui.locGo': '검색', 'ui.locNone': '검색 결과 없음', 'ui.locFail': '검색 실패',
    'ui.servers': '감시할 서버', 'ui.serverName': '이름', 'ui.serverUrl': '주소(http://…)', 'ui.serverAdd': '서버 추가', 'ui.serverDel': '삭제', 'ui.serverNone': '등록한 서버 없음(네트워크만 감시)',
    'ui.serverUp': '정상', 'ui.serverDown': '응답 없음', 'ui.serverWait': '확인 중',
    'ui.version': '버전', 'ui.folder': '설정 폴더', 'ui.folderOpen': '설정 폴더 열기', 'ui.quit': '앱 종료', 'ui.quitSure': '한 번 더 누르면 종료합니다', 'ui.quitNote': '시계를 닫고 앱을 끝냅니다.',
  };

  const zh = {
    'app.title': '餐桌时钟',
    'stage.today': '今天', 'stage.schedule': '日程', 'stage.week': '本周', 'stage.memo': '备忘', 'stage.timer': '计时器', 'stage.weather': '天气', 'stage.clock': '时钟',
    'stage.noEvents': '暂无日程', 'stage.noMemos': '暂无备忘', 'stage.noWeather': '暂无天气信息',
    'stage.more': '另有 {n} 项', 'stage.moreOf': '{first}，另有 {n} 项',
    'stage.umbrella': '雨伞', 'stage.umbrellaTip': '记得带伞', 'stage.mask': '口罩', 'stage.maskTip': '记得戴口罩',
    'stage.high': '最高', 'stage.low': '最低', 'stage.now': '进行中', 'stage.next': '接下来', 'stage.allDay': '全天', 'stage.untitled': '（无标题）',
    'stage.paused': '已暂停', 'stage.timeUp': '时间到',
    'wx.clear': '晴', 'wx.mostlyClear': '大部晴朗', 'wx.partlyCloudy': '少云', 'wx.overcast': '阴', 'wx.fog': '雾',
    'wx.drizzle': '毛毛雨', 'wx.freezingDrizzle': '冻毛毛雨', 'wx.lightRain': '小雨', 'wx.rain': '中雨', 'wx.heavyRain': '大雨', 'wx.freezingRain': '冻雨',
    'wx.lightSnow': '小雪', 'wx.snow': '中雪', 'wx.heavySnow': '大雪', 'wx.snowGrains': '米雪',
    'wx.showers': '阵雨', 'wx.heavyShowers': '强阵雨', 'wx.snowShowers': '阵雪', 'wx.thunder': '雷暴', 'wx.hail': '雷暴伴冰雹',
    'wx.unknown': '暂无数据', 'wx.here': '当前位置',
    'status.token': '无法保存令牌', 'status.needCalendar': '需要连接日历',
    'status.kind.calendar': '日程', 'status.kind.tasks': '备忘', 'status.kind.weather': '天气',
    'status.failed': '{name}更新失败', 'status.failedAt': '{name}更新失败 · 截至 {time}',
    'toast.sendFail': '{n} 号键：按键发送失败', 'toast.empty': '{n} 号键：未设置', 'toast.fail': '{n} 号键：启动失败',
    'err.connect': '连接失败', 'err.unreadable': '无法读取文件', 'err.notDesktop': '不是桌面应用的客户端 JSON',
    'oauth.ok': '已连接，可以关闭此窗口。', 'oauth.fail': '连接失败，请在时钟设置中重试。',
    'dialog.programs': '程序和快捷方式', 'dialog.all': '所有文件',
    'theme.bauhaus': '包豪斯', 'theme.sector': '扇形表盘', 'theme.navy': '海军蓝表盘', 'theme.receiver': '收音机', 'theme.flip': '翻页钟', 'theme.standby': '待机屏',
    'ui.title': '设置', 'ui.close': '关闭', 'ui.saved': '已保存',
    'ui.tab.screen': '显示', 'ui.tab.keys': '快捷键', 'ui.tab.links': '连接', 'ui.tab.about': '关于',
    'ui.lang': '语言',
    'ui.theme': '主题', 'ui.mode': '颜色模式', 'ui.mode.light': '浅色', 'ui.mode.dark': '深色', 'ui.mode.auto': '自动',
    'ui.night': '夜间时段', 'ui.nightFrom': '开始', 'ui.nightTo': '结束', 'ui.nightNote': '自动模式会在此时段切换为深色。',
    'ui.nightDim': '夜间调暗', 'ui.nightDimNote': '夜间时段内，将屏幕亮度降到最低亮度。', 'ui.minBrightness': '最低亮度',
    'ui.autoStart': '开机自动运行', 'ui.autoStartNote': '登录 Windows 后，时钟会自动打开。', 'ui.autoStartOnly': '仅安装版可用',
    'ui.hotkeys': '数字小键盘快捷键', 'ui.hotkeysNote': '仅当时钟窗口在最前面时，0~9 和 +/− 才有效',
    'ui.browser': '打开网页的浏览器', 'ui.browser.default': '默认浏览器',
    'ui.slots': '快捷槽 1~9', 'ui.slotName': '名称', 'ui.slotWeb': '网页', 'ui.slotProgram': '程序', 'ui.slotWebTarget': '网址（https://…）', 'ui.slotProgramTarget': '程序或文件夹路径',
    'ui.slotApp': '无地址栏窗口', 'ui.slotBrowse': '浏览', 'ui.slotTest': '试运行',
    'ui.slotNameAria': '{key} 号名称', 'ui.slotTargetAria': '{key} 号网址或路径', 'ui.slotKindAria': '{key} 号类型',
    'ui.sendKeys': '启动后发送的按键', 'ui.sendNone': '无', 'ui.sendRec': '录制', 'ui.sendWait': '请按下按键', 'ui.sendClear': '清除', 'ui.sendBad': '不支持的按键',
    'ui.returnToClock': '启动后返回时钟',
    'ui.google': 'Google', 'ui.gNoClient': '需要选择客户端文件', 'ui.gDisconnected': '未连接', 'ui.gConnected': '已连接', 'ui.gPick': '选择客户端文件', 'ui.gConnect': '登录 Google',
    'ui.gDisconnect': '断开连接', 'ui.gWaiting': '请在浏览器中授权', 'ui.gLists': '加载列表', 'ui.gListFail': '列表更新失败', 'ui.gCalendars': '要显示的日历',
    'ui.gTaskList': '备忘列表', 'ui.gDefaultList': '默认列表',
    'ui.weather': '天气位置', 'ui.locAuto': '自动（根据 IP 推测）', 'ui.locManual': '手动指定', 'ui.locReset': '恢复自动', 'ui.locSearch': '搜索地名', 'ui.locGo': '搜索', 'ui.locNone': '没有搜索结果', 'ui.locFail': '搜索失败',
    'ui.servers': '要监控的服务器', 'ui.serverName': '名称', 'ui.serverUrl': '地址（http://…）', 'ui.serverAdd': '添加服务器', 'ui.serverDel': '删除', 'ui.serverNone': '尚未添加服务器（仅监控网络）',
    'ui.serverUp': '正常', 'ui.serverDown': '无响应', 'ui.serverWait': '检测中',
    'ui.version': '版本', 'ui.folder': '设置文件夹', 'ui.folderOpen': '打开设置文件夹', 'ui.quit': '退出应用', 'ui.quitSure': '再点一次即退出', 'ui.quitNote': '关闭时钟并退出应用。',
  };

  const en = {
    'app.title': 'Table clock',
    'stage.today': 'Today', 'stage.schedule': 'Schedule', 'stage.week': 'This week', 'stage.memo': 'Memos', 'stage.timer': 'Timer', 'stage.weather': 'Weather', 'stage.clock': 'Clock',
    'stage.noEvents': 'No events', 'stage.noMemos': 'No memos', 'stage.noWeather': 'No weather info',
    'stage.more': '+{n} more', 'stage.moreOf': '{first} +{n} more',
    'stage.umbrella': 'Umbrella', 'stage.umbrellaTip': 'Bring an umbrella', 'stage.mask': 'Mask', 'stage.maskTip': 'Wear a mask',
    'stage.high': 'High', 'stage.low': 'Low', 'stage.now': 'Now', 'stage.next': 'Next', 'stage.allDay': 'All day', 'stage.untitled': '(Untitled)',
    'stage.paused': 'Paused', 'stage.timeUp': 'Time’s up',
    'wx.clear': 'Clear', 'wx.mostlyClear': 'Mostly clear', 'wx.partlyCloudy': 'Partly cloudy', 'wx.overcast': 'Overcast', 'wx.fog': 'Fog',
    'wx.drizzle': 'Drizzle', 'wx.freezingDrizzle': 'Freezing drizzle', 'wx.lightRain': 'Light rain', 'wx.rain': 'Rain', 'wx.heavyRain': 'Heavy rain', 'wx.freezingRain': 'Freezing rain',
    'wx.lightSnow': 'Light snow', 'wx.snow': 'Snow', 'wx.heavySnow': 'Heavy snow', 'wx.snowGrains': 'Snow grains',
    'wx.showers': 'Showers', 'wx.heavyShowers': 'Heavy showers', 'wx.snowShowers': 'Snow showers', 'wx.thunder': 'Thunderstorm', 'wx.hail': 'Thunderstorm, hail',
    'wx.unknown': 'No data', 'wx.here': 'Current location',
    'status.token': 'Token storage unavailable', 'status.needCalendar': 'Calendar not connected',
    'status.kind.calendar': 'Events', 'status.kind.tasks': 'Memos', 'status.kind.weather': 'Weather',
    'status.failed': '{name} update failed', 'status.failedAt': '{name} update failed · {time}',
    'toast.sendFail': 'Slot {n}: couldn’t send keys', 'toast.empty': 'Slot {n}: not set', 'toast.fail': 'Slot {n}: couldn’t launch',
    'err.connect': 'Connection failed', 'err.unreadable': 'Can’t read the file', 'err.notDesktop': 'Not a desktop-app client JSON',
    'oauth.ok': 'Connected. You can close this window.', 'oauth.fail': 'Connection failed. Try again from the clock settings.',
    'dialog.programs': 'Programs and shortcuts', 'dialog.all': 'All files',
    'theme.bauhaus': 'Bauhaus', 'theme.sector': 'Sector dial', 'theme.navy': 'Navy dial', 'theme.receiver': 'Receiver', 'theme.flip': 'Flip', 'theme.standby': 'Standby',
    'ui.title': 'Settings', 'ui.close': 'Close', 'ui.saved': 'Saved',
    'ui.tab.screen': 'Display', 'ui.tab.keys': 'Shortcuts', 'ui.tab.links': 'Connections', 'ui.tab.about': 'About',
    'ui.lang': 'Language',
    'ui.theme': 'Theme', 'ui.mode': 'Color mode', 'ui.mode.light': 'Light', 'ui.mode.dark': 'Dark', 'ui.mode.auto': 'Auto',
    'ui.night': 'Night hours', 'ui.nightFrom': 'From', 'ui.nightTo': 'To', 'ui.nightNote': 'Auto mode switches to dark during these hours.',
    'ui.nightDim': 'Night dimming', 'ui.nightDimNote': 'Lowers the screen to the minimum brightness during night hours.', 'ui.minBrightness': 'Minimum brightness',
    'ui.autoStart': 'Launch at Windows startup', 'ui.autoStartNote': 'The clock opens automatically when you sign in.', 'ui.autoStartOnly': 'Available in the installed app only',
    'ui.hotkeys': 'Numpad shortcuts', 'ui.hotkeysNote': '0–9 and +/− work only while the clock is in front',
    'ui.browser': 'Browser for web links', 'ui.browser.default': 'Default browser',
    'ui.slots': 'Slots 1–9', 'ui.slotName': 'Name', 'ui.slotWeb': 'Web', 'ui.slotProgram': 'App', 'ui.slotWebTarget': 'Address (https://…)', 'ui.slotProgramTarget': 'App or folder path',
    'ui.slotApp': 'Window without address bar', 'ui.slotBrowse': 'Browse', 'ui.slotTest': 'Test run',
    'ui.slotNameAria': 'Slot {key} name', 'ui.slotTargetAria': 'Slot {key} address or path', 'ui.slotKindAria': 'Slot {key} type',
    'ui.sendKeys': 'Key to send after launch', 'ui.sendNone': 'None', 'ui.sendRec': 'Record', 'ui.sendWait': 'Press a key', 'ui.sendClear': 'Clear', 'ui.sendBad': 'Unsupported key',
    'ui.returnToClock': 'Return to the clock after launch',
    'ui.google': 'Google', 'ui.gNoClient': 'Client file required', 'ui.gDisconnected': 'Not connected', 'ui.gConnected': 'Connected', 'ui.gPick': 'Choose client file', 'ui.gConnect': 'Sign in with Google',
    'ui.gDisconnect': 'Disconnect', 'ui.gWaiting': 'Approve access in your browser', 'ui.gLists': 'Load lists', 'ui.gListFail': 'Couldn’t load lists', 'ui.gCalendars': 'Calendars to show',
    'ui.gTaskList': 'Memo list', 'ui.gDefaultList': 'Default list',
    'ui.weather': 'Weather location', 'ui.locAuto': 'Automatic (from IP)', 'ui.locManual': 'Manual', 'ui.locReset': 'Back to automatic', 'ui.locSearch': 'Search for a place', 'ui.locGo': 'Search', 'ui.locNone': 'No results', 'ui.locFail': 'Search failed',
    'ui.servers': 'Servers to monitor', 'ui.serverName': 'Name', 'ui.serverUrl': 'Address (http://…)', 'ui.serverAdd': 'Add server', 'ui.serverDel': 'Delete', 'ui.serverNone': 'No servers added (network only)',
    'ui.serverUp': 'Online', 'ui.serverDown': 'No response', 'ui.serverWait': 'Checking',
    'ui.version': 'Version', 'ui.folder': 'Settings folder', 'ui.folderOpen': 'Open settings folder', 'ui.quit': 'Quit app', 'ui.quitSure': 'Press again to quit', 'ui.quitNote': 'Closes the clock and quits the app.',
  };

  const dict = { ko, zh, en };
  // 언어 선택 버튼은 어느 언어 화면에서도 자기 언어로 보임
  const langs = [['ko', '한국어'], ['zh', '中文'], ['en', 'English']];
  const norm = (lang) => (dict[lang] ? lang : 'ko');
  const htmlLang = (lang) => ({ ko: 'ko', zh: 'zh-CN', en: 'en' }[norm(lang)]);

  function t(lang, key, vars) {
    const s = dict[norm(lang)][key] ?? ko[key] ?? key;
    return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : s;
  }

  // ----- 날짜·요일: Intl로 요일·영어 달 이름을 얻고, 시안의 모양(공백·구두점)은 언어별로 직접 맞춤 -----
  const LOCALE = { ko: 'ko-KR', zh: 'zh-CN', en: 'en-US' };
  const fmtCache = {};
  function part(lang, d, opt) {
    const key = lang + JSON.stringify(opt);
    const f = fmtCache[key] || (fmtCache[key] = new Intl.DateTimeFormat(LOCALE[lang], opt));
    return f.format(d);
  }
  // kind: long('11월 11일 수요일') | short('11.11 수') | monthDay | month | dow('수요일') | dowShort('수') | num('11.11')
  function fmtDate(lang, date, kind = 'long') {
    lang = norm(lang);
    const m = date.getMonth() + 1, day = date.getDate();
    const wl = part(lang, date, { weekday: 'long' }), ws = part(lang, date, { weekday: 'short' });
    const monthEn = lang === 'en' ? part(lang, date, { month: 'long' }) : '';
    const num = `${m}.${day}`;
    const monthDay = { ko: `${m}월 ${day}일`, zh: `${m}月${day}日`, en: `${monthEn} ${day}` }[lang];
    const month = { ko: `${m}월`, zh: `${m}月`, en: monthEn }[lang];
    switch (kind) {
      case 'long': return lang === 'en' ? `${wl}, ${monthDay}` : `${monthDay} ${wl}`;
      case 'short': return lang === 'en' ? `${ws} ${num}` : `${num} ${ws}`;
      case 'monthDay': return monthDay;
      case 'month': return month;
      case 'dow': return wl;
      case 'dowShort': return ws;
      case 'num': return num;
      default: return monthDay;
    }
  }

  // 1분 35초 / 1分35秒 / 1 min 35 s. 입력은 밀리초 또는 {m, s}. 0인 단위는 생략
  function fmtDuration(lang, v) {
    lang = norm(lang);
    const total = typeof v === 'number' ? Math.round(v / 1000) : (v.m || 0) * 60 + (v.s || 0);
    const m = Math.floor(total / 60), s = total % 60;
    const unit = { ko: [(n) => `${n}분`, (n) => `${n}초`, ' '], zh: [(n) => `${n}分`, (n) => `${n}秒`, ''], en: [(n) => `${n} min`, (n) => `${n} s`, ' '] }[lang];
    return [m ? unit[0](m) : '', s ? unit[1](s) : ''].filter(Boolean).join(unit[2]);
  }

  // WMO 날씨 코드 → 묶음 이름(사전 키와 아이콘이 함께 씀)
  const GROUP = {
    0: 'clear', 1: 'mostlyClear', 2: 'partlyCloudy', 3: 'overcast', 45: 'fog', 48: 'fog', 51: 'drizzle', 53: 'drizzle', 55: 'drizzle', 56: 'freezingDrizzle', 57: 'freezingDrizzle',
    61: 'lightRain', 63: 'rain', 65: 'heavyRain', 66: 'freezingRain', 67: 'freezingRain', 71: 'lightSnow', 73: 'snow', 75: 'heavySnow', 77: 'snowGrains',
    80: 'showers', 81: 'showers', 82: 'heavyShowers', 85: 'snowShowers', 86: 'snowShowers', 95: 'thunder', 96: 'hail', 99: 'hail',
  };
  const ICON = { clear: 'sun', mostlyClear: 'sun', fog: 'fog', drizzle: 'rain', freezingDrizzle: 'rain', lightRain: 'rain', rain: 'rain', heavyRain: 'rain', freezingRain: 'rain',
    showers: 'rain', heavyShowers: 'rain', lightSnow: 'snow', snow: 'snow', heavySnow: 'snow', snowGrains: 'snow', snowShowers: 'snow' };
  const weatherLabel = (lang, code) => t(lang, `wx.${GROUP[code] || 'unknown'}`);
  // 테마의 날씨 아이콘 키(언어와 무관). 그 외 흐림·뇌우·모름은 구름
  const weatherIcon = (code) => ICON[GROUP[code]] || 'cloud';

  // 테마에 넘기는 고정 문구 묶음(model.L)
  const STAGE_KEYS = ['today', 'schedule', 'week', 'memo', 'timer', 'weather', 'clock', 'noEvents', 'noMemos', 'noWeather', 'umbrella', 'umbrellaTip', 'mask', 'maskTip', 'high', 'low', 'now', 'next', 'allDay', 'untitled', 'paused', 'timeUp'];
  function stageLabels(lang) {
    const L = {};
    STAGE_KEYS.forEach((k) => { L[k] = t(lang, `stage.${k}`); });
    return L;
  }

  const hhmm = (ms) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  // 동기화 상태(sync.js) → 테마 status 한 줄. 정상·대기 중이면 null
  function statusText(lang, kind, st) {
    if (!st) return null;
    if (st.state === 'tokenUnavailable') return kind === 'calendar' ? t(lang, 'status.token') : null;
    if (st.state === 'needAuth') return kind === 'calendar' ? t(lang, 'status.needCalendar') : null;
    if (st.state === 'failed') {
      const name = t(lang, `status.kind.${kind}`);
      return st.at ? t(lang, 'status.failedAt', { name, time: hhmm(st.at) }) : t(lang, 'status.failed', { name });
    }
    return null;
  }

  return { dict, langs, norm, htmlLang, t, fmtDate, fmtDuration, weatherLabel, weatherIcon, stageLabels, statusText };
});
// 개정 기록 | 2026-11-11 | v1.3 | 최초 작성: 세 언어 사전, 날짜·타이머·날씨 형식화, 상태 문구(labels.js의 한국어 문구를 ko로 이전) | docs/v1.3-i18n-brief.md
