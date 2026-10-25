import type {ComponentProps,ReactNode} from 'react';
import {ActivityIndicator,Modal,Platform,Pressable,ScrollView,StyleSheet,Text,TextInput,View,type StyleProp,type TextStyle,type ViewStyle} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {fonts,radius,space,type} from '../design';
import {useTheme} from './theme';

export type IconName=ComponentProps<typeof Ionicons>['name'];
// Haptics are a nicety: never let a missing engine (web, old devices) throw.
export const tap=()=>{if(Platform.OS!=='web')void Haptics.selectionAsync().catch(()=>{});};
export const success=()=>{if(Platform.OS!=='web')void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});};

type Variant=keyof typeof type;
export function AppText({children,variant='body',weight='regular',tone='text',align,style,selectable,numberOfLines,accessibilityRole}:{children:ReactNode;variant?:Variant;weight?:keyof typeof fonts;tone?:'text'|'muted'|'faint'|'accent'|'softText'|'danger'|'onAccent';align?:'auto'|'left'|'right'|'center';style?:StyleProp<TextStyle>;selectable?:boolean;numberOfLines?:number;accessibilityRole?:'header'|'alert'|'text'}){
 const {c,rtl}=useTheme();
 return <Text selectable={selectable} numberOfLines={numberOfLines} accessibilityRole={accessibilityRole} style={[type[variant],{fontFamily:fonts[weight],color:c[tone],textAlign:align??(rtl?'right':'left'),writingDirection:rtl?'rtl':'ltr'},style]}>{children}</Text>;
}

/** Icons that point "forward/back" follow reading direction. */
export function Icon({name,size=20,color,mirror}:{name:IconName;size?:number;color?:string;mirror?:boolean}){
 const {c,rtl}=useTheme();
 return <Ionicons name={name} size={size} color={color??c.text} style={mirror&&rtl?{transform:[{scaleX:-1}]}:undefined} accessibilityElementsHidden importantForAccessibility="no"/>;
}

export function Button({label,onPress,variant='primary',icon,busy,disabled,style,accessibilityHint}:{label:string;onPress:()=>void;variant?:'primary'|'secondary'|'ghost'|'danger';icon?:IconName;busy?:boolean;disabled?:boolean;style?:StyleProp<ViewStyle>;accessibilityHint?:string}){
 const {c,rtl}=useTheme();
 const bg=variant==='primary'?c.accent:variant==='secondary'?c.raised:'transparent';
 const fg=variant==='primary'?c.onAccent:variant==='danger'?c.danger:c.text;
 const off=disabled||busy;
 return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={accessibilityHint} accessibilityState={{disabled:!!off,busy:!!busy}} disabled={off} onPress={()=>{tap();onPress();}} style={({pressed})=>[s.button,{backgroundColor:bg,flexDirection:rtl?'row-reverse':'row',opacity:off?.5:pressed?.85:1,transform:[{scale:pressed?.98:1}]},variant==='ghost'&&{borderWidth:1,borderColor:c.border},style]}>
  {busy?<ActivityIndicator color={fg}/>:icon?<Icon name={icon} size={18} color={fg} mirror={/forward|back/.test(icon)}/>:null}
  <Text style={[type.body,{fontFamily:fonts.medium,color:fg}]}>{label}</Text>
 </Pressable>;
}

export function IconButton({icon,label,onPress,tone='plain',size=40,disabled,mirror}:{icon:IconName;label:string;onPress:()=>void;tone?:'plain'|'accent'|'raised';size?:number;disabled?:boolean;mirror?:boolean}){
 const {c}=useTheme();
 const bg=tone==='accent'?c.accent:tone==='raised'?c.raised:'transparent';
 return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled:!!disabled}} disabled={disabled} hitSlop={6} onPress={()=>{tap();onPress();}} style={({pressed})=>[{width:size,height:size,borderRadius:size/2.6,alignItems:'center',justifyContent:'center',backgroundColor:bg,opacity:disabled?.4:pressed?.75:1}]}>
  <Icon name={icon} size={size*.5} color={tone==='accent'?c.onAccent:c.text} mirror={mirror}/>
 </Pressable>;
}

