import {Fragment,type ReactNode} from 'react';
import {ScrollView,Text,View} from 'react-native';
import {fonts,radius,space,type} from '../design';
import {useTheme} from './theme';

type Block={kind:'p'|'h'|'li'|'ol'|'code'|'quote';text:string;n?:number};

/**
 * Small Markdown subset for FIKA answers: headings, bullet and numbered lists,
 * fenced code, quotes, **bold** and `inline code`. Written in-house so every
 * line can follow its own direction (Persian answers often quote English code).
 */
export function parseBlocks(source:string):Block[]{
 const out:Block[]=[];const lines=source.replace(/\r\n/g,'\n').split('\n');let code:string[]|null=null;let para:string[]=[];
 const flush=()=>{if(para.length){out.push({kind:'p',text:para.join(' ')});para=[];}};
 for(const line of lines){
  if(/^```/.test(line.trim())){if(code){out.push({kind:'code',text:code.join('\n')});code=null;}else{flush();code=[];}continue;}
  if(code){code.push(line);continue;}
  const h=line.match(/^#{1,4}\s+(.*)$/),li=line.match(/^\s*[-*•]\s+(.*)$/),ol=line.match(/^\s*(\d+)[.)]\s+(.*)$/),q=line.match(/^>\s?(.*)$/);
  if(!line.trim()){flush();continue;}
  if(h){flush();out.push({kind:'h',text:h[1]});}
  else if(li){flush();out.push({kind:'li',text:li[1]});}
  else if(ol){flush();out.push({kind:'ol',text:ol[2],n:Number(ol[1])});}
  else if(q){flush();out.push({kind:'quote',text:q[1]});}
  else para.push(line.trim());
 }
 if(code)out.push({kind:'code',text:code.join('\n')});flush();
 return out;
}

const rtlChars=/[֐-ࣿ]/;
const dir=(text:string)=>rtlChars.test(text)?'rtl' as const:'ltr' as const;

function Inline({text,color,codeBg}:{text:string;color:string;codeBg:string}){
 const parts=text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
 return <>{parts.map((part,i)=>part.startsWith('**')&&part.endsWith('**')?<Text key={i} style={{fontFamily:fonts.bold,color}}>{part.slice(2,-2)}</Text>:part.startsWith('`')&&part.endsWith('`')?<Text key={i} style={{fontFamily:'monospace',backgroundColor:codeBg,color}}>{` ${part.slice(1,-1)} `}</Text>:<Fragment key={i}>{part}</Fragment>)}</>;
}

export function Markdown({text}:{text:string}){
 const {c}=useTheme();
 const blocks=parseBlocks(text);
 const line=(t:string):ReactNode=><Inline text={t} color={c.text} codeBg={c.raised}/>;
 return <View style={{gap:space.sm}}>{blocks.map((b,i)=>{
  const d=dir(b.text),align=d==='rtl'?'right' as const:'left' as const,row=d==='rtl'?'row-reverse' as const:'row' as const;
  const base={...type.body,fontFamily:fonts.regular,color:c.text,textAlign:align,writingDirection:d};
  if(b.kind==='code')return <ScrollView key={i} horizontal style={{backgroundColor:c.bg,borderRadius:radius.sm}} contentContainerStyle={{padding:space.md}}><Text selectable style={{fontFamily:'monospace',fontSize:13,lineHeight:20,color:c.text}}>{b.text}</Text></ScrollView>;
  if(b.kind==='h')return <Text key={i} selectable style={[base,type.title,{fontFamily:fonts.bold}]}>{line(b.text)}</Text>;
  if(b.kind==='quote')return <View key={i} style={{borderColor:c.accent,[d==='rtl'?'borderRightWidth':'borderLeftWidth']:3,paddingHorizontal:space.md}}><Text selectable style={[base,{color:c.muted}]}>{line(b.text)}</Text></View>;
  if(b.kind==='li'||b.kind==='ol')return <View key={i} style={{flexDirection:row,gap:space.sm}}><Text style={[base,{color:c.accent}]}>{b.kind==='li'?'•':`${b.n}.`}</Text><Text selectable style={[base,{flex:1}]}>{line(b.text)}</Text></View>;
  return <Text key={i} selectable style={base}>{line(b.text)}</Text>;
 })}</View>;
}
