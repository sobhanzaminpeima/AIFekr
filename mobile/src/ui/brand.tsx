import type {ReactNode} from 'react';
import {Image,Pressable,StyleSheet,View,type ImageSourcePropType,type StyleProp,type ViewStyle} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {fonts,radius,space} from '../design';
import {AppText,Icon,tap,type IconName} from './kit';
import {useTheme} from './theme';

// FIKA portraits cropped from the brand character sheet (assets/fika).
export const fikaImages={
 hero:require('../../assets/fika/hero.jpg') as ImageSourcePropType,
 neutral:require('../../assets/fika/face-neutral.jpg') as ImageSourcePropType,
 smile:require('../../assets/fika/face-smile.jpg') as ImageSourcePropType,
 thinking:require('../../assets/fika/face-thinking.jpg') as ImageSourcePropType,
 confident:require('../../assets/fika/face-confident.jpg') as ImageSourcePropType,
};

/** Warm orange wash used behind hero content; it fades to the screen colour. */
export function Glow({style,strength=.35}:{style?:StyleProp<ViewStyle>;strength?:number}){
 return <LinearGradient pointerEvents="none" colors={[`rgba(255,107,0,${strength})`,'rgba(255,107,0,0)']} start={{x:.5,y:0}} end={{x:.5,y:1}} style={[StyleSheet.absoluteFill,style]}/>;
}

/** Card with a subtle orange-to-graphite gradient and an orange hairline, for featured content. */
export function GradientCard({children,style,onPress,accessibilityLabel}:{children:ReactNode;style?:StyleProp<ViewStyle>;onPress?:()=>void;accessibilityLabel?:string}){
 const {c,dark}=useTheme();
 const body=<LinearGradient colors={dark?['#3A2414','#292D33']:['#FFE7D6','#FFFFFF']} start={{x:0,y:0}} end={{x:1,y:1}} style={[s.gradient,{borderColor:dark?'rgba(255,107,0,.35)':c.border},style]}>{children}</LinearGradient>;
 if(!onPress)return body;
 return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={()=>{tap();onPress();}} style={({pressed})=>({opacity:pressed?.9:1,transform:[{scale:pressed?.99:1}]})}>{body}</Pressable>;
}

export function FikaAvatar({size=40,mood='neutral',ring=true}:{size?:number;mood?:'neutral'|'smile'|'thinking'|'confident';ring?:boolean}){
 const {c}=useTheme();
 return <View style={{width:size,height:size,borderRadius:size/2,padding:ring?2:0,backgroundColor:ring?c.accent:'transparent'}}>
  <Image accessibilityIgnoresInvertColors source={fikaImages[mood]} style={{width:'100%',height:'100%',borderRadius:size/2,borderWidth:ring?2:0,borderColor:c.bg}}/>
 </View>;
}

export function StatTile({icon,value,label,onPress}:{icon:IconName;value:string;label:string;onPress?:()=>void}){
 const {c}=useTheme();
 return <Pressable accessibilityRole={onPress?'button':undefined} accessibilityLabel={`${value} ${label}`} disabled={!onPress} onPress={()=>{tap();onPress?.();}} style={({pressed})=>[s.stat,{backgroundColor:c.surface,opacity:pressed?.85:1}]}>
  <View style={[s.statIcon,{backgroundColor:c.soft}]}><Icon name={icon} size={16} color={c.accent}/></View>
  <AppText variant="title" weight="bold">{value}</AppText>
  <AppText variant="tiny" tone="muted" numberOfLines={1}>{label}</AppText>
 </Pressable>;
}

/** Brand mark: "AI" + orange "Fekr", with an optional warm halo for splash/login. */
export function BrandMark({size=28,halo}:{size?:number;halo?:boolean}){
 const {c}=useTheme();
 return <View style={{alignItems:'center',justifyContent:'center'}}>
  {halo?<LinearGradient pointerEvents="none" colors={['rgba(255,107,0,.45)','rgba(255,107,0,0)']} style={{position:'absolute',width:size*6,height:size*3,borderRadius:size*3}}/>:null}
  <AppText align="center" style={{fontSize:size,lineHeight:size*1.4,fontFamily:fonts.bold,color:c.text,writingDirection:'ltr'}}>AI<AppText style={{fontSize:size,lineHeight:size*1.4,fontFamily:fonts.bold,color:c.accent}}>Fekr</AppText></AppText>
 </View>;
}

export function MenuRow({icon,label,detail,onPress,danger}:{icon:IconName;label:string;detail?:string;onPress:()=>void;danger?:boolean}){
 const {c,rtl}=useTheme();
 return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={()=>{tap();onPress();}} style={({pressed})=>[s.menu,{flexDirection:rtl?'row-reverse':'row',backgroundColor:pressed?c.raised:'transparent'}]}>
  <View style={[s.menuIcon,{backgroundColor:danger?c.raised:c.soft}]}><Icon name={icon} size={18} color={danger?c.danger:c.accent}/></View>
  <AppText style={{flex:1}} tone={danger?'danger':'text'}>{label}</AppText>
  {detail?<AppText variant="caption" tone="muted">{detail}</AppText>:null}
  <Icon name="chevron-forward" size={16} color={c.faint} mirror/>
 </Pressable>;
}

const s=StyleSheet.create({
 gradient:{borderRadius:radius.lg,padding:space.lg,gap:space.sm,borderWidth:1,overflow:'hidden'},
 stat:{flex:1,borderRadius:radius.md,padding:space.md,gap:2,minWidth:96},
 statIcon:{width:28,height:28,borderRadius:9,alignItems:'center',justifyContent:'center',marginBottom:space.xs},
 menu:{alignItems:'center',gap:space.md,paddingVertical:space.md,paddingHorizontal:space.sm,borderRadius:radius.md},
 menuIcon:{width:36,height:36,borderRadius:12,alignItems:'center',justifyContent:'center'},
});
