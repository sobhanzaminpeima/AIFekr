import {useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Alert,AppState,Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import {z} from 'zod';
import {ApiError,authorizedFetch,request,readDraft,saveDraft} from '../api';
import type {Locale} from '../i18n';
import {displayChatText,SseParser} from '../sse';
import {SpeechControl} from './SpeechControl';
import {VoiceInput} from './VoiceInput';
import {ActionCenter} from './ActionCenter';
import {FikaBusinessTools} from './FikaBusinessTools';
const quoteSchema=z.object({maxCredits:z.number().int().nonnegative()});
const listSchema=z.object({conversations:z.array(z.object({id:z.string(),title:z.string()}))});
const historySchema=z.object({messages:z.array(z.object({role:z.enum(['user','assistant']),content:z.string()}))});
const labels={fa:{send:'ارسال',new:'گفت‌وگوی جدید',history:'گفت‌وگوهای اخیر',placeholder:'با فیکا صحبت کنید…',cost:'حداکثر اعتبار این پیام',confirm:'ارسال با این هزینه؟',cancel:'لغو',stop:'توقف دریافت',stopped:'دریافت متوقف شد. پردازش سرور ممکن است ادامه یابد و هزینه داشته باشد؛ پیش از ارسال دوباره سابقه را بررسی کنید.',error:'چت ناموفق بود؛ وضعیت درخواست را بررسی کنید.',incomplete:'پاسخ کامل دریافت نشد.',check:'بررسی وضعیت درخواست',voice:'ورودی صوتی و اقدامات تجاری هنوز فعال نیستند؛ این چت فقط متنی است.'},en:{send:'Send',new:'New conversation',history:'Recent conversations',placeholder:'Talk to FIKA…',cost:'Maximum credits for this message',confirm:'Send at this cost?',cancel:'Cancel',stop:'Stop receiving',stopped:'Receiving stopped. Server processing may continue and incur a charge; check history before resending.',error:'Chat failed; check request status.',incomplete:'The complete response was not received.',check:'Check request status',voice:'Voice input and business actions are not enabled yet; this is text chat.'},tr:{send:'Gönder',new:'Yeni sohbet',history:'Son sohbetler',placeholder:'FIKA ile konuşun…',cost:'Bu mesaj için en fazla kredi',confirm:'Bu maliyetle gönderilsin mi?',cancel:'İptal',stop:'Almayı durdur',stopped:'Alım durdu. Sunucu işlemi devam edip ücretlendirebilir; yeniden göndermeden önce geçmişi kontrol edin.',error:'Sohbet başarısız; isteğin durumunu kontrol edin.',incomplete:'Yanıtın tamamı alınamadı.',check:'İstek durumunu kontrol et',voice:'Ses girişi ve iş işlemleri henüz etkin değil; bu metin sohbetidir.'}};
export function ChatScreen({locale,color,surface,onError}:{locale:Locale;color:string;surface:string;onError:(err:unknown)=>void}){
 const t=labels[locale],rtl=locale==='fa';const [quote,setQuote]=useState<number|null>(null),[conversations,setConversations]=useState<z.infer<typeof listSchema>['conversations']>([]),[conversationId,setConversationId]=useState<string>(),[messages,setMessages]=useState<{role:'user'|'assistant';content:string}[]>([]),[draft,setDraft]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[lastKey,setLastKey]=useState<string>();
 const abort=useRef<AbortController|null>(null),mounted=useRef(true),sending=useRef(false);
 const draftOwner=useRef<string|null>(null);
 useEffect(()=>{if(draftOwner.current)return;let active=true;readDraft().then(value=>{if(active&&value){draftOwner.current=value.sessionId;setDraft(value.text);}}).catch(onError);return()=>{active=false;};},[onError]);
 useEffect(()=>{const timer=setTimeout(()=>{const owner=draftOwner.current;if(owner)void saveDraft(draft,owner).catch(onError);},800);return()=>clearTimeout(timer);},[draft,onError]);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;abort.current?.abort();};},[]);
 useEffect(()=>{const listener=AppState.addEventListener('change',state=>{if(state!=='active')abort.current?.abort();});return()=>listener.remove();},[]);
 useEffect(()=>{let active=true;Promise.all([request('/api/mobile/v1/chat/quote',locale),request('/api/mobile/v1/conversations',locale)]).then(([q,c])=>{if(active){setQuote(quoteSchema.parse(q).maxCredits);setConversations(listSchema.parse(c).conversations);}}).catch(err=>{if(active)onError(err);});return()=>{active=false;};},[locale,onError]);
 async function open(id:string){if(busy)return;setBusy(true);setError('');try{const data=historySchema.parse(await request(`/api/chat/history?conversationId=${encodeURIComponent(id)}`,locale));if(mounted.current){setMessages(data.messages);setConversationId(id);}}catch(err){onError(err);}finally{if(mounted.current)setBusy(false);}}
 async function send(maxCredits:number){
  if(sending.current||!draft.trim())return;sending.current=true;setBusy(true);setError('');
  const message=draft.trim(),prior=messages.slice(-10),key=`chat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;setLastKey(key);setDraft('');setMessages([...messages,{role:'user',content:message},{role:'assistant',content:''}]);
  const controller=new AbortController();abort.current=controller;const timeout=setTimeout(()=>controller.abort(),180000);
  try{
   const response=await authorizedFetch('/api/mobile/v1/chat',locale,{method:'POST',signal:controller.signal,body:JSON.stringify({message,conversationId,history:prior,acceptedMaxCredits:maxCredits,requestKey:key})});
   if(!response.ok){const data=await response.json().catch(()=>null);throw new ApiError(response.status,data?.error||t.error);}
   const id=response.headers.get('X-Conversation-Id');if(id&&mounted.current)setConversationId(id);
   if(!response.body)throw new Error(t.incomplete);const reader=response.body.getReader(),decoder=new TextDecoder(),parser=new SseParser();let answer='';
   while(true){const {done,value}=await reader.read();if(done)break;for(const event of parser.push(decoder.decode(value,{stream:true}))){if(event.error)throw new Error(event.error);if(event.reset)answer='';if(event.text)answer+=event.text;if(answer.length>1000000)throw new Error(t.incomplete);if(mounted.current)setMessages(current=>[...current.slice(0,-1),{role:'assistant',content:answer}]);}}
   if(!parser.done)throw new Error(t.incomplete);
  }catch(err){if(mounted.current){setError(controller.signal.aborted?t.stopped:err instanceof Error?err.message:t.error);if(err instanceof ApiError&&err.status===401)onError(err);}}
  finally{clearTimeout(timeout);sending.current=false;abort.current=null;if(mounted.current)setBusy(false);}
 }
 function preview(){if(quote===null||!draft.trim())return;Alert.alert(t.confirm,`${t.cost}: ${new Intl.NumberFormat(locale).format(quote)}`,[{text:t.cancel,style:'cancel'},{text:t.send,onPress:()=>void send(quote)}]);}
 async function check(){if(!lastKey)return;try{const raw=await request(`/api/mobile/v1/requests/${encodeURIComponent(lastKey)}`,locale);const result=z.object({status:z.string(),result:z.object({text:z.string(),conversationId:z.string().nullable()}).nullable()}).parse(raw);if(result.status==='COMPLETED'&&result.result){const value=result.result;setMessages(current=>[...current.slice(0,-1),{role:'assistant',content:value.text}]);if(value.conversationId)setConversationId(value.conversationId);setError('');}else setError(result.status);}catch(err){onError(err);}}
 return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:24,gap:16}}><Text accessibilityRole="header" style={{color,fontSize:30,fontWeight:'700'}}>FIKA</Text><VoiceInput locale={locale} color={color} onTranscript={text=>setDraft(text)} onError={onError} disabled={busy}/><ChatButton label={t.new} action={()=>{setMessages([]);setConversationId(undefined);setLastKey(undefined);setError('');}} disabled={busy} color={color} rtl={rtl}/>
 <FikaBusinessTools locale={locale} color={color} onError={onError}/>
 <ActionCenter locale={locale} color={color} onError={onError}/>
 {!messages.length?<><Text style={{color,fontWeight:'600'}}>{t.history}</Text>{conversations.map(c=><View key={c.id}><ChatButton label={c.title} action={()=>void open(c.id)} disabled={busy} color={color} rtl={rtl}/></View>)}</>:null}
 {messages.map((m,i)=><View key={i} style={{padding:16,borderRadius:20,backgroundColor:surface,borderWidth:1,borderColor:m.role==='user'?'#FF6B00':'#75685A'}}><Text selectable style={{color,lineHeight:25,textAlign:rtl?'right':'left'}}>{displayChatText(m.content)}</Text>{m.role==='assistant'&&!busy&&m.content?<SpeechControl text={m.content} locale={locale} color={color}/>:null}</View>)}
 {error?<Text accessibilityRole="alert" style={{color}}>{error}</Text>:null}{lastKey&&!busy?<ChatButton label={t.check} action={()=>void check()} disabled={false} color={color} rtl={rtl}/>:null}
 {busy?<><ActivityIndicator color="#FF6B00"/><ChatButton label={t.stop} action={()=>abort.current?.abort()} disabled={false} color={color} rtl={rtl}/></>:<><TextInput accessibilityLabel={t.placeholder} placeholder={t.placeholder} placeholderTextColor={color} value={draft} onChangeText={setDraft} multiline maxLength={12000} style={{color,minHeight:100,padding:16,borderRadius:16,borderColor:'#75685A',borderWidth:1,textAlign:rtl?'right':'left'}}/><Text style={{color}}>{t.cost}: {quote===null?'…':new Intl.NumberFormat(locale).format(quote)}</Text><ChatButton label={t.send} action={preview} disabled={quote===null||!draft.trim()} color={color} rtl={rtl}/></>}
 </ScrollView>;
}

function ChatButton({label,action,disabled,color,rtl}:{label:string;action:()=>void;disabled:boolean;color:string;rtl:boolean}){return <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{disabled}} onPress={action} style={{minHeight:48,padding:12,borderRadius:16,borderWidth:1,borderColor:'#FF6B00',justifyContent:'center',opacity:disabled?0.5:1}}><Text style={{color,textAlign:rtl?'right':'left'}}>{label}</Text></Pressable>;} 



