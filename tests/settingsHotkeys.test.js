const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

// Minimal DOM fake: only the settings drawer's DOM operations, no native keys or app.
class Node {
  constructor(tag,doc){this.tagName=tag;this.doc=doc;this.children=[];this.attrs={};this.events={};this.parent=null;this._text='';this.className='';this.value='';this.hidden=false;this.disabled=false;this.scrollTop=0;}
  get textContent(){return this._text+this.children.map(c=>c.textContent||'').join('');}
  set textContent(v){this._text=String(v);this.children=[];}
  get classList(){return {add:(c)=>{if(!this.className.split(' ').includes(c))this.className+=' '+c;},remove:c=>{this.className=this.className.split(' ').filter(x=>x!==c).join(' ');},toggle:(c,on)=>{if(on)this.classList.add(c);else this.classList.remove(c);}};}
  get dataset(){return Object.fromEntries(Object.entries(this.attrs).filter(([k])=>k.startsWith('data-')).map(([k,v])=>[k.slice(5),v]));}
  get isConnected(){return this===this.doc||!!this.parent?.isConnected;}
  get firstChild(){return this.children[0];}
  set innerHTML(v){this.append(new Node('svg',this.doc));}
  append(...kids){for(let c of kids){if(typeof c!=='object')c={textContent:String(c)};c.parent=this;this.children.push(c);}}
  replaceChildren(...kids){this.children.forEach(c=>c.parent=null);this.children=[];this._text='';this.append(...kids);}
  setAttribute(k,v){this.attrs[k]=String(v);if(k==='class')this.className=String(v);}
  getAttribute(k){return this.attrs[k]??null;}
  addEventListener(k,fn){(this.events[k]??=new Set()).add(fn);}
  removeEventListener(k,fn){this.events[k]?.delete(fn);}
  dispatchEvent(e){e.target??=this;for(const fn of [...this.events[e.type]||[]])fn(e);}
  click(){if(!this.disabled)this.dispatchEvent({type:'click'});}
  focus(){this.doc.activeElement=this;}
  blur(){this.dispatchEvent({type:'blur'});this.doc.activeElement=null;}
  contains(node){return node===this||this.children.some(c=>c.contains?.(node));}
  matches(s){const attrs=s.match(/\[[^\]]+\]/g)||[];if(attrs.length)return attrs.every(a=>{const m=/\[([^=\]]+)(?:=([^\]]+))?\]/.exec(a);return this.attrs[m[1]]!==undefined&&(m[2]===undefined||this.attrs[m[1]]===m[2]);})&&(!s.replace(/\[[^\]]+\]/g,'')||this.matches(s.replace(/\[[^\]]+\]/g,'')));if(s.startsWith('.'))return this.className.split(' ').includes(s.slice(1));if(s.startsWith('#'))return this.attrs.id===s.slice(1);return this.tagName===s;}
  querySelectorAll(s){const parts=s.split(' '),out=[];const visit=n=>{for(const c of n.children||[]){if(c.matches?.(parts.at(-1))){let p=c.parent,i=parts.length-2;while(i>=0&&p){if(p.matches(parts[i]))i--;p=p.parent;}if(i<0)out.push(c);}visit(c);}};visit(this);return out;}
  querySelector(s){return this.querySelectorAll(s)[0]||null;}
  closest(s){return this.matches(s)?this:this.parent?.closest(s)||null;}
}
const flush=()=>new Promise(r=>setImmediate(r));
async function fixture(){
  const doc=new Node('document');doc.doc=doc;doc.createElement=tag=>new Node(tag,doc);doc.activeElement=null;
  const root=new Node('aside',doc),scrim=new Node('div',doc);doc.append(root,scrim);
  const {defaults}=require('../src/main/store');let S=defaults();S.slots=[];S.customHotkeys=[{id:'h1',action:'return',arg:null,combo:'Ctrl+H'},{id:'h2',action:'night',arg:null,combo:'F24'}];
  let taken=false;const {createHotkeys}=require('../src/main/hotkey');
  const h=createHotkeys({shortcut:{register:()=>!taken,unregister(){}},onPress(){}});h.apply(S.customHotkeys);
  const api={hotkeyStates:async()=>h.states(),hotkeySuspend:async on=>{h.suspend(on);return h.states();},setSettings:async p=>{S={...S,...p};if(p.customHotkeys)h.apply(S.customHotkeys);return S;},autoStartAvailable:async()=>false,version:async()=> 'test'};
  const window={ClockI18n:require('../src/renderer/i18n'),ClockKeyCombo:require('../src/renderer/keycombo'),ClockModel:{effectiveMode:()=> 'light'}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/renderer/settings.js'),'utf8'),{window,document:doc,Date,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){}});
  const drawer=window.ClockSettings.create({api,root,scrim,onToggle(){}});drawer.update(S);drawer.open();await flush();root.querySelector('#tab-keys').click();await flush();
  return {root,doc,drawer,h,setTaken:v=>taken=v,async record(){root.querySelector('.custom-rec button').click();await flush();},async key(code,key,extra={}){doc.dispatchEvent({type:'keydown',code,key,preventDefault(){},stopImmediatePropagation(){},...extra});await flush();}};
}
for(const route of ['finish','cancel','close','tab','delete','action'])test('resume refreshes all hotkey status rows: '+route,async()=>{
  const b=await fixture();await b.record();b.setTaken(true);
  if(route==='finish')await b.key('KeyJ','j',{ctrlKey:true});
  if(route==='cancel')await b.key('Escape','Escape');
  const oldMessages=b.root.querySelectorAll('.custom-state');
  const assertTaken=nodes=>{for(const node of nodes)assert.equal(node.textContent,'다른 프로그램이 이미 쓰는 조합입니다');};
  if(route==='close'){b.drawer.close();await flush();assertTaken(oldMessages);b.drawer.open();}
  if(route==='tab'){b.root.querySelector('#tab-screen').click();await flush();assertTaken(oldMessages);b.root.querySelector('#tab-keys').click();}
  if(route==='delete')b.root.querySelector('.custom-row').children.at(-1).click();
  if(route==='action'){const select=b.root.querySelector('.custom-action');select.value='night';select.dispatchEvent({type:'change'});}
  await flush();
  assertTaken(b.root.querySelectorAll('.custom-state'));
  assert.equal(b.h.states().h2,'taken');
});
// 개정 기록 | 2026-11-16 | 녹화 복구의 모든 상태 갱신 경로를 DOM·shortcut fake로 검증 | 사용자 요청
