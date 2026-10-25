import {useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,AppState,FlatList,KeyboardAvoidingView,Platform,Pressable,Share,StyleSheet,TextInput,View} from 'react-native';
import {z} from 'zod';
import {ApiError,authorizedFetch,request,readDraft,saveDraft} from '../api';
import type {Locale} from '../i18n';
import {displayChatText,SseParser} from '../sse';
import {fonts,radius,space,type} from '../design';
import {AppText,Banner,Button,Chip,Icon,IconButton,Row,Sheet,success} from '../ui/kit';
import {Markdown} from '../ui/Markdown';
import {numberFormat,useTheme} from '../ui/theme';
import {SpeechControl} from './SpeechControl';
import {VoiceInput,transcriptionQuoteSchema} from './VoiceInput';
import {ActionCenter} from './ActionCenter';
import {FikaBusinessTools} from './FikaBusinessTools';

const quoteSchema=z.object({maxCredits:z.number().int().nonnegative()});
const listSchema=z.object({conversations:z.array(z.object({id:z.string(),title:z.string()}))});
const historySchema=z.object({messages:z.array(z.object({role:z.enum(['user','assistant']),content:z.string()}))});
const labels={
 fa:{title:'فیکا',send:'ارسال',new:'گفت‌وگوی جدید',history:'گفت‌وگوها',noHistory:'هنوز گفت‌وگویی نیست.',placeholder:'پیام به فیکا…',cost:(n:string)=>`حداکثر ${n} اعتبار`,confirmTitle:'هزینهٔ این پیام',confirmBody:(n:string)=>`این پیام حداکثر ${n} اعتبار مصرف می‌کند؛ مقدار دقیق به مدلی بستگی دارد که پاسخ می‌دهد.`,remember:'در این نشست دوباره نپرس',cancel:'لغو',stop:'توقف',stopped:'دریافت متوقف شد. پردازش سرور ممکن است ادامه یابد و هزینه داشته باشد؛ پیش از ارسال دوباره، وضعیت را بررسی کنید.',error:'چت ناموفق بود؛ وضعیت درخواست را بررسی کنید.',incomplete:'پاسخ کامل دریافت نشد.',check:'بررسی وضعیت',tools:'ابزارها و اقدام‌ها',voice:'ورودی صوتی',share:'اشتراک',retry:'دوباره بپرس',thinking:'فیکا در حال فکر کردن…',hello:'امروز چه کاری برایت انجام دهم؟',starters:['خلاصهٔ این متن را بنویس','برای کسب‌وکارم ایده بده','یک ایمیل رسمی بنویس']},
 en:{title:'FIKA',send:'Send',new:'New chat',history:'Chats',noHistory:'No chats yet.',placeholder:'Message FIKA…',cost:(n:string)=>`Up to ${n} credits`,confirmTitle:'Cost of this message',confirmBody:(n:string)=>`This message uses at most ${n} credits; the exact amount depends on the model that answers.`,remember:"Don't ask again this session",cancel:'Cancel',stop:'Stop',stopped:'Receiving stopped. Server processing may continue and incur a charge; check status before resending.',error:'Chat failed; check request status.',incomplete:'The complete response was not received.',check:'Check status',tools:'Tools and actions',voice:'Voice input',share:'Share',retry:'Ask again',thinking:'FIKA is thinking…',hello:'What can I do for you today?',starters:['Summarize this text','Ideas for my business','Write a formal email']},
 tr:{title:'FIKA',send:'Gönder',new:'Yeni sohbet',history:'Sohbetler',noHistory:'Henüz sohbet yok.',placeholder:'FIKA’ya yaz…',cost:(n:string)=>`En fazla ${n} kredi`,confirmTitle:'Bu mesajın maliyeti',confirmBody:(n:string)=>`Bu mesaj en fazla ${n} kredi kullanır; kesin miktar yanıtlayan modele bağlıdır.`,remember:'Bu oturumda tekrar sorma',cancel:'İptal',stop:'Durdur',stopped:'Alım durdu. Sunucu işlemi devam edip ücretlendirebilir; yeniden göndermeden önce durumu kontrol edin.',error:'Sohbet başarısız; istek durumunu kontrol edin.',incomplete:'Yanıtın tamamı alınamadı.',check:'Durumu kontrol et',tools:'Araçlar ve işlemler',voice:'Sesli giriş',share:'Paylaş',retry:'Tekrar sor',thinking:'FIKA düşünüyor…',hello:'Bugün senin için ne yapabilirim?',starters:['Bu metni özetle','İşim için fikirler','Resmi bir e-posta yaz']},
} as const;
type Message={role:'user'|'assistant';content:string};

