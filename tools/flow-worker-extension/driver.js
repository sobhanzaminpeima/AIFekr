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
  const wait = async predicate => {
    for(let i=0;i<30;i++){if(predicate())return;await new Promise(r=>setTimeout(r,100));}
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
  async function prepare(task,maxCredits){
    if(task.reference)throw Error('REFERENCE_REQUIRED');
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
    const box=promptBox();if(value(box)?.trim())throw Error('UI_CHANGED');
    box.focus();
    if('value' in box){const prototype=box.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(box,task.prompt);}
    else box.textContent=task.prompt;
    box.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:task.prompt}));
    await wait(()=>value(box)===task.prompt && !one('button','Start generation').disabled);
    prepared={id:task.id,prompt:task.prompt,baseline:imageUrls(),clicked:false};
    return {baseline:prepared.baseline,cost};
  }
  function generate(task){
    // If the tab reloads between PREPARE and START, refuse to click: the server reconciles it.
    if(!prepared || prepared.id!==task.id || prepared.clicked || value(promptBox())!==prepared.prompt)throw Error('OUTPUT_UNCERTAIN');
    const button=one('button','Start generation');if(button.disabled)throw Error('UI_CHANGED');
    prepared.clicked=true;button.click();return {submitted:true};
  }
  chrome.runtime.onMessage.addListener((message,_sender,reply)=>{
    if(message?.channel!=='AIFEKR_FLOW')return;
    (async()=>{
      if(message.action==='prepare')return prepare(message.task,Number(message.maxCredits)||0);
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
