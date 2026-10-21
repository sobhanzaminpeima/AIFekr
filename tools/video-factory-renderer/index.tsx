import React from "react";
import {AbsoluteFill,Composition,getInputProps,registerRoot,useCurrentFrame,interpolate,Img} from "remotion";
type Props={width:number;height:number;frames:number;title:string;rtl:boolean;motion?:string;imageData?:string;animation?:{fadeFrames:number;zoom:number;panPercent:number};chart?:{labels:string[];values:number[];unit:string}};
const Shot:React.FC<Props>=(props)=>{
 const frame=useCurrentFrame(),progress=frame/Math.max(1,props.frames-1),fade=props.animation?.fadeFrames??12;
 const opacity=fade?interpolate(frame,[0,fade],[0,1],{extrapolateRight:"clamp"}):1;
 const zoom=props.motion==="PUSH_IN"?1+progress*((props.animation?.zoom??1.08)-1):props.motion==="PAN"?1.12:1;
 const pan=props.motion==="PAN"?(progress-.5)*2*(props.animation?.panPercent??4):0;
 return <AbsoluteFill style={{backgroundColor:"#111318",color:"white",fontFamily:"Arial",direction:props.rtl?"rtl":"ltr",opacity}}>
 {props.imageData&&<Img src={props.imageData} style={{width:"100%",height:"100%",objectFit:"cover",transform:`scale(${zoom}) translateX(${pan}%)`}}/>}
 <AbsoluteFill style={{padding:60,justifyContent:props.imageData?"flex-end":"center",background:props.imageData?"linear-gradient(transparent 55%,rgba(0,0,0,.8))":undefined}}>
 <div style={{fontSize:18,color:"#ff6b00"}}>AIFekr Video Factory</div><h1 style={{fontSize:Math.min(48,props.width*.045)}}>{props.title}</h1>
 {props.chart&&<div style={{display:"flex",alignItems:"end",height:props.height*.4,gap:20}}>{props.chart.values.map((value,i)=><div key={i} style={{flex:1,textAlign:"center"}}><div style={{height:Math.max(2,value/Math.max(1,...props.chart!.values)*props.height*.3)*interpolate(frame,[0,36],[0,1],{extrapolateRight:"clamp"}),backgroundColor:"#ff6b00"}}/><div style={{fontSize:20}}>{props.chart!.labels[i]} · {value} {props.chart!.unit}</div></div>)}</div>}
 </AbsoluteFill></AbsoluteFill>;
};
const Root=()=>{const props=getInputProps() as Props;return <Composition id="FactoryShot" component={Shot} durationInFrames={props.frames} width={props.width} height={props.height} fps={24} defaultProps={props}/>;};registerRoot(Root);
