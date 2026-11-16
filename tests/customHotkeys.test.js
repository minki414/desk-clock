const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createStore } = require('../src/main/store');
test('v4 migration: value, empty, fresh; normalized rows survive reopening', () => {
  for (const old of [undefined, 'Alt+H', '']) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clock-store-'));
    try {
      if (old !== undefined) fs.writeFileSync(path.join(dir,'settings.json'), JSON.stringify({settingsVersion:3,returnHotkey:old}));
      const st = createStore(dir);
      assert.deepEqual(st.settings().customHotkeys, old === '' ? [] : [{id:'h1',action:'return',arg:null,combo:old || 'Ctrl+H'}]);
      assert.equal(st.settings().returnHotkey, undefined);
      assert.equal(st.settings().settingsVersion,4);
      const rows = st.patch({customHotkeys:[{id:'h1',action:'slot',arg:20,combo:'bad'},{id:'h1',action:'return',arg:4,combo:'h+ctrl'},{action:'unknown'}]}).customHotkeys;
      assert.deepEqual(rows,[{id:'h1',action:'slot',arg:1,combo:''},{id:'h2',action:'return',arg:null,combo:'Ctrl+H'}]);
      assert.deepEqual(createStore(dir).settings().customHotkeys,rows);
      assert.equal(st.patch({customHotkeys:Array.from({length:15},()=>({action:'return'}))}).customHotkeys.length,12);
    } finally { fs.rmSync(dir,{recursive:true,force:true}); }
  }
});
test('commands share keyboard transitions and ignore an open settings drawer', () => {
  const K=require('../src/renderer/keys');
  for (const [type,code] of [['timerOpen','KeyT'],['nightToggle','KeyN']]) {
    const s=K.initial();assert.deepEqual(K.command(s,type),K.route(s,{code}));
    const blocked={...s,settingsOpen:true};assert.deepEqual(K.command(blocked,type),{state:blocked,actions:[]});
  }
  for (const phase of ['input','running','paused','ringing']) {
    const s={...K.initial(),phase};assert.equal(K.command(s,'timerOpen').state,s);
  }
});
test('custom action labels and messages exist in all three languages', () => {
  const I=require('../src/renderer/i18n');
  for(const lang of ['ko','zh','en']) for(const key of ['customHotkeys','customNote','customAdd','customDelete','customDup','customTaken','customInvalid','customCloseWarning',...['return','minimizeOthers','closeOthers','volumeUp','volumeDown','mute','playPause','nextTrack','prevTrack','slot','timer','night','fullscreen','screenOff'].map(a=>'action.'+a)]) {
    assert.ok(I.dict[lang]['ui.'+key],lang+': '+key);
  }
});
// 개정 기록 | 2026-11-16 | 사용자 단축키 정규화와 v4 이관 시험 | 사용자 요청

// 개정 기록 | 2026-11-16 | v1.7 사용자 단축키 목록 검증 | 사용자 요청
