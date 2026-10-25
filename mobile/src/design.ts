// AIFekr Neo tokens. Keys bg/surface/text/muted/border/accent/soft are read by
// the older screens too, so they keep their meaning; the rest are new.
export const palettes={
 dark:{bg:'#17191D',surface:'#292D33',raised:'#363B42',text:'#F5F3EF',muted:'#B9B3AC',faint:'#8C8780',border:'#3A3F46',accent:'#FF6B00',onAccent:'#17191D',soft:'#3A2A1E',softText:'#FFB07A',danger:'#FF8A7A',success:'#7BD88F'},
 light:{bg:'#F7F5F2',surface:'#FFFFFF',raised:'#EFEBE6',text:'#17191D',muted:'#5F5A54',faint:'#8C8780',border:'#E2DDD6',accent:'#E65F00',onAccent:'#FFFFFF',soft:'#FFF0E4',softText:'#9A3F00',danger:'#B3261E',success:'#1E7B34'},
};
export type Palette=typeof palettes.dark;
export const space={xs:4,sm:8,md:12,lg:16,xl:24,xxl:32};
export const radius={sm:10,md:14,lg:20,pill:999};
export const type={
 display:{fontSize:28,lineHeight:40},
 title:{fontSize:20,lineHeight:30},
 body:{fontSize:15,lineHeight:25},
 caption:{fontSize:13,lineHeight:20},
 tiny:{fontSize:11,lineHeight:16},
};
// Vazirmatn covers Persian and Latin, so one family serves fa, en and tr.
export const fonts={regular:'Vazirmatn_400Regular',medium:'Vazirmatn_500Medium',bold:'Vazirmatn_700Bold'};
