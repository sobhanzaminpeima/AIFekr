import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useColorScheme, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ApiError, apiConfigurationError, contacts, hasSession, logout, profile, request, signIn } from '../api';
import { Locale, strings } from '../i18n';
import { router, useLocalSearchParams } from 'expo-router';
import { WorkspacePicker } from './WorkspacePicker';
import { DeviceSessions } from './DeviceSessions';
import { ChatScreen } from './ChatScreen';
import { StudioScreen } from './StudioScreen';
import { NotificationsScreen } from './NotificationsScreen';
import { WorkResources } from './WorkResources';
import { ContactEditor } from './ContactEditor';
import { ContactDetail } from './ContactDetail';
import { FitnessScreen } from './FitnessScreen';
import { DeviceLockSettings } from './DeviceLock';
import {readPreferences,updatePreferences} from '../preferences';
import {palettes,tabSymbols} from '../design';
import {HomeScreen} from './HomeScreen';
import {StudentScreen} from './StudentScreen';
import {AccountPanel} from './AccountPanel';
import {GlobalSearch} from './GlobalSearch';
import {OfflineSync} from './OfflineSync';
import {OfflineLibrary} from './OfflineLibrary';

type Tab = 'home' | 'fika' | 'create' | 'work' | 'you';
type Account = {name:string; plan:string; displayCredits:number};
type Contact = {id:string; name:string; email?:string|null; phone?:string|null};
export default function App() {
  const [locale,setLocale] = useState<Locale>('fa');
  const [mode,setMode] = useState<'dark'|'light'|'system'>('system');
  useEffect(()=>{let active=true;readPreferences().then(p=>{if(active){setLocale(p.locale);setMode(p.mode);}}).catch(()=>{});return()=>{active=false;};},[]);
  const system = useColorScheme(); const dark = mode === 'dark' || (mode === 'system' && system !== 'light');
  const c = dark ? palettes.dark : palettes.light;
  const t = strings[locale]; const rtl = locale === 'fa';
  const [signed,setSigned] = useState(false); const [ready,setReady] = useState(false);
  const params = useLocalSearchParams<{tab?:string;courseId?:string}>();
  const tab:Tab = ['home','fika','create','work','you'].includes(params.tab || '') ? params.tab as Tab : 'home';
  const setTab = (value:Tab) => router.setParams({tab:value});
  const [contactQuery,setContactQuery]=useState('');const [email,setEmail] = useState(''); const [password,setPassword] = useState('');
  const [account,setAccount] = useState<Account|null>(null); const [people,setPeople] = useState<Contact[]>([]);const [selectedContact,setSelectedContact]=useState<string|null>(null);
  const [busy,setBusy] = useState(false); const [error,setError] = useState(''); const [revision,setRevision] = useState(0);const [accountType,setAccountType]=useState('PERSONAL');const [showFitness,setShowFitness]=useState(false);const [showStudent,setShowStudent]=useState(false);
  const tx = {color:c.text,textAlign:rtl?'right' as const:'left' as const};
  useEffect(()=>{
    const subscription=AppState.addEventListener('change',state=>{
      if(state==='active')setRevision(v=>v+1);
      else {setPeople([]);setAccount(null);}
    });
    return()=>subscription.remove();
  },[]);
  const handleError = useCallback((err:unknown)=>{
    if(err instanceof ApiError&&err.status===401){setSigned(false);setPeople([]);setAccount(null);setShowFitness(false);setShowStudent(false);setSelectedContact(null);setAccountType('PERSONAL');}
    setError(err instanceof ApiError?err.message:t.error);
  },[t.error]);
  useEffect(() => { hasSession().then(setSigned).catch(() => setError(t.error)).finally(() => setReady(true)); }, [t.error]);
  useEffect(() => {
    if (!signed || (tab !== 'home' && tab !== 'work')) return;
    if(tab==='work'&&(showStudent||showFitness||accountType==='FITNESS'))return;
    let active = true;
    // Clear the previous authorized response before fetching a new account/locale/tab.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBusy(true); setError(''); setAccount(null); setPeople([]);
    request(tab === 'home' ? '/api/user/profile' : '/api/crm/contacts',locale).then(data => {
      if (!active || AppState.currentState !== 'active') return;
      if (tab === 'home') {const dataProfile=profile.parse(data).user;setAccount(dataProfile);setAccountType(dataProfile.accountType||'PERSONAL');} else setPeople(contacts.parse(data).contacts);
    }).catch(err => {
      if (!active) return;
      if (err instanceof ApiError && err.status === 401) { setSigned(false); setAccount(null); setPeople([]); setError(t.expired); }
      else setError(err instanceof ApiError ? err.message : t.error);
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [signed,tab,locale,revision,t.error,t.expired,showFitness,showStudent,accountType]);
  const button = (label:string,action:()=>void,selected=false) => <Pressable accessibilityRole="button" accessibilityState={{disabled:busy,selected}} disabled={busy} onPress={action} style={[s.button,{backgroundColor:selected?'#FF6B00':c.surface,borderColor:c.border}]}><Text style={{color:selected?'#171719':c.text,fontWeight:'600'}}>{label}</Text></Pressable>;
  async function enter() {
    if (busy) return; setBusy(true); setError('');
    try { await signIn(email,password,locale); setPassword(''); setSigned(true); setTab('home'); }
    catch (err) { setError(err instanceof ApiError ? err.message : t.error); }
    finally { setBusy(false); }
  }
  async function leave() {
    setBusy(true); setError('');
    try { const result=await logout(locale); setSigned(false); setAccount(null); setPeople([]); setPassword('');setAccountType('PERSONAL');setShowFitness(false);setShowStudent(false);setSelectedContact(null);if(!result.revoked||result.localCleared===false)setError(t.error); }
    catch { setError(t.error); } finally { setBusy(false); }
  }
  return <SafeAreaProvider><SafeAreaView style={[s.root,{backgroundColor:c.bg}]}>
    <StatusBar style={dark?'light':'dark'} />
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS==='ios'?'padding':undefined}>
      <View style={[s.header,{flexDirection:rtl?'row-reverse':'row'}]}><Text accessibilityRole="header" style={[s.brand,{color:c.text}]}>AI<Text style={{color:'#FF6B00'}}>Fekr</Text></Text><Text style={{color:c.muted}}>NEO</Text></View>
      {(!signed||tab==='you')?<View style={s.languages}>{(['fa','en','tr'] as Locale[]).map(l=><React.Fragment key={l}>{button({fa:'فارسی',en:'English',tr:'Türkçe'}[l],()=>{setLocale(l);void updatePreferences({locale:l}).catch(handleError);if(signed)void request('/api/user/profile',l,{method:'PATCH',body:JSON.stringify({language:l})}).catch(handleError);},locale===l)}</React.Fragment>)}</View>:null}
      {error ? <View style={s.notice}><Text accessibilityRole="alert" style={{color:dark?'#FFB89C':'#9C2700'}}>{error}</Text>{signed && button(t.retry,()=>setRevision(v=>v+1))}</View>:null}
      {!ready || busy ? <ActivityIndicator accessibilityLabel={t.loading} color="#FF6B00" style={{margin:16}}/>:null}
      {ready && !signed ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
        {apiConfigurationError(locale)?<Text accessibilityRole="alert" style={{color:dark?'#FFB89C':'#9C2700',textAlign:rtl?'right':'left'}}>{apiConfigurationError(locale)}</Text>:null}
        <Text accessibilityRole="header" style={[s.title,tx]}>{t.welcome}</Text><Text style={[s.caption,tx]}>{t.pending}</Text>
        <Text style={tx}>{t.email}</Text><TextInput accessibilityLabel={t.email} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" editable={!busy} style={[s.input,{color:c.text,backgroundColor:c.surface,borderColor:c.border}]}/>
        <Text style={tx}>{t.password}</Text><TextInput accessibilityLabel={t.password} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" editable={!busy} style={[s.input,{color:c.text,backgroundColor:c.surface,borderColor:c.border}]} onSubmitEditing={()=>void enter()}/>
        {button(t.login,()=>void enter(),true)}
      </ScrollView>:ready && signed ? <View style={s.root}>
        {tab==='work'&&showStudent?<StudentScreen initialCourseId={params.courseId} locale={locale} palette={c} onError={handleError} onClose={()=>{setShowStudent(false);setTab('home');}}/>:tab==='work'&&(showFitness||accountType==='FITNESS')?<FitnessScreen locale={locale} color={c.text} surface={c.surface} onError={handleError} onClose={()=>{setShowFitness(false);setTab('home');}}/>:tab==='work'&&selectedContact?<ContactDetail id={selectedContact} locale={locale} color={c.text} surface={c.surface} onError={handleError} onClose={()=>{setSelectedContact(null);setRevision(v=>v+1);}} workspaceRevision={revision}/>:tab === 'work' ? <FlatList data={people.filter(person=>[person.name,person.email,person.phone].some(value=>value?.toLocaleLowerCase(locale).includes(contactQuery.trim().toLocaleLowerCase(locale))))} keyExtractor={item=>item.id} contentContainerStyle={s.content} ListHeaderComponent={<><WorkspacePicker locale={locale} textColor={c.text} surface={c.surface} onChange={()=>{setPeople([]);setAccount(null);setContactQuery('');setRevision(v=>v+1);}} onError={handleError}/><Pressable accessibilityRole="button" onPress={()=>setShowFitness(true)} style={{minHeight:48,justifyContent:"center"}}><Text style={{color:c.text}}>AIFekr FIT</Text></Pressable><ContactEditor locale={locale} color={c.text} onError={handleError} onSaved={()=>setRevision(v=>v+1)}/><WorkResources locale={locale} color={c.text} surface={c.surface} onError={handleError} workspaceRevision={revision}/><Text accessibilityRole="header" style={[s.title,tx]}>{t.contacts}</Text><TextInput accessibilityLabel={t.searchContacts} placeholder={t.searchContacts} placeholderTextColor={c.muted} value={contactQuery} onChangeText={setContactQuery} maxLength={100} style={[s.input,{color:c.text,borderColor:c.border,textAlign:rtl?'right':'left'}]}/></>} ListEmptyComponent={!busy&&!error?<Text style={tx}>{t.empty}</Text>:null} renderItem={({item})=><Pressable accessibilityRole="button" onPress={()=>setSelectedContact(item.id)} style={[s.card,{backgroundColor:c.surface,borderColor:c.border}]}><Text style={[s.subtitle,tx]}>{item.name}</Text><Text style={tx}>{item.email || item.phone || ''}</Text></Pressable>}/>:
        tab==='fika'?<ChatScreen locale={locale} color={c.text} surface={c.surface} onError={handleError}/>:
        tab==='create'?<StudioScreen locale={locale} color={c.text} surface={c.surface} onError={handleError}/>:
        <ScrollView contentContainerStyle={s.content}>
          <Text accessibilityRole="header" style={[s.title,tx]}>{t[tab]}</Text>
          {tab==='home'&&accountType!=='FITNESS'?<GlobalSearch key={locale+revision} locale={locale} color={c.text} surface={c.surface} onError={handleError} onContact={id=>{setSelectedContact(id);setShowStudent(false);setShowFitness(false);setTab('work');}}/>:null}
          {tab==='home'?<HomeScreen locale={locale} palette={c} account={account} onOpen={target=>{setSelectedContact(null);setShowFitness(target==='fitness');setShowStudent(target==='student');setTab(target==='fitness'||target==='student'?'work':target);}}/>:null}
          {tab==='you'?<><OfflineLibrary locale={locale} color={c.text} onError={handleError} onCourse={id=>{setShowStudent(true);setShowFitness(false);router.setParams({tab:'work',courseId:id});}}/><AccountPanel locale={locale} palette={c} onError={handleError}/><Text style={[s.subtitle,tx]}>{t.theme}</Text>{(['dark','light','system'] as const).map(m=><React.Fragment key={m}>{button(t[m],()=>{setMode(m);void updatePreferences({mode:m}).catch(handleError);},mode===m)}</React.Fragment>)}<DeviceLockSettings locale={locale} color={c.text}/><NotificationsScreen locale={locale} color={c.text} surface={c.surface} onError={handleError}/><DeviceSessions locale={locale} color={c.text} onError={handleError}/>{button(t.logout,()=>void leave())}</>:null}
        </ScrollView>}
        <View accessibilityRole="tablist" style={[s.nav,{backgroundColor:c.surface,borderColor:c.border,flexDirection:rtl?'row-reverse':'row'}]}>{(['home','fika','create','work','you'] as Tab[]).map(item=><Pressable key={item} accessibilityRole="tab" accessibilityState={{selected:tab===item}} onPress={()=>setTab(item)} style={s.tab}><Text accessibilityElementsHidden importantForAccessibility="no" style={{color:tab===item?c.accent:c.muted,fontSize:25,marginBottom:4}}>{tabSymbols[item]}</Text><Text style={{color:tab===item?c.accent:c.muted,fontSize:12,fontWeight:'600'}}>{t[item]}</Text></Pressable>)}</View>
      <OfflineSync locale={locale}/></View>:null}
    </KeyboardAvoidingView>
  </SafeAreaView></SafeAreaProvider>;
}
const s = StyleSheet.create({root:{flex:1},header:{padding:24,alignItems:'center',justifyContent:'space-between'},brand:{fontSize:28,fontWeight:'800'},languages:{flexDirection:'row',paddingHorizontal:16,gap:8},content:{padding:24,gap:16},title:{fontSize:30,fontWeight:'700',marginBottom:8},subtitle:{fontSize:20,fontWeight:'600'},caption:{fontSize:15,lineHeight:24},input:{minHeight:52,borderWidth:1,borderRadius:16,padding:16},button:{minHeight:48,borderWidth:1,borderRadius:16,paddingHorizontal:16,paddingVertical:12,alignItems:'center',justifyContent:'center'},card:{borderWidth:1,borderRadius:24,padding:24,gap:12,marginBottom:12},balance:{fontSize:42,fontWeight:'700'},notice:{padding:16,gap:8},nav:{borderTopWidth:1,padding:8},tab:{flex:1,minHeight:52,alignItems:'center',justifyContent:'center'}});
