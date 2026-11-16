const test = require('node:test');
const assert = require('node:assert/strict');
const { dispatch } = require('../src/main/hotkeyActions');
const { pickOtherWindows, affectOtherWindows, screenOff, mediaKey } = require('../src/main/system');
test('dispatch limits each entry to 400ms and permits both volume actions to repeat',async()=>{
  const {createDispatcher}=require('../src/main/hotkeyActions');let now=0;
  const send=createDispatcher({now:()=>now}),calls=[],deps={command:c=>calls.push(c.type),volume:up=>calls.push(up),toast:()=>{}};
  const row={id:'h1',action:'night'};
  await send(row,deps);now=399;await send(row,deps);assert.deepEqual(calls,['nightToggle']);
  now=400;await send(row,deps);await send({id:'h2',action:'night'},deps);assert.equal(calls.length,3);
  for(const action of ['volumeUp','volumeDown'])for(let i=0;i<3;i++)await send({id:'volume',action},deps);
  assert.deepEqual(calls.slice(3),[true,true,true,false,false,false]);
});
test('window filters exclude every protected category and optionally minimized', () => {
  const good = {hwnd:1,pid:2,cls:'App',title:'Document',visible:true,owned:false,toolWindow:false,cloaked:false,minimized:false};
  const bad = [{visible:false},{owned:true},{toolWindow:true},{cloaked:true},{title:''},{title:'  '},{pid:1}, ...['Progman','WorkerW','Shell_TrayWnd','Shell_SecondaryTrayWnd','Windows.UI.Core.CoreWindow'].map(cls=>({cls}))];
  const list = [good,...bad.map(x=>({...good,...x})),{...good,hwnd:2,minimized:true}];
  assert.deepEqual(pickOtherWindows(list,1).map(x=>x.hwnd),[1,2]);
  assert.deepEqual(pickOtherWindows(list,1,{excludeMinimized:true}).map(x=>x.hwnd),[1]);
});
test('native actions only post messages and balanced media keys through fakes', () => {
  const calls=[], f={post:(...a)=>{calls.push(a);return 1;}};
  const rows=[{hwnd:123,pid:2,cls:'App',title:'Doc',visible:true}];
  assert.equal(affectOtherWindows('minimizeOthers',1,{list:()=>rows,...f}),1);
  assert.deepEqual(calls.pop(),[123,0x112,0xf020,0]);
  affectOtherWindows('closeOthers',1,{list:()=>rows,...f});assert.deepEqual(calls.pop(),[123,0x10,0,0]);
  screenOff(f); assert.deepEqual(calls.pop(),[0xffff,0x112,0xf170,2]);
  for (const [action,vk] of [['mute',0xad],['playPause',0xb3],['nextTrack',0xb0],['prevTrack',0xb1]]) {
    mediaKey(action,(...a)=>calls.push(a)); assert.deepEqual(calls.splice(0),[[vk,0,0,0],[vk,0,2,0]]);
  }
});
test('all action dispatch and failure isolation with fake dependencies', async () => {
  const calls=[];
  const d={isFocused:()=>false,cancelWait:()=>calls.push(['cancel']),bringToFront:()=>calls.push(['front']),
    others:a=>{calls.push(['others',a]);return 3;},volume:b=>calls.push(['volume',b]),media:a=>calls.push(['media',a]),
    runSlot:(...a)=>calls.push(['slot',...a]),command:c=>calls.push(['command',c]),fullscreen:()=>calls.push(['fullscreen']),screenOff:()=>calls.push(['screenOff']),toast:(...a)=>calls.push(['toast',...a])};
  const expected={return:[['cancel'],['front']],minimizeOthers:[['others','minimizeOthers'],['front'],['toast','toast.minimized',{n:3}]],closeOthers:[['others','closeOthers'],['front'],['toast','toast.closed',{n:3}]],volumeUp:[['volume',true]],volumeDown:[['volume',false]],mute:[['media','mute']],playPause:[['media','playPause']],nextTrack:[['media','nextTrack']],prevTrack:[['media','prevTrack']],slot:[['slot',7,{allowWhenDisabled:true}]],timer:[['front'],['command',{type:'timerOpen'}]],night:[['command',{type:'nightToggle'}]],fullscreen:[['fullscreen']],screenOff:[['screenOff']]};
  for (const [action,want] of Object.entries(expected)) { await dispatch({action,arg:7},d);assert.deepEqual(calls.splice(0),want); }
  await dispatch({action:'return'},{...d,isFocused:()=>true});assert.deepEqual(calls,[]);
  await dispatch({action:'volumeUp'},{...d,volume:()=>{throw Error('fake');}}); assert.deepEqual(calls.splice(0),[['toast','toast.hotkeyFail']]);
  await dispatch({action:'slot'},{...d,runSlot:async()=>{throw Error('fake');}}); assert.deepEqual(calls.splice(0),[['toast','toast.hotkeyFail']]);
  await dispatch({action:'night'},d);assert.deepEqual(calls,[['command',{type:'nightToggle'}]]);
});
test('EnumWindows callback metadata and unregister on success and failure use fake koffi', () => {
  const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
  const calls=[];let callback,fail=false;
  const write=(buf,text)=>{[...text].forEach((c,i)=>buf[i]=c.charCodeAt(0));return text.length;};
  const fns={EnumWindows:()=>{for(const h of [1,2,3])if(!callback(h,0))return 0;return 1;},
    IsWindowVisible:h=>h===3?0:1,GetWindow:()=>0,GetWindowLongPtrW:()=>0,
    GetWindowThreadProcessId:(h,out)=>{out[0]=h===1?17:18;return 1;},
    GetWindowTextW:(h,buf)=>{if(fail)throw Error('fake enum failure');return write(buf,'Document');},
    GetClassNameW:(h,buf)=>write(buf,'App'),IsIconic:()=>0,DwmGetWindowAttribute:(h,a,out,size)=>{assert.equal(a,14);assert.equal(size,4);out[0]=0;return 0;},
    PostMessageW:(...a)=>{calls.push(a);return 1;}};
  const koffi={load:()=>({func:s=>{const name=/ (\w+)\(/.exec(s)[1];assert.ok(fns[name],name);return fns[name];}}),
    proto:s=>{assert.ok(s.includes('__stdcall ClockEnumWindows'));return 'callbackType';},pointer:t=>t,
    register:(cb,t)=>{assert.equal(t,'callbackType');callback=cb;calls.push('register');return 123;},unregister:id=>{assert.equal(id,123);calls.push('unregister');}};
  const mod={exports:{}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/main/system.js'),'utf8'),{module:mod,require:n=>n==='koffi'?koffi:require(n==='../renderer/model.js'?'../src/renderer/model.js':n),Uint16Array,Uint32Array,Set,Number,String,Error});
  assert.equal(mod.exports.affectOtherWindows('closeOthers',17),1);
  assert.deepEqual(calls,['register','unregister',[2,0x10,0,0]]);
  fail=true;calls.length=0;assert.throws(()=>mod.exports.affectOtherWindows('closeOthers',17),/fake enum failure/);
  assert.deepEqual(calls,['register','unregister']);
});
// 개정 기록 | 2026-11-16 | 창 선택·시스템 호출·모든 기능을 fake로 시험 | 사용자 요청

// 개정 기록 | 2026-11-16 | 감사 후속: 상태 복구와 반복 실행 제한 | 사용자 요청
