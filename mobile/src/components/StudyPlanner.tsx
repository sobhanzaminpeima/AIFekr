import {useEffect,useState} from 'react';
import {Alert,Pressable,Text,TextInput,View} from 'react-native';
import {randomUUID} from 'expo-crypto';
import {ApiError,request} from '../api';
import {plannerSchema,type PlannerSnapshot} from '../planner';
import {plannerCopy} from '../plannerCopy';
import {changeOfflineState,readOfflineState} from '../offlineVault';
import {onOfflineChange,queuePlannerMutation,submitPlannerMutation,syncPlannerQueue} from '../offlinePlanner';
import {DateTimeField} from './DateTimeField';
import type {Locale} from '../i18n';
import type {Palette} from '../design';
function PlannerButton({label,onPress,c,busy=false,disabled=false}:{label:string;onPress:()=>void;c:Palette;busy?:boolean;disabled?:boolean}){
 return <Pressable accessibilityRole="button" accessibilityState={{disabled:busy||disabled}} disabled={busy||disabled} onPress={onPress} style={{minHeight:48,padding:12,borderWidth:1,borderColor:c.border,borderRadius:12}}><Text style={{color:c.text}}>{label}</Text></Pressable>;
}
export function StudyPlanner({courseId,courseName,locale,palette:c,onError}:{courseId:string;courseName?:string;locale:Locale;palette:Palette;onError:(e:unknown)=>void}){
 const t=plannerCopy[locale];
 const [data,setData]=useState<PlannerSnapshot|null>(null),[mode,setMode]=useState<'exam'|'task'>('exam'),[editing,setEditing]=useState<{id:string;version:string}|null>(null);
 const [now,setNow]=useState(()=>Date.now()),[date,setDate]=useState(()=>new Date(Date.now()+86400000)),[title,setTitle]=useState(''),[description,setDescription]=useState(''),[hasDate,setHasDate]=useState(true),[priority,setPriority]=useState(2),[taskType,setTaskType]=useState<'study'|'assignment'>('study'),[completed,setCompleted]=useState(false);
 const [busy,setBusy]=useState(false),[revision,setRevision]=useState(0),[uncertain,setUncertain]=useState(false),[cachedAt,setCachedAt]=useState<string|null>(null);
 useEffect(()=>onOfflineChange(()=>setRevision(value=>value+1)),[]);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{let active=true;
  async function load(){try{const parsed=plannerSchema.parse(await request('/api/mobile/v1/student/planner?courseId='+encodeURIComponent(courseId),locale));if(!active)return;setData(parsed);setCachedAt(null);
   await changeOfflineState(state=>{if(!state.planners[courseId]&&Object.keys(state.planners).length>=10){const oldest=Object.entries(state.planners).sort(([,a],[,b])=>a.savedAt.localeCompare(b.savedAt))[0];delete state.planners[oldest[0]];}state.planners[courseId]={savedAt:new Date().toISOString(),data:parsed};});
  }catch(error){if(!active)return;if(!(error instanceof ApiError)){try{const snapshot=(await readOfflineState())?.planners[courseId];if(snapshot){setData(plannerSchema.parse(snapshot.data));setCachedAt(snapshot.savedAt);return;}}catch(storageError){onError(storageError);}}setData(null);onError(error);}}
  void load();return()=>{active=false;};
 },[courseId,locale,revision,onError]);
 function reset(){setEditing(null);setTitle('');setDescription('');setHasDate(true);setPriority(2);setCompleted(false);setDate(new Date(now+86400000));}
 async function mutate(payload:Record<string,unknown>){if(busy)return;setBusy(true);try{const admitted=await queuePlannerMutation({...payload,courseId,requestKey:'planner_'+randomUUID()});await submitPlannerMutation(admitted.body,locale);setUncertain(false);reset();if(payload.action==='plan.generate')setMode('task');setRevision(value=>value+1);}catch(error){setUncertain(true);onError(error);}finally{setBusy(false);}}
 function confirm(label:string,payload:Record<string,unknown>){Alert.alert(t.confirm,label,[{text:t.cancel,style:'cancel'},{text:t.save,onPress:()=>void mutate(payload)}]);}
 async function sync(){setBusy(true);try{await syncPlannerQueue(locale);setRevision(value=>value+1);setUncertain(false);}catch(error){onError(error);}finally{setBusy(false);}}
 function save(){const base={title,...(editing||{})};confirm(title,mode==='exam'?{...base,action:editing?'exam.update':'exam.create',examAt:date.toISOString()}:{...base,action:editing?'task.update':'task.create',description,taskType,priority,dueAt:hasDate?date.toISOString():null,...(editing?{completed}:{})});}
 const inputStyle={color:c.text,minHeight:48,padding:12,borderWidth:1,borderColor:c.border,borderRadius:12,textAlign:locale==='fa'?'right' as const:'left' as const};
 return <View style={{gap:12}}>
  <Text accessibilityRole="header" style={{color:c.text,fontSize:22,fontWeight:'700'}}>{t.heading}{courseName?' · '+courseName:''}</Text>
  <Text style={{color:c.muted,lineHeight:24}}>{locale==='fa'?'تغییرات تأییدشده، روی دستگاه به‌صورت رمز‌شده ذخیره و پس از اتصال همگام می‌شوند.':locale==='tr'?'Onaylanmış değişiklikler cihazda şifrelenir ve bağlantı geldiğinde eşitlenir.':'Confirmed changes are encrypted on this device and sync when connected.'}</Text>
  {cachedAt?<Text style={{color:c.muted}}>{locale==='fa'?'نسخهٔ آفلاین':locale==='tr'?'Çevrimdışı kopya':'Offline copy'} · {new Intl.DateTimeFormat(locale,{dateStyle:'short',timeStyle:'short'}).format(new Date(cachedAt))}</Text>:null}
  <PlannerButton label={t.refresh} onPress={()=>setRevision(value=>value+1)} c={c} busy={busy}/>
  <View style={{flexDirection:locale==='fa'?'row-reverse':'row',gap:8}}><PlannerButton label={t.exam} onPress={()=>{setMode('exam');reset();}} c={c} busy={busy}/><PlannerButton label={t.task} onPress={()=>{setMode('task');reset();}} c={c} busy={busy}/></View>
  <PlannerButton label={t.new} onPress={reset} c={c} busy={busy}/>
  <TextInput accessibilityLabel={t.title} placeholder={t.title} placeholderTextColor={c.muted} value={title} editable={!busy} onChangeText={setTitle} maxLength={200} style={inputStyle}/>
  {mode==='task'?<><TextInput accessibilityLabel={t.description} placeholder={t.description} placeholderTextColor={c.muted} value={description} editable={!busy} onChangeText={setDescription} maxLength={4000} multiline style={[inputStyle,{minHeight:80}]}/>
   <View style={{gap:8}}><PlannerButton label={t.study} onPress={()=>setTaskType('study')} c={c} busy={busy}/><PlannerButton label={t.assignment} onPress={()=>setTaskType('assignment')} c={c} busy={busy}/><Text style={{color:c.text}}>{t.priority}: {priority} · {t[taskType]}</Text>{[1,2,3].map(value=><PlannerButton key={value} label={String(value)} onPress={()=>setPriority(value)} c={c} busy={busy}/>)}<PlannerButton label={hasDate?t.clearDate:t.setDate} onPress={()=>setHasDate(value=>!value)} c={c} busy={busy}/></View></>:null}
  {mode==='exam'||hasDate?<DateTimeField value={date} onChange={setDate} locale={locale} color={c.text} disabled={busy}/>:null}
  <PlannerButton label={t.save} onPress={save} c={c} busy={busy} disabled={!title.trim()}/>
  {uncertain?<><Text accessibilityRole="alert" style={{color:c.text}}>{t.uncertain}</Text><PlannerButton label={t.check} onPress={()=>void sync()} c={c} busy={busy}/></>:null}
  <Text style={{color:c.muted,lineHeight:24}}>{t.planHint}</Text>
  {mode==='exam'?data?.exams.map(exam=><View key={exam.id} style={{padding:16,gap:8,borderRadius:16,backgroundColor:c.surface}}><Text style={{color:c.text,fontWeight:'700'}}>{exam.title}</Text><Text style={{color:c.muted}}>{new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(exam.examAt))}</Text>
   <PlannerButton label={t.edit} onPress={()=>{setEditing({id:exam.id,version:exam.version});setTitle(exam.title);setDate(new Date(exam.examAt));}} c={c} busy={busy}/>
   <PlannerButton label={t.generate} onPress={()=>confirm(exam.title+'\n'+t.planHint,{action:'plan.generate',examId:exam.id,version:exam.version})} c={c} busy={busy} disabled={new Date(exam.examAt).getTime()<=now}/>
   <PlannerButton label={t.remove} onPress={()=>confirm(t.remove+' · '+exam.title,{action:'exam.delete',id:exam.id,version:exam.version})} c={c} busy={busy}/></View>):data?.tasks.map(task=><View key={task.id} style={{padding:16,gap:8,borderRadius:16,backgroundColor:c.surface}}><Text style={{color:c.text,fontWeight:'700',textDecorationLine:task.completedAt?'line-through':'none'}}>{task.title}</Text><Text style={{color:c.muted}}>{task.description}</Text>{task.dueAt?<Text style={{color:c.muted}}>{new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(task.dueAt))}</Text>:null}
   <PlannerButton label={t.edit} onPress={()=>{setEditing({id:task.id,version:task.version});setTitle(task.title);setDescription(task.description);setPriority(task.priority);setTaskType(task.taskType);setHasDate(!!task.dueAt);setCompleted(!!task.completedAt);setDate(task.dueAt?new Date(task.dueAt):new Date(now));}} c={c} busy={busy}/>
   <PlannerButton label={task.completedAt?t.reopen:t.done} onPress={()=>confirm(task.title,{action:'task.update',id:task.id,version:task.version,title:task.title,description:task.description,taskType:task.taskType,priority:task.priority,dueAt:task.dueAt,completed:!task.completedAt})} c={c} busy={busy}/>
   <PlannerButton label={t.remove} onPress={()=>confirm(t.remove+' · '+task.title,{action:'task.delete',id:task.id,version:task.version})} c={c} busy={busy}/></View>)}
 </View>;
}