export function ChatScreen({locale,onError,initialPrompt,initialConversation,openVoice}:{locale:Locale;onError:(err:unknown)=>void;initialPrompt?:string;initialConversation?:string;openVoice?:boolean}){
 const {c,rtl}=useTheme();const t=labels[locale];
 const [quote,setQuote]=useState<number|null>(null),[conversations,setConversations]=useState<z.infer<typeof listSchema>['conversations']>([]),[conversationId,setConversationId]=useState<string>(),[messages,setMessages]=useState<Message[]>([]),[draft,setDraft]=useState(initialPrompt??''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[lastKey,setLastKey]=useState<string>();
 const [accepted,setAccepted]=useState<number|null>(null),[confirming,setConfirming]=useState<string|null>(null),[remember,setRemember]=useState(true),[showHistory,setShowHistory]=useState(false),[showTools,setShowTools]=useState(!!openVoice);
 const abort=useRef<AbortController|null>(null),mounted=useRef(true),sending=useRef(false),list=useRef<FlatList<Message>>(null),autoSent=useRef(false);
 const draftOwner=useRef<string|null>(null);
 useEffect(()=>{if(draftOwner.current||initialPrompt)return;let active=true;readDraft().then(value=>{if(active&&value){draftOwner.current=value.sessionId;setDraft(value.text);}}).catch(onError);return()=>{active=false;};},[onError,initialPrompt]);
 useEffect(()=>{const timer=setTimeout(()=>{const owner=draftOwner.current;if(owner)void saveDraft(draft,owner).catch(onError);},800);return()=>clearTimeout(timer);},[draft,onError]);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;abort.current?.abort();};},[]);
 useEffect(()=>{const listener=AppState.addEventListener('change',state=>{if(state!=='active')abort.current?.abort();});return()=>listener.remove();},[]);
 // Voice is offered only when the server has a transcription service; a failed check just hides it.
 const [voice,setVoice]=useState<z.infer<typeof transcriptionQuoteSchema>|null>(null);
 useEffect(()=>{let active=true;request('/api/mobile/v1/transcribe',locale).then(raw=>{if(active)setVoice(transcriptionQuoteSchema.parse(raw));}).catch(()=>{});return()=>{active=false;};},[locale]);
 const loadList=useCallback(()=>request('/api/mobile/v1/conversations',locale).then(raw=>{if(mounted.current)setConversations(listSchema.parse(raw).conversations);}),[locale]);
 useEffect(()=>{let active=true;Promise.all([request('/api/mobile/v1/chat/quote',locale),loadList()]).then(([q])=>{if(active)setQuote(quoteSchema.parse(q).maxCredits);}).catch(err=>{if(active)onError(err);});return()=>{active=false;};},[locale,onError,loadList]);

 const open=useCallback(async(id:string)=>{if(sending.current)return;setBusy(true);setError('');setShowHistory(false);try{const data=historySchema.parse(await request(`/api/chat/history?conversationId=${encodeURIComponent(id)}`,locale));if(mounted.current){setMessages(data.messages);setConversationId(id);}}catch(err){onError(err);}finally{if(mounted.current)setBusy(false);}},[locale,onError]);
 // Opening a conversation chosen on Home is a fetch, not derived state.
 // eslint-disable-next-line react-hooks/set-state-in-effect
 useEffect(()=>{if(initialConversation)void open(initialConversation);},[initialConversation,open]);

 async function send(text:string,maxCredits:number,base:Message[]=messages){
  const message=text.trim();if(sending.current||!message)return;sending.current=true;setBusy(true);setError('');
  const prior=base.slice(-10),key=`chat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;setLastKey(key);setDraft('');setMessages([...base,{role:'user',content:message},{role:'assistant',content:''}]);
  const controller=new AbortController();abort.current=controller;const timeout=setTimeout(()=>controller.abort(),180000);
  try{
   const response=await authorizedFetch('/api/mobile/v1/chat',locale,{method:'POST',signal:controller.signal,body:JSON.stringify({message,conversationId,history:prior,acceptedMaxCredits:maxCredits,requestKey:key})});
   if(!response.ok){const data=await response.json().catch(()=>null);throw new ApiError(response.status,data?.error||t.error);}
   const id=response.headers.get('X-Conversation-Id');if(id&&mounted.current)setConversationId(id);
   if(!response.body)throw new Error(t.incomplete);const reader=response.body.getReader(),decoder=new TextDecoder(),parser=new SseParser();let answer='';
   while(true){const {done,value}=await reader.read();if(done)break;for(const event of parser.push(decoder.decode(value,{stream:true}))){if(event.error)throw new Error(event.error);if(event.reset)answer='';if(event.text)answer+=event.text;if(answer.length>1000000)throw new Error(t.incomplete);if(mounted.current)setMessages(current=>[...current.slice(0,-1),{role:'assistant',content:answer}]);}}
   if(!parser.done)throw new Error(t.incomplete);
   success();void loadList().catch(()=>{});
  }catch(err){if(mounted.current){
   // Keep any partial answer; drop the empty placeholder so the error is not shown next to "thinking".
   setMessages(current=>{const last=current[current.length-1];return last?.role==='assistant'&&!last.content?current.slice(0,-1):current;});
   setError(controller.signal.aborted?t.stopped:err instanceof Error?err.message:t.error);if(err instanceof ApiError&&err.status===401)onError(err);}}
  finally{clearTimeout(timeout);sending.current=false;abort.current=null;if(mounted.current)setBusy(false);}
 }
 // Consent: the cost is always on the composer; the sheet asks once per session,
 // and again whenever the quoted maximum rises above what was accepted.
 function submit(text=draft){
  const message=text.trim();if(quote===null||!message||sending.current)return;
  if(accepted!==null&&quote<=accepted){void send(message,quote);return;}
  setConfirming(message);
 }
 useEffect(()=>{if(initialPrompt&&quote!==null&&!autoSent.current){autoSent.current=true;submit(initialPrompt);}});
 function confirm(){const message=confirming;if(!message||quote===null)return;setConfirming(null);if(remember)setAccepted(quote);void send(message,quote);}
 function retry(){const lastUser=[...messages].reverse().find(m=>m.role==='user');if(!lastUser)return;const index=messages.lastIndexOf(lastUser);const base=messages.slice(0,index);setMessages(base);if(quote!==null&&accepted!==null&&quote<=accepted)void send(lastUser.content,quote,base);else{setConfirming(lastUser.content);}}
 async function check(){if(!lastKey)return;try{const raw=await request(`/api/mobile/v1/requests/${encodeURIComponent(lastKey)}`,locale);const result=z.object({status:z.string(),result:z.object({text:z.string(),conversationId:z.string().nullable()}).nullable()}).parse(raw);if(result.status==='COMPLETED'&&result.result){const value=result.result;setMessages(current=>{const keep=current[current.length-1]?.role==='assistant'?current.slice(0,-1):current;return [...keep,{role:'assistant',content:value.text}];});if(value.conversationId)setConversationId(value.conversationId);setError('');}else setError(result.status);}catch(err){onError(err);}}
 const reset=()=>{if(busy)return;setMessages([]);setConversationId(undefined);setLastKey(undefined);setError('');};
 const costLabel=quote===null?'…':t.cost(numberFormat(locale,quote));

 const renderItem=({item,index}:{item:Message;index:number})=>{
  const mine=item.role==='user',last=index===messages.length-1,streaming=busy&&last&&!mine;
  if(mine)return <View style={[s.userBubble,{backgroundColor:c.soft,alignSelf:rtl?'flex-start':'flex-end'}]}><AppText selectable style={{color:c.text}}>{item.content}</AppText></View>;
  return <View style={s.answer}>
   <Row gap={space.sm}><View style={[s.avatar,{backgroundColor:c.accent}]}><Icon name="sparkles" size={14} color={c.onAccent}/></View><AppText variant="caption" weight="medium" tone="muted">{t.title}</AppText></Row>
   {item.content?<Markdown text={displayChatText(item.content)}/>:<Row gap={space.sm}><ActivityIndicator size="small" color={c.accent}/><AppText variant="caption" tone="muted">{t.thinking}</AppText></Row>}
   {!streaming&&item.content?<Row gap={space.xs}>
    <SpeechControl text={item.content} locale={locale} color={c.muted}/>
    <IconButton icon="share-outline" label={t.share} size={34} onPress={()=>void Share.share({message:displayChatText(item.content)})}/>
    {last?<IconButton icon="refresh" label={t.retry} size={34} onPress={retry}/>:null}
   </Row>:null}
  </View>;
 };

 return <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined} keyboardVerticalOffset={80}>
  <Row justify="space-between" style={s.header}>
   <Row gap={space.xs}><IconButton icon="time-outline" label={t.history} onPress={()=>{setShowHistory(true);void loadList().catch(()=>{});}}/><AppText variant="title" weight="bold" accessibilityRole="header">{t.title}</AppText></Row>
   <Row gap={space.xs}><IconButton icon="briefcase-outline" label={t.tools} onPress={()=>setShowTools(true)}/><IconButton icon="create-outline" label={t.new} onPress={reset} disabled={busy}/></Row>
  </Row>
  <FlatList ref={list} data={messages} keyExtractor={(_,i)=>String(i)} renderItem={renderItem} contentContainerStyle={s.list} keyboardShouldPersistTaps="handled"
   onContentSizeChange={()=>list.current?.scrollToEnd({animated:true})}
   ListEmptyComponent={<View style={s.empty}>
    <View style={[s.emptyIcon,{backgroundColor:c.soft}]}><Icon name="sparkles-outline" size={34} color={c.accent}/></View>
    <AppText variant="title" weight="bold" align="center">{t.hello}</AppText>
    <View style={{flexDirection:rtl?'row-reverse':'row',flexWrap:'wrap',gap:space.sm,justifyContent:'center'}}>{t.starters.map(p=><Chip key={p} tone="raised" label={p} onPress={()=>setDraft(p)}/>)}</View>
   </View>}
   ListFooterComponent={error?<View style={{gap:space.sm}}><Banner text={error} action={lastKey&&!busy?{label:t.check,onPress:()=>void check()}:undefined}/></View>:null}/>
  <View style={[s.composer,{backgroundColor:c.surface,borderColor:c.border}]}>
   <TextInput accessibilityLabel={t.placeholder} placeholder={t.placeholder} placeholderTextColor={c.faint} value={draft} onChangeText={setDraft} multiline maxLength={12000} editable={!busy}
    style={[type.body,{fontFamily:fonts.regular,color:c.text,maxHeight:140,minHeight:44,textAlign:rtl?'right':'left',writingDirection:rtl?'rtl':'ltr'}]}/>
   <Row justify="space-between">
    <Row gap={space.xs}>{voice?.available?<IconButton icon="mic-outline" label={t.voice} onPress={()=>setShowTools(true)} disabled={busy}/>:null}<Chip icon="flash-outline" label={costLabel}/></Row>
    {busy?<IconButton icon="stop" tone="raised" label={t.stop} onPress={()=>abort.current?.abort()}/>:<IconButton icon="arrow-up" tone="accent" label={t.send} disabled={quote===null||!draft.trim()} onPress={()=>submit()}/>}
   </Row>
  </View>
  <Sheet visible={confirming!==null} onClose={()=>setConfirming(null)} title={t.confirmTitle}>
   <AppText tone="muted">{t.confirmBody(quote===null?'…':numberFormat(locale,quote))}</AppText>
   <Pressable accessibilityRole="checkbox" accessibilityState={{checked:remember}} onPress={()=>setRemember(v=>!v)}><Row gap={space.sm}><Icon name={remember?'checkbox':'square-outline'} color={c.accent}/><AppText>{t.remember}</AppText></Row></Pressable>
   <Button label={t.send} icon="arrow-up" onPress={confirm}/><Button label={t.cancel} variant="ghost" onPress={()=>setConfirming(null)}/>
  </Sheet>
  <Sheet visible={showHistory} onClose={()=>setShowHistory(false)} title={t.history}>
   <Button label={t.new} variant="secondary" icon="add" onPress={()=>{reset();setShowHistory(false);}}/>
   {conversations.length?conversations.map(item=><Pressable key={item.id} accessibilityRole="button" onPress={()=>void open(item.id)} style={[s.historyRow,{backgroundColor:item.id===conversationId?c.soft:c.raised}]}><AppText numberOfLines={1}>{item.title}</AppText></Pressable>):<AppText tone="muted">{t.noHistory}</AppText>}
  </Sheet>
  <Sheet visible={showTools} onClose={()=>setShowTools(false)} title={t.tools}>
   <VoiceInput locale={locale} quote={voice} onTranscript={text=>{setDraft(text);setShowTools(false);}} onError={onError} disabled={busy}/>
   <FikaBusinessTools locale={locale} onError={onError}/>
   <ActionCenter locale={locale} onError={onError}/>
  </Sheet>
 </KeyboardAvoidingView>;
}
const s=StyleSheet.create({
 header:{paddingHorizontal:space.lg,paddingVertical:space.sm},
 list:{padding:space.lg,gap:space.lg,flexGrow:1},
 userBubble:{maxWidth:'85%',borderRadius:radius.lg,paddingHorizontal:space.lg,paddingVertical:space.md},
 answer:{gap:space.sm},
 avatar:{width:24,height:24,borderRadius:8,alignItems:'center',justifyContent:'center'},
 empty:{flex:1,alignItems:'center',justifyContent:'center',gap:space.lg,paddingVertical:space.xxl},
 emptyIcon:{width:72,height:72,borderRadius:24,alignItems:'center',justifyContent:'center'},
 composer:{margin:space.md,borderRadius:radius.lg,borderWidth:1,padding:space.sm,gap:space.xs},
 historyRow:{borderRadius:radius.md,padding:space.md},
});
