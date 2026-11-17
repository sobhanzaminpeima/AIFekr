const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'driver.js'),'utf8');

function harness(reference=true){
  let listener, opened=false, inputPolls=0, clicks=0;
  const images=[];
  const element=label=>({
    getClientRects:()=>[{}],
    getAttribute:key=>key==='aria-label'?label:key==='aria-checked'?'true':null,
    click(){}, focus(){}, dispatchEvent(){}
  });
  const settings=Object.assign(element('Settings trigger'),{innerText:'Nano Banana 2 Lite'});
  const add=Object.assign(element('Add ingredients to the prompt box'),{click(){opened=true;}});
  const start=Object.assign(element('Start generation'),{click(){clicks++;}});
  const composer={contains:node=>node===add,querySelectorAll:()=>images};
  const box=Object.assign(element('What do you want to create?'),{textContent:'',parentElement:composer});
  const input={accept:'image/*',dispatchEvent(){
    images.push(Object.assign(element('preview'),{complete:true,naturalWidth:128,src:'blob:character'}));
  }};
  const document={querySelectorAll(selector){
    if(selector==='input[type="file"]')return opened && ++inputPolls>1?[input]:[];
    if(selector==='button')return [settings,add,start];
    if(selector==='[role="radio"]')return ['Image','1:1','x1'].map(element);
    if(selector==='a')return [element('0 credits')];
    if(selector==='img')return images;
    return [box];
  }};
  vm.runInNewContext(source,{document,URL,File,Event,InputEvent:Event,
    DataTransfer:class {files=[];items={add:file=>this.files.push(file)};},
    setTimeout:callback=>queueMicrotask(callback),
    chrome:{runtime:{onMessage:{addListener:fn=>listener=fn}}}
  });
  const task={id:'scene',model:'flow-image',ratio:'1:1',prompt:'character',reference};
  const send=action=>new Promise(resolve=>listener({channel:'AIFEKR_FLOW',action,task,
    reference:{mime:'image/png',bytes:[1,2,3]}},null,resolve));
  return {send,images,input,clicks:()=>clicks};
}
test('waits for the file picker and submits with the uploaded reference',async()=>{
  const h=harness();
  assert.equal((await h.send('prepare')).ok,true);
  assert.deepEqual([...new Uint8Array(await h.input.files[0].arrayBuffer())],[1,2,3]);
  assert.equal((await h.send('generate')).submitted,true);
  assert.equal(h.clicks(),1);
});
test('refuses submission after the reference preview changes',async()=>{
  const h=harness();
  assert.equal((await h.send('prepare')).ok,true);
  h.images[0].src='blob:different';
  assert.equal((await h.send('generate')).code,'REFERENCE_REQUIRED');
  assert.equal(h.clicks(),0);
});
test('rejects a leftover character on a scene without a reference', async()=>{
  const h=harness(false);
  const leftover={getClientRects:()=>[{}]};
  h.images.push(leftover);
  assert.equal((await h.send('prepare')).code,'REFERENCE_REQUIRED');
  h.images.pop();
  assert.equal((await h.send('prepare')).ok,true);
  h.images.push(leftover);
  assert.equal((await h.send('generate')).code,'REFERENCE_REQUIRED');
  assert.equal(h.clicks(),0);
});
