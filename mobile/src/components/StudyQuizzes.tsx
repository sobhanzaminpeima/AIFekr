import {useCallback,useEffect,useState} from 'react';
import {Alert,Pressable,Text,View} from 'react-native';
import {z} from 'zod';
import {request,saveOfflineQuiz,readOfflineQuiz} from '../api';
import {randomUUID} from 'expo-crypto';
import {quizSecondsLeft} from '../quizTime';
import type {Locale} from '../i18n';
import type {Palette} from '../design';
const catalog=z.object({quizzes:z.array(z.object({id:z.string(),title:z.string(),timeLimitSeconds:z.number().nullable(),attempts:z.array(z.object({id:z.string(),score:z.number(),total:z.number()}))}))});
const questions=z.object({expiresAt:z.string().nullable(),serverNow:z.string(),quiz:z.object({questions:z.array(z.object({question:z.string(),options:z.array(z.string()).min(2).max(4)}))})});
const draftSchema=z.object({quizHash:z.string(),draft:z.object({answers:z.array(z.number().int().nullable()),revision:z.number().int()}).nullable()});
const result=z.object({attempt:z.object({score:z.number(),total:z.number()})});
const copy={fa:{offlineHint:'انتخاب‌های آخرین آزمون به‌صورت امن روی این دستگاه ذخیره می‌شوند. ثبت نهایی با دکمهٔ ثبت پاسخ‌ها انجام می‌شود.',saveDraft:'ذخیرهٔ پاسخ‌های نیمه‌کاره',saved:'پاسخ‌ها در حساب ذخیره شدند.',start:'شروع یا ادامهٔ آزمون',title:'آزمون‌های درس',submit:'ثبت پاسخ‌ها',cancel:'لغو',refresh:'دریافت دوباره',timed:'زمان آزمون از لحظهٔ شروع در سرور محاسبه می‌شود و با بازکردن دوباره از نو آغاز نمی‌شود.',empty:'آزمونی ثبت نشده است.',unknown:'نتیجه مشخص نیست؛ تاریخچه را پیش از ارسال دوباره بررسی کنید.'},en:{offlineHint:'Selections for your latest quiz are stored securely on this device. Submit answers to record the final grade.',saveDraft:'Save unfinished answers',saved:'Answers saved to your account.',start:'Start or resume quiz',title:'Course quizzes',submit:'Submit answers',cancel:'Cancel',refresh:'Refresh',timed:'Time begins on the server and reopening does not reset it.',empty:'No quizzes yet.',unknown:'Outcome uncertain; inspect history before resubmitting.'},tr:{offlineHint:'Son sınav seçimleri bu cihazda güvenle saklanır. Son notu kaydetmek için yanıtları gönderin.',saveDraft:'Tamamlanmamış yanıtları kaydet',saved:'Yanıtlar hesabınıza kaydedildi.',start:'Sınavı başlat veya sürdür',title:'Ders sınavları',submit:'Yanıtları gönder',cancel:'İptal',refresh:'Yenile',timed:'Süre sunucuda başlar ve yeniden açmak süreyi sıfırlamaz.',empty:'Henüz sınav yok.',unknown:'Sonuç belirsiz; tekrar göndermeden önce geçmişi kontrol edin.'}};
export function StudyQuizzes({courseId,locale,palette:c,onError,refreshRevision=0}:{courseId:string;locale:Locale;palette:Palette;onError:(e:unknown)=>void;refreshRevision?:number}){
 const t=copy[locale];const [items,setItems]=useState<z.infer<typeof catalog>['quizzes']|null>(null),[id,setId]=useState<string|null>(null),[quiz,setQuiz]=useState<z.infer<typeof questions>['quiz']|null>(null),[answers,setAnswers]=useState<number[]>([]),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[notice,setNotice]=useState(''),[revision,setRevision]=useState(0),[requestKey,setRequestKey]=useState(''),[clock,setClock]=useState<{expiresAt:string|null;serverNow:string;started:number}|null>(null),[remaining,setRemaining]=useState<number|null>(null),[draftRevision,setDraftRevision]=useState(0),[quizHash,setQuizHash]=useState('');
 useEffect(()=>{let active=true;request(`/api/mobile/v1/student/quizzes?courseId=${encodeURIComponent(courseId)}`,locale).then(raw=>{if(active)setItems(catalog.parse(raw).quizzes);}).catch(e=>{if(active)onError(e);});return()=>{active=false;};},[courseId,locale,onError,revision,refreshRevision]);
 useEffect(()=>{if(!clock)return;const tick=()=>setRemaining(quizSecondsLeft(clock.expiresAt,clock.serverNow,performance.now()-clock.started));tick();const interval=setInterval(tick,1000);return()=>clearInterval(interval);},[clock]);
 const open=useCallback(async(key:string)=>{
  if(busy)return;
  setBusy(true);setNotice('');
  try{
   const data=questions.parse(await request(`/api/mobile/v1/student/quizzes/${encodeURIComponent(key)}/attempt`,locale,{method:'POST',body:JSON.stringify({action:'start'})}));
   const started=performance.now();
   const saved=draftSchema.parse(await request(`/api/mobile/v1/student/quizzes/${encodeURIComponent(key)}/draft`,locale));
   setQuiz(data.quiz);setId(key);
   setClock({expiresAt:data.expiresAt,serverNow:data.serverNow,started});
   setRemaining(quizSecondsLeft(data.expiresAt,data.serverNow,performance.now()-started));
   setRequestKey(`quiz_${randomUUID()}`);
   setDraftRevision(saved.draft?.revision||0);
   const offline=await readOfflineQuiz();setQuizHash(saved.quizHash);
   const restored=offline?.quizId===key&&offline.quizHash===saved.quizHash&&offline.serverRevision===(saved.draft?.revision||0)?offline.answers:saved.draft?.answers;
   setAnswers(restored?.map(value=>value===null?-1:value)||Array(data.quiz.questions.length).fill(-1));
  }catch(e){onError(e);}finally{setBusy(false);}
 },[busy,locale,onError]);
 async function saveDraft(){if(!id||busy)return;setBusy(true);try{const saved=draftSchema.parse(await request(`/api/mobile/v1/student/quizzes/${encodeURIComponent(id)}/draft`,locale,{method:'POST',body:JSON.stringify({revision:draftRevision,answers:answers.map(value=>value<0?null:value)})}));setDraftRevision(saved.draft?.revision||0);setNotice(t.saved);}catch(e){onError(e);}finally{setBusy(false);}}
 async function submit(){if(!quiz||!id||busy||uncertain)return;setBusy(true);try{const data=result.parse(await request(`/api/mobile/v1/student/quizzes/${encodeURIComponent(id)}/attempt`,locale,{method:'POST',body:JSON.stringify({action:'submit',requestKey,answers:answers.map(value=>value<0?null:value)})}));setNotice(`${data.attempt.score} / ${data.attempt.total}`);setQuiz(null);setId(null);setRevision(v=>v+1);}catch(e){setUncertain(true);setNotice(t.unknown);onError(e);}finally{setBusy(false);}}
 return <View style={{gap:12}}><Text accessibilityRole="header" style={{color:c.text,fontSize:22,fontWeight:'700'}}>{t.title}</Text><Pressable accessibilityRole="button" onPress={()=>{setQuiz(null);setId(null);setUncertain(false);setRevision(v=>v+1);}} style={{minHeight:48,padding:12}}><Text style={{color:c.text}}>{t.refresh}</Text></Pressable>{notice?<Text accessibilityRole="alert" style={{color:c.text}}>{notice}</Text>:null}{items?.map(item=><View key={item.id} style={{backgroundColor:c.surface,padding:16,borderRadius:20,gap:8}}><Text style={{color:c.text,fontWeight:'600'}}>{item.title}</Text>{item.attempts.map(attempt=><Text key={attempt.id} style={{color:c.muted}}>{attempt.score} / {attempt.total}</Text>)}<Pressable accessibilityRole="button" disabled={busy} onPress={()=>Alert.alert(t.start,item.timeLimitSeconds?t.timed:item.title,[{text:t.cancel,style:'cancel'},{text:t.start,onPress:()=>void open(item.id)}])} style={{minHeight:48,justifyContent:'center'}}><Text style={{color:c.accent}}>{t.start}{item.timeLimitSeconds?` · ${item.timeLimitSeconds}s`:''}</Text></Pressable></View>)}{items?.length===0?<Text style={{color:c.muted}}>{t.empty}</Text>:null}<Text style={{color:c.muted,lineHeight:22}}>{t.offlineHint}</Text>{quiz&&remaining!==null?<Text accessibilityLiveRegion="polite" style={{color:c.accent,fontSize:22}}>{new Intl.NumberFormat(locale).format(remaining)}s</Text>:null}{quiz?.questions.map((question,index)=><View key={index} style={{gap:8,padding:16,backgroundColor:c.surface,borderRadius:20}}><Text style={{color:c.text}}>{question.question}</Text>{question.options.map((option,value)=><Pressable key={value} accessibilityRole="radio" accessibilityState={{selected:answers[index]===value}} disabled={busy} onPress={()=>{const next=answers.map((answer,i)=>i===index?value:answer);setAnswers(next);if(id&&quizHash)void saveOfflineQuiz({quizId:id,quizHash,serverRevision:draftRevision,answers:next.map(answer=>answer<0?null:answer)}).catch(onError);}} style={{minHeight:48,padding:12,borderWidth:1,borderColor:answers[index]===value?c.accent:c.border,borderRadius:12}}><Text style={{color:c.text}}>{option}</Text></Pressable>)}</View>)}{quiz?<><Pressable accessibilityRole="button" disabled={busy||remaining===0} onPress={()=>void saveDraft()} style={{minHeight:48,padding:12}}><Text style={{color:c.text}}>{t.saveDraft}</Text></Pressable><Pressable accessibilityRole="button" disabled={busy||uncertain||remaining===0||!answers.length||(remaining===null&&answers.some(value=>value<0))} onPress={()=>Alert.alert(t.submit,'',[{text:t.cancel,style:'cancel'},{text:t.submit,onPress:()=>void submit()}])} style={{minHeight:48,padding:12}}><Text style={{color:c.accent}}>{t.submit}</Text></Pressable></>:null}</View>;
}








