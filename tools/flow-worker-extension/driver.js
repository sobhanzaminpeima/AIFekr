/* UI-only transport. No Google cookies, tokens, private APIs or CAPTCHA handling. */
(() => {
  let prepared = null;
  const visible = el => !!el && !!el.getClientRects().length;
  const text = el => (el.getAttribute('aria-label') || el.innerText || el.textContent || '').trim();
  const one = (selector, label) => {
    const found = [...document.querySelectorAll(selector)].filter(el => visible(el) && text(el) === label);
    if (found.length !== 1) throw Error('UI_CHANGED');
    return found[0];
  };
  const wait = async (predicate, attempts = 30) => {
    for(let i=0;i<attempts;i++){const result=predicate();if(result)return result;await new Promise(r=>setTimeout(r,100));}
    throw Error('UI_CHANGED');
  };
  const imageUrls = () => [...new Set([...document.querySelectorAll('img')].map(el=>el.currentSrc || el.src).filter(url=>{
    try{const u=new URL(url);return u.protocol==='https:' && u.hostname==='flow-content.google' && u.pathname.startsWith('/image/');}catch{return false;}
  }))];
  const selected = el => el.getAttribute('aria-checked') === 'true' || el.getAttribute('aria-pressed') === 'true';
  // Flow may renew a signed URL without changing the underlying image.
  const imageKey = url => {
    try { return new URL(url).pathname; } catch { return null; }
  };
  async function select(label){
    const el=one('[role="radio"]',label);
    if(!selected(el))el.click();
    await wait(()=>selected(one('[role="radio"]',label)));
  }
  function promptBox(){
    const matches=[...document.querySelectorAll('textarea,input,[contenteditable="true"]')].filter(el=>visible(el) && (el.getAttribute('aria-label')==='What do you want to create?' || el.getAttribute('placeholder')==='What do you want to create?' || el.getAttribute('data-placeholder')==='What do you want to create?'));
    if(matches.length!==1)throw Error('UI_CHANGED');return matches[0];
  }
  const value=el=>'value' in el?el.value:el.textContent;
  function composerFor(box){
    const trigger=one('button','Add ingredients to the prompt box');
    let composer=box.parentElement;
    while(composer && !composer.contains(trigger))composer=composer.parentElement;
    if(!composer || composer===document.body)throw Error('REFERENCE_REQUIRED');
    return composer;
  }
  function referencePreview(box){
    const images=[...composerFor(box).querySelectorAll('img')].filter(visible);
    if(images.length>1)throw Error('REFERENCE_REQUIRED');
    if(!images.length)return null;
    const [img]=images;
    return img.complete && img.naturalWidth>0 && (img.currentSrc || img.src) || null;
  }
  async function attachReference(box,reference){
    const extension={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[reference.mime];
    if(!extension || !reference.bytes?.length || [...composerFor(box).querySelectorAll('img')].some(visible))throw Error('REFERENCE_REQUIRED');
    one('button','Add ingredients to the prompt box').click();
    const input=await wait(()=>{
      const inputs=[...document.querySelectorAll('input[type="file"]')].filter(el=>!el.disabled && /image|\.png|\.jpe?g|\.webp/i.test(el.accept));
      if(inputs.length>1)throw Error('REFERENCE_REQUIRED');
      return inputs[0];
    }).catch(()=>{throw Error('REFERENCE_REQUIRED');});
    const transfer=new DataTransfer();
    transfer.items.add(new File([Uint8Array.from(reference.bytes)],`aifekr-character.${extension}`,{type:reference.mime}));
    input.files=transfer.files;
    input.dispatchEvent(new Event('change',{bubbles:true}));
    return wait(()=>referencePreview(promptBox()),300).catch(()=>{throw Error('REFERENCE_REQUIRED');});
  }
  async function prepare(task,maxCredits,reference){
    prepared=null;
    if(task.reference && !reference)throw Error('REFERENCE_REQUIRED');
    if(task.model!=='flow-image')throw Error('UI_CHANGED');
    const settings = one('button','Settings trigger');
    if (!settings.innerText.includes('Nano Banana 2 Lite')) throw Error('UI_CHANGED');
    if (![...document.querySelectorAll('[role="radio"]')].some(el => visible(el) && text(el)==='Image')) settings.click();
    await wait(()=>[...document.querySelectorAll('[role="radio"]')].some(el=>visible(el) && text(el)==='Image'));
    await select('Image');await select(task.ratio);await select('x1');
    const costs=[...document.querySelectorAll('a')].filter(el=>visible(el) && /^\d+ credits?$/.test(text(el)));
    if(costs.length!==1)throw Error('UI_CHANGED');
    const cost=Number(text(costs[0]).split(' ')[0]);
    if(!Number.isFinite(cost) || cost>maxCredits)throw Error('CREDITS_REQUIRED');
    one('button','Settings trigger').click();
    let box=promptBox();if(value(box)?.trim())throw Error('UI_CHANGED');
    if(!task.reference && [...composerFor(box).querySelectorAll('img')].some(visible))throw Error('REFERENCE_REQUIRED');
    const preview=task.reference ? await attachReference(box,reference) : null;
    box=promptBox();
    box.focus();
    if('value' in box){const prototype=box.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(box,task.prompt);}
    else box.textContent=task.prompt;
    box.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:task.prompt}));
    await wait(()=>value(box)===task.prompt && !one('button','Start generation').disabled);
    if(preview && referencePreview(box)!==preview)throw Error('REFERENCE_REQUIRED');
    prepared={id:task.id,prompt:task.prompt,preview,baseline:imageUrls(),clicked:false};
    return {baseline:prepared.baseline,cost};
  }
  function generate(task){
    // If the tab reloads between PREPARE and START, refuse to click: the server reconciles it.
    if(!prepared || prepared.id!==task.id || prepared.clicked || value(promptBox())!==prepared.prompt)throw Error('OUTPUT_UNCERTAIN');
    if(prepared.preview && referencePreview(promptBox())!==prepared.preview)throw Error('REFERENCE_REQUIRED');
    if(!prepared.preview && [...composerFor(promptBox()).querySelectorAll('img')].some(visible))throw Error('REFERENCE_REQUIRED');
    const button=one('button','Start generation');if(button.disabled)throw Error('UI_CHANGED');
    prepared.clicked=true;button.click();return {submitted:true};
  }
  chrome.runtime.onMessage.addListener((message,_sender,reply)=>{
    if(message?.channel!=='AIFEKR_FLOW')return;
    (async()=>{
      if(message.action==='prepare')return prepare(message.task,Number(message.maxCredits)||0,message.reference);
      if(message.action==='generate')return generate(message.task);
      if(message.action==='recover'){
        const previous = new Set(message.baseline.map(imageKey));
        const urls = [...new Map(imageUrls().filter(url => !previous.has(imageKey(url))).map(url => [imageKey(url), url])).values()];
        if(urls.length>1)throw Error('OUTPUT_UNCERTAIN');
        return {url:urls[0] || null};
      }
      throw Error('UI_CHANGED');
    })().then(result=>reply({ok:true,...result}),error=>reply({ok:false,code:error.message}));
    return true;
  });
})();
