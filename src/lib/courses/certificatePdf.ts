import {createElement as h} from "react";
import {Document,Page,Text,View,Image,renderToBuffer,Font} from "@react-pdf/renderer";
import type {AiCourseCertificate} from "@prisma/client";
import {generateQrDataUrl} from "@/lib/utils/qrCode";
import {publicAppUrl} from "@/lib/utils/publicAppUrl";
import path from "node:path";
import type {Style} from "@react-pdf/types";
Font.register({family:'Vazirmatn',src:path.join(process.cwd(),'public/fonts/Vazirmatn-Regular.ttf')});
/** All fields originate in the verified server certificate snapshot. */
export async function certificatePdf(c:AiCourseCertificate){
 const url=`${publicAppUrl()}/verify-certificate/${c.verificationCode}`,qr=await generateQrDataUrl(url),clean=(s:string)=>s.replace(/[\u0000-\u001f\u007f]/g,' '),nameFont=/[^\x00-\x7f]/.test(c.studentName)?'Vazirmatn':'Times-Roman',courseFont=/[^\x00-\x7f]/.test(c.courseTitle)?'Vazirmatn':'Helvetica';
 const text=(value:string,style:Style={})=>h(Text,{style},value);
 return renderToBuffer(h(Document,{title:'AIFekr Certificate of Course Completion',author:'AIFekr'},h(Page,{size:'A4',orientation:'landscape',style:{padding:32,backgroundColor:'#faf9f6',color:'#202020',fontFamily:'Helvetica'}},h(View,{style:{borderWidth:1.5,borderColor:'#c69652',padding:34,height:'100%',position:'relative'}},
 text('AIFekr',{fontSize:27,fontWeight:700,letterSpacing:3,color:'#c56520'}),text('STUDENT ACADEMY',{fontSize:10,letterSpacing:2,marginTop:7}),
 h(View,{style:{marginTop:32,alignItems:'center'}},text('CERTIFICATE OF COMPLETION',{fontSize:30,fontFamily:'Times-Roman',letterSpacing:2}),text('This is to certify that',{fontSize:11,color:'#686868',marginTop:22}),text(clean(c.studentName),{fontSize:c.studentName.length>45?20:28,fontFamily:nameFont,marginTop:12,maxWidth:620,textAlign:'center'}),text('has successfully completed',{fontSize:11,color:'#686868',marginTop:16}),text(clean(c.courseTitle),{fontSize:c.courseTitle.length>65?17:23,fontFamily:courseFont,fontWeight:700,marginTop:12,textAlign:'center',maxWidth:610}),text(`${clean(c.learningArea)} · Version ${c.version}${c.durationMinutes?` · ${Math.round(c.durationMinutes/60*10)/10} hours`:''}`,{fontSize:11,color:'#686868',marginTop:10,fontFamily:/[^\x00-\x7f]/.test(c.learningArea)?'Vazirmatn':'Helvetica'})),
 h(View,{style:{position:'absolute',bottom:26,left:34,right:34,flexDirection:'row',justifyContent:'space-between',alignItems:'flex-end'}},h(View,{style:{maxWidth:560}},text(`Issued by AIFekr · ${c.issuedAt.toISOString().slice(0,10)}`,{fontSize:11}),text(`Certificate ID: ${c.id}`,{fontSize:8,color:'#686868',marginTop:8}),text(`Verify: ${url}`,{fontSize:7,color:'#686868',marginTop:6}),text('Verified course completion. This certificate does not confer an accredited academic degree.',{fontSize:7,color:'#686868',marginTop:12})),h(Image,{src:qr,style:{width:78,height:78}}))
 ))));
}
