import {useState} from 'react';
import {View} from 'react-native';
import {request} from '../api';
import type {Locale} from '../i18n';
import {space} from '../design';
import {AppText,Button,Field,Sheet} from '../ui/kit';
import {Labeled} from '../ui/forms';

const copy={fa:{name:'نام',email:'ایمیل',phone:'تلفن',company:'شرکت',save:'ذخیره در CRM',cancel:'انصراف',add:'مشتری جدید',edit:'ویرایش مشخصات',title:'مشتری جدید',editTitle:'ویرایش مشتری',note:'با ذخیره، این مشخصات در CRM فضای کاری فعلی ثبت می‌شود.'},en:{name:'Name',email:'Email',phone:'Phone',company:'Company',save:'Save to CRM',cancel:'Cancel',add:'New contact',edit:'Edit details',title:'New contact',editTitle:'Edit contact',note:'Saving stores these details in the current workspace CRM.'},tr:{name:'Ad',email:'E-posta',phone:'Telefon',company:'Şirket',save:'CRM’ye kaydet',cancel:'Vazgeç',add:'Yeni kişi',edit:'Bilgileri düzenle',title:'Yeni kişi',editTitle:'Kişiyi düzenle',note:'Kaydettiğinde bu bilgiler mevcut çalışma alanının CRM’ine eklenir.'}};
type Contact={id:string;name:string;phone?:string|null;email?:string|null;company?:string|null};

/** A trigger button plus a sheet form; creates a contact, or edits `contact` when given. */
export function ContactEditor({locale,onError,onSaved,contact}:{locale:Locale;onError:(err:unknown)=>void;onSaved:()=>void;contact?:Contact}){
 const t=copy[locale];
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[name,setName]=useState(''),[email,setEmail]=useState(''),[phone,setPhone]=useState(''),[company,setCompany]=useState(''),[requestKey,setRequestKey]=useState<string>();
 function show(){setName(contact?.name||'');setEmail(contact?.email||'');setPhone(contact?.phone||'');setCompany(contact?.company||'');setRequestKey(undefined);setOpen(true);}
 async function save(){if(busy||!name.trim())return;setBusy(true);const key=requestKey||`crm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;setRequestKey(key);try{await request('/api/mobile/v1/crm',locale,{method:'POST',body:JSON.stringify({action:contact?'contact.update':'contact.create',requestKey:key,...(contact?{id:contact.id}:{}),data:{name:name.trim(),email:email.trim(),phone:phone.trim(),company:company.trim()}})});setOpen(false);setRequestKey(undefined);onSaved();}catch(err){onError(err);}finally{setBusy(false);}}
 const edit=(set:(v:string)=>void)=>(v:string)=>{set(v);setRequestKey(undefined);};
 return <>
  <Button label={contact?t.edit:t.add} icon={contact?'create-outline':'person-add-outline'} variant={contact?'ghost':'primary'} onPress={show}/>
  <Sheet visible={open} onClose={()=>setOpen(false)} title={contact?t.editTitle:t.title}>
   <Labeled label={t.name}><Field accessibilityLabel={t.name} value={name} onChangeText={edit(setName)} maxLength={160} editable={!busy} autoComplete="name"/></Labeled>
   <Labeled label={t.phone}><Field accessibilityLabel={t.phone} value={phone} onChangeText={edit(setPhone)} maxLength={40} editable={!busy} keyboardType="phone-pad" style={{textAlign:'left',writingDirection:'ltr'}}/></Labeled>
   <Labeled label={t.email}><Field accessibilityLabel={t.email} value={email} onChangeText={edit(setEmail)} maxLength={160} editable={!busy} autoCapitalize="none" keyboardType="email-address" style={{textAlign:'left',writingDirection:'ltr'}}/></Labeled>
   <Labeled label={t.company}><Field accessibilityLabel={t.company} value={company} onChangeText={edit(setCompany)} maxLength={160} editable={!busy}/></Labeled>
   <AppText variant="tiny" tone="faint">{t.note}</AppText>
   <View style={{gap:space.sm}}><Button label={t.save} icon="checkmark" busy={busy} disabled={!name.trim()} onPress={()=>void save()}/><Button label={t.cancel} variant="ghost" onPress={()=>setOpen(false)}/></View>
  </Sheet>
 </>;
}