export function Card({children,style,onPress,accessibilityLabel,highlight}:{children:ReactNode;style?:StyleProp<ViewStyle>;onPress?:()=>void;accessibilityLabel?:string;highlight?:boolean}){
 const {c}=useTheme();
 const base=[s.card,{backgroundColor:c.surface,borderColor:highlight?c.accent:'transparent'},style];
 if(!onPress)return <View style={base}>{children}</View>;
 return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={()=>{tap();onPress();}} style={({pressed})=>[...base,{opacity:pressed?.85:1}]}>{children}</Pressable>;
}

export function Chip({label,icon,onPress,tone='soft'}:{label:string;icon?:IconName;onPress?:()=>void;tone?:'soft'|'raised'}){
 const {c,rtl}=useTheme();
 const fg=tone==='soft'?c.softText:c.text;
 const body=<View style={[s.chip,{backgroundColor:tone==='soft'?c.soft:c.raised,flexDirection:rtl?'row-reverse':'row'}]}>{icon?<Icon name={icon} size={14} color={fg}/>:null}<Text style={[type.caption,{fontFamily:fonts.medium,color:fg}]}>{label}</Text></View>;
 return onPress?<Pressable accessibilityRole="button" accessibilityLabel={label} onPress={()=>{tap();onPress();}}>{body}</Pressable>:body;
}

export function Row({children,gap=space.sm,style,justify='flex-start'}:{children:ReactNode;gap?:number;style?:StyleProp<ViewStyle>;justify?:ViewStyle['justifyContent']}){
 const {rtl}=useTheme();
 return <View style={[{flexDirection:rtl?'row-reverse':'row',alignItems:'center',gap,justifyContent:justify},style]}>{children}</View>;
}

export function Field(props:ComponentProps<typeof TextInput>&{large?:boolean}){
 const {c,rtl}=useTheme();const {large,style,...rest}=props;
 return <TextInput placeholderTextColor={c.faint} {...rest} style={[s.field,large?type.title:type.body,{fontFamily:fonts.regular,color:c.text,backgroundColor:c.raised,textAlign:rtl?'right':'left'},style]}/>;
}

/** Bottom sheet built on Modal: replaces native Alert dialogs so copy, RTL and theme stay ours. */
export function Sheet({visible,onClose,title,children}:{visible:boolean;onClose:()=>void;title?:string;children:ReactNode}){
 const {c}=useTheme();
 return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
  <Pressable accessibilityLabel="close" style={s.scrim} onPress={onClose}/>
  <View style={[s.sheet,{backgroundColor:c.surface}]}>
   <View style={[s.grabber,{backgroundColor:c.border}]}/>
   {title?<AppText variant="title" weight="bold" accessibilityRole="header">{title}</AppText>:null}
   <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{gap:space.md,paddingBottom:space.lg}}>{children}</ScrollView>
  </View>
 </Modal>;
}

export function Banner({text,tone='danger',action}:{text:string;tone?:'danger'|'info';action?:{label:string;onPress:()=>void}}){
 const {c}=useTheme();
 return <View accessibilityRole="alert" style={[s.banner,{backgroundColor:tone==='danger'?c.raised:c.soft,borderColor:tone==='danger'?c.danger:c.accent}]}>
  <AppText variant="caption" tone={tone==='danger'?'danger':'softText'}>{text}</AppText>
  {action?<Pressable accessibilityRole="button" onPress={action.onPress} hitSlop={8}><AppText variant="caption" weight="bold" tone="accent">{action.label}</AppText></Pressable>:null}
 </View>;
}

const s=StyleSheet.create({
 button:{minHeight:50,borderRadius:radius.md,paddingHorizontal:space.lg,alignItems:'center',justifyContent:'center',gap:space.sm},
 card:{borderRadius:radius.lg,padding:space.lg,gap:space.sm,borderWidth:1},
 chip:{borderRadius:radius.pill,paddingHorizontal:space.md,paddingVertical:6,alignItems:'center',gap:6,alignSelf:'flex-start'},
 field:{minHeight:52,borderRadius:radius.md,paddingHorizontal:space.lg,paddingVertical:space.md},
 scrim:{flex:1,backgroundColor:'rgba(0,0,0,.45)'},
 sheet:{borderTopLeftRadius:28,borderTopRightRadius:28,padding:space.xl,gap:space.md,maxHeight:'85%'},
 grabber:{width:40,height:4,borderRadius:2,alignSelf:'center',marginBottom:space.sm},
 banner:{borderRadius:radius.md,borderWidth:1,padding:space.md,gap:6},
});
