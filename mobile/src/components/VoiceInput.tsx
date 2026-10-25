import {useEffect,useRef,useState} from 'react';
import {ActivityIndicator,AppState,Pressable,StyleSheet,View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {RecordingPresets,useAudioRecorder,useAudioRecorderState,requestRecordingPermissionsAsync,setAudioModeAsync} from 'expo-audio';
import {File} from 'expo-file-system';
import {appendNativeFile} from '../nativeUpload';
import {z} from 'zod';
import {authorizedFetch,request,ApiError} from '../api';
import type {Locale} from '../i18n';
import {radius,space} from '../design';
import {AppText,Button,Icon,Row,tap} from '../ui/kit';
import {numberFormat,useTheme} from '../ui/theme';

export const transcriptionQuoteSchema=z.object({available:z.boolean(),credits:z.number().int().nonnegative(),maxBytes:z.number().positive()});
const copy={
 fa:{title:'پیام صوتی',hint:'حرف بزن؛ قبل از ارسال، متنش را می‌بینی و ویرایش می‌کنی.',record:'شروع ضبط',finish:'پایان ضبط',upload:(n:string)=>`تبدیل به متن · ${n} اعتبار`,discard:'حذف',consent:'صدا فقط برای تبدیل به متن ارسال می‌شود.',denied:'برای ضبط، اجازهٔ میکروفون را بده.',error:'تبدیل به متن انجام نشد. وضعیت را بررسی کن.',recording:'در حال ضبط',limit:'حداکثر ۶۰ ثانیه',ready:'ضبط آماده است',check:'بررسی وضعیت'},
 en:{title:'Voice message',hint:'Speak; you will see and edit the text before sending.',record:'Start recording',finish:'Stop',upload:(n:string)=>`Convert to text · ${n} credits`,discard:'Delete',consent:'Audio is sent only to convert it to text.',denied:'Allow microphone access to record.',error:'Could not convert to text. Check status.',recording:'Recording',limit:'Up to 60 seconds',ready:'Recording ready',check:'Check status'},
 tr:{title:'Sesli mesaj',hint:'Konuş; göndermeden önce metni görüp düzenlersin.',record:'Kaydı başlat',finish:'Durdur',upload:(n:string)=>`Metne çevir · ${n} kredi`,discard:'Sil',consent:'Ses yalnızca metne çevirmek için gönderilir.',denied:'Kayıt için mikrofon izni ver.',error:'Metne çevrilemedi. Durumu kontrol et.',recording:'Kaydediliyor',limit:'En fazla 60 saniye',ready:'Kayıt hazır',check:'Durumu kontrol et'},
} as const;

/** Renders nothing unless the server reports a configured transcription service. */
export function VoiceInput({locale,onTranscript,onError,disabled,quote:given}:{locale:Locale;onTranscript:(text:string)=>void;onError:(err:unknown)=>void;disabled:boolean;quote?:z.infer<typeof transcriptionQuoteSchema>|null}){
 const {c}=useTheme();const t=copy[locale];
 const recorder=useAudioRecorder({...RecordingPresets.HIGH_QUALITY,isMeteringEnabled:true});const state=useAudioRecorderState(recorder);
 const [quote,setQuote]=useState<z.infer<typeof transcriptionQuoteSchema>|null>(given??null),[capturing,setCapturing]=useState(false),[uri,setUri]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[requestKey,setRequestKey]=useState<string>();
 const local=useRef<string|null>(null),mounted=useRef(true);
 useEffect(()=>{if(given!==undefined)return;let active=true;request('/api/mobile/v1/transcribe',locale).then(raw=>{if(active)setQuote(transcriptionQuoteSchema.parse(raw));}).catch(err=>{if(active)onError(err);});return()=>{active=false;};},[locale,onError,given]);
 useEffect(()=>{mounted.current=true;const listener=AppState.addEventListener('change',status=>{if(status!=='active'&&recorder.isRecording){void recorder.stop().then(()=>{const path=recorder.uri;if(path){const file=new File(path);if(file.exists)file.delete();}if(mounted.current){setCapturing(false);setUri(null);}}).catch(()=>{});}});return()=>{mounted.current=false;listener.remove();if(local.current){const file=new File(local.current);if(file.exists)file.delete();}};},[recorder]);
 function discard(){if(uri){const file=new File(uri);if(file.exists)file.delete();}local.current=null;setUri(null);setRequestKey(undefined);}
 async function start(){if(disabled||busy)return;setBusy(true);setError('');try{discard();const permission=await requestRecordingPermissionsAsync();if(!permission.granted){setError(t.denied);return;}await setAudioModeAsync({allowsRecording:true,allowsBackgroundRecording:false,playsInSilentMode:true});await recorder.prepareToRecordAsync();recorder.record({forDuration:60});setCapturing(true);}catch{setError(t.error);}finally{setBusy(false);}}
 async function finish(){setBusy(true);try{if(recorder.isRecording)await recorder.stop();await setAudioModeAsync({allowsRecording:false});local.current=recorder.uri;setUri(recorder.uri);setCapturing(false);}catch{setError(t.error);}finally{setBusy(false);}}
 // The cost is printed on the button itself, so tapping it is the consent.
 async function upload(){if(!uri||!quote||busy)return;setBusy(true);setError('');try{const file=new File(uri);if(file.size>quote.maxBytes)throw new Error(t.error);const key=requestKey||`transcribe_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;setRequestKey(key);const form=new FormData();appendNativeFile(form,uri,'fika-message.m4a','audio/mp4');form.append('requestKey',key);form.append('acceptedCredits',String(quote.credits));const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),110000);try{const response=await authorizedFetch('/api/mobile/v1/transcribe',locale,{method:'POST',body:form,signal:controller.signal});const data=await response.json().catch(()=>null);if(!response.ok)throw new ApiError(response.status,data?.error||t.error);const result=z.object({text:z.string()}).parse(data);if(mounted.current){onTranscript(result.text);discard();}}finally{clearTimeout(timeout);}}catch(err){if(mounted.current){setError(err instanceof Error?err.message:t.error);if(err instanceof ApiError&&err.status===401)onError(err);}}finally{if(mounted.current)setBusy(false);}}
 async function check(){if(!requestKey)return;try{const data=z.object({status:z.string(),result:z.unknown()}).parse(await request(`/api/mobile/v1/requests/${requestKey}`,locale));if(data.status==='COMPLETED'){const result=z.object({text:z.string()}).parse(data.result);onTranscript(result.text);discard();setError('');}else setError(data.status);}catch(err){onError(err);}}
 if(!quote?.available)return null;
 const seconds=Math.floor(state.durationMillis/1000);const level=Math.max(6,Math.min(100,((state.metering??-60)+60)/60*100));
 return <View style={[s.card,{backgroundColor:c.raised}]}>
  <Row gap={space.md}>
   <View style={[s.icon,{backgroundColor:capturing?c.accent:c.soft}]}><Icon name={capturing?'radio-button-on':'mic-outline'} size={20} color={capturing?c.onAccent:c.accent}/></View>
   <View style={{flex:1,gap:2}}><AppText weight="bold">{capturing?`${t.recording} · ${numberFormat(locale,seconds)}″`:uri?t.ready:t.title}</AppText><AppText variant="caption" tone="muted">{capturing?t.limit:uri?t.consent:t.hint}</AppText></View>
  </Row>
  {capturing?<View style={[s.track,{backgroundColor:c.surface}]}><View accessibilityLabel={t.recording} style={[s.level,{width:`${level}%`,backgroundColor:c.accent}]}/></View>:null}
  {busy?<ActivityIndicator color={c.accent}/>:(capturing||!uri)?<View style={s.micWrap}>
   <LinearGradient pointerEvents="none" colors={[`rgba(255,107,0,${capturing?.55:.3})`,'rgba(255,107,0,0)']} style={[s.micHalo,{transform:[{scale:capturing?1+level/250:1}]}]}/>
   <Pressable accessibilityRole="button" accessibilityLabel={capturing?t.finish:t.record} disabled={disabled} onPress={()=>{tap();void(capturing?finish():start());}} style={({pressed})=>[s.mic,{backgroundColor:c.accent,opacity:disabled?.5:pressed?.85:1}]}><Icon name={capturing?'stop':'mic'} size={34} color={c.onAccent}/></Pressable>
   <AppText variant="caption" tone="muted" align="center">{capturing?t.finish:t.record}</AppText>
  </View>:uri?<Row gap={space.sm}><Button style={{flex:1}} label={t.upload(numberFormat(locale,quote.credits))} icon="text-outline" onPress={()=>void upload()}/><Button label={t.discard} variant="ghost" onPress={discard}/></Row>:null}
  {requestKey&&!busy?<Button label={t.check} variant="ghost" icon="refresh" onPress={()=>void check()}/>:null}
  {error?<AppText variant="caption" tone="danger" accessibilityRole="alert">{error}</AppText>:null}
 </View>;
}
const s=StyleSheet.create({
 card:{borderRadius:radius.lg,padding:space.lg,gap:space.md},
 icon:{width:40,height:40,borderRadius:14,alignItems:'center',justifyContent:'center'},
 track:{height:6,borderRadius:3,overflow:'hidden'},
 level:{height:6,borderRadius:3},
 micWrap:{alignItems:'center',justifyContent:'center',paddingVertical:space.lg,gap:space.md},
 micHalo:{position:'absolute',top:-10,width:170,height:170,borderRadius:85},
 mic:{width:88,height:88,borderRadius:44,alignItems:'center',justifyContent:'center'},
});
