import {useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Pressable,Text,View} from 'react-native';
import {File,Paths} from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {shareableMediaUrl,boundedBytes} from '../mediaExport';
import type {Locale} from '../i18n';
const copy={fa:{share:'ذخیره یا اشتراک‌گذاری',cancel:'لغو دانلود',error:'دانلود یا اشتراک‌گذاری انجام نشد.'},en:{share:'Save or share',cancel:'Cancel download',error:'Download or sharing failed.'},tr:{share:'Kaydet veya paylaş',cancel:'İndirmeyi iptal et',error:'İndirme veya paylaşma başarısız.'}};
export function MediaShare({url,type,locale,color}:{url:string;type:'image'|'video'|'music';locale:Locale;color:string}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const abort=useRef<AbortController|null>(null);const mounted=useRef(true);const t=copy[locale];
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;abort.current?.abort();};},[]);
 async function share(){if(busy||!shareableMediaUrl(url))return;setBusy(true);setError('');const controller=new AbortController();abort.current=controller;const timeout=setTimeout(()=>controller.abort(),120000);let file:File|undefined;
 try{if(!await Sharing.isAvailableAsync())throw new Error('Sharing unavailable');const limit=type==='video'?100*1024*1024:25*1024*1024;let bytes:Uint8Array;let mime:string;if(url.startsWith('data:')){mime=url.slice(5,url.indexOf(';'));const encoded=url.split(',')[1];if(encoded.length>limit*4/3+4)throw new Error('File too large');bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));}else{const response=await fetch(url,{credentials:'omit',redirect:'error',signal:controller.signal});mime=response.headers.get('Content-Type')?.split(';')[0]||({image:'image/png',video:'video/mp4',music:'audio/mpeg'}[type]);bytes=await boundedBytes(response,limit);}if(controller.signal.aborted||!mounted.current)return;const extension=mime==='image/jpeg'?'jpg':mime==='image/webp'?'webp':type==='image'?'png':type==='video'?'mp4':'mp3';file=new File(Paths.cache,`aifekr-share-${Date.now()}.${extension}`);file.create();file.write(bytes);await Sharing.shareAsync(file.uri,{mimeType:mime,dialogTitle:t.share});}catch{if(mounted.current)setError(t.error);}finally{clearTimeout(timeout);abort.current=null;if(file?.exists)file.delete();if(mounted.current)setBusy(false);}}
 return <View style={{gap:8}}><Pressable accessibilityRole="button" disabled={!shareableMediaUrl(url)} onPress={()=>busy?abort.current?.abort():void share()} style={{minHeight:48,justifyContent:'center'}}><Text style={{color}}>{busy?t.cancel:t.share}</Text></Pressable>{busy?<ActivityIndicator color="#FF6B00"/>:null}{error?<Text accessibilityRole="alert" style={{color}}>{error}</Text>:null}</View>;
}
