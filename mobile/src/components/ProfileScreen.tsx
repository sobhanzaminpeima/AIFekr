import {useState} from 'react';
import {Linking,StyleSheet,View} from 'react-native';
import type {Locale} from '../i18n';
import {radius,space} from '../design';
import {AppText,Button,Chip,Row,Sheet} from '../ui/kit';
import {GradientCard,MenuRow} from '../ui/brand';
import {numberFormat,useTheme} from '../ui/theme';
import {AccountPanel} from './AccountPanel';
import {NotificationsScreen} from './NotificationsScreen';
import {DeviceLockSettings} from './DeviceLock';
import {DeviceSessions} from './DeviceSessions';
import {OfflineLibrary} from './OfflineLibrary';

type Mode='dark'|'light'|'system';
type Panel='account'|'notifications'|'security'|'language'|'appearance'|'offline'|null;
const copy={
 fa:{credits:'اعتبار در دسترس',buy:'خرید اعتبار و اشتراک',plan:'طرح',account:'حساب و مصرف',notifications:'اعلان‌ها',security:'امنیت و دستگاه‌ها',language:'زبان',appearance:'ظاهر',offline:'محتوای آفلاین',help:'راهنما و پشتیبانی',logout:'خروج از حساب',modes:{dark:'تیره',light:'روشن',system:'مطابق گوشی'},langs:{fa:'فارسی',en:'English',tr:'Türkçe'}},
 en:{credits:'Available credits',buy:'Buy credits and plans',plan:'Plan',account:'Account and usage',notifications:'Notifications',security:'Security and devices',language:'Language',appearance:'Appearance',offline:'Offline content',help:'Help and support',logout:'Sign out',modes:{dark:'Dark',light:'Light',system:'Match phone'},langs:{fa:'فارسی',en:'English',tr:'Türkçe'}},
 tr:{credits:'Kullanılabilir kredi',buy:'Kredi ve paket satın al',plan:'Paket',account:'Hesap ve kullanım',notifications:'Bildirimler',security:'Güvenlik ve cihazlar',language:'Dil',appearance:'Görünüm',offline:'Çevrimdışı içerik',help:'Yardım ve destek',logout:'Çıkış yap',modes:{dark:'Koyu',light:'Açık',system:'Telefona uy'},langs:{fa:'فارسی',en:'English',tr:'Türkçe'}},
} as const;

/** The "You" tab: a profile header, the credit card and a menu; each existing settings component opens in a sheet. */
export function ProfileScreen({locale,account,mode,onMode,onLocale,onLogout,onCourse,onError}:{locale:Locale;account:{name:string;plan:string;displayCredits:number}|null;mode:Mode;onMode:(m:Mode)=>void;onLocale:(l:Locale)=>void;onLogout:()=>void;onCourse:(id:string)=>void;onError:(err:unknown)=>void}){
 const {c}=useTheme();const t=copy[locale];const [panel,setPanel]=useState<Panel>(null);
 const name=account?.name||'AIFekr';
 const close=()=>setPanel(null);
 // Purchases happen on the web checkout (Zarinpal), which works for Iranian cards; store billing is not used here.
 const buy=()=>{void Linking.openURL(`https://aifekr.com/pricing`).catch(onError);};
 return <View style={{gap:space.xl}}>
  <Row gap={space.md}>
   <View style={[s.avatar,{backgroundColor:c.raised,borderColor:c.accent}]}><AppText variant="title" weight="bold" align="center">{name.slice(0,1).toUpperCase()}</AppText></View>
   <View style={{flex:1,gap:4}}><AppText variant="title" weight="bold" numberOfLines={1}>{name}</AppText>{account?<Chip label={`${t.plan}: ${account.plan}`} icon="ribbon-outline"/>:null}</View>
  </Row>
  <GradientCard>
   <AppText variant="caption" tone="muted">{t.credits}</AppText>
   <AppText variant="display" weight="bold">{account?numberFormat(locale,account.displayCredits):'…'}</AppText>
   <Button label={t.buy} icon="flash" onPress={buy}/>
  </GradientCard>
  <View style={[s.menu,{backgroundColor:c.surface}]}>
   <MenuRow icon="person-outline" label={t.account} onPress={()=>setPanel('account')}/>
   <MenuRow icon="notifications-outline" label={t.notifications} onPress={()=>setPanel('notifications')}/>
   <MenuRow icon="shield-checkmark-outline" label={t.security} onPress={()=>setPanel('security')}/>
   <MenuRow icon="language-outline" label={t.language} detail={t.langs[locale]} onPress={()=>setPanel('language')}/>
   <MenuRow icon="contrast-outline" label={t.appearance} detail={t.modes[mode]} onPress={()=>setPanel('appearance')}/>
   <MenuRow icon="cloud-offline-outline" label={t.offline} onPress={()=>setPanel('offline')}/>
   <MenuRow icon="help-buoy-outline" label={t.help} onPress={()=>{void Linking.openURL(`https://aifekr.com/contact`).catch(onError);}}/>
  </View>
  <View style={[s.menu,{backgroundColor:c.surface}]}><MenuRow icon="log-out-outline" label={t.logout} danger onPress={onLogout}/></View>
  <Sheet visible={panel==='account'} onClose={close} title={t.account}><AccountPanel locale={locale} palette={c} onError={onError}/></Sheet>
  <Sheet visible={panel==='notifications'} onClose={close} title={t.notifications}><NotificationsScreen locale={locale} color={c.text} surface={c.raised} onError={onError}/></Sheet>
  <Sheet visible={panel==='security'} onClose={close} title={t.security}><DeviceLockSettings locale={locale} color={c.text}/><DeviceSessions locale={locale} color={c.text} onError={onError}/></Sheet>
  <Sheet visible={panel==='offline'} onClose={close} title={t.offline}><OfflineLibrary locale={locale} color={c.text} onError={onError} onCourse={id=>{close();onCourse(id);}}/></Sheet>
  <Sheet visible={panel==='language'} onClose={close} title={t.language}>{(['fa','en','tr'] as Locale[]).map(l=><Button key={l} label={t.langs[l]} variant={l===locale?'primary':'secondary'} onPress={()=>{onLocale(l);close();}}/>)}</Sheet>
  <Sheet visible={panel==='appearance'} onClose={close} title={t.appearance}>{(['dark','light','system'] as Mode[]).map(m=><Button key={m} label={t.modes[m]} variant={m===mode?'primary':'secondary'} onPress={()=>{onMode(m);close();}}/>)}</Sheet>
 </View>;
}
const s=StyleSheet.create({
 avatar:{width:64,height:64,borderRadius:32,borderWidth:2,alignItems:'center',justifyContent:'center'},
 menu:{borderRadius:radius.lg,padding:space.sm},
});
