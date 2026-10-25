import {displayChatText} from './sse';
export function speechChunks(raw:string,maxLength:number):string[]{
 const text=displayChatText(raw).replace(/```[\s\S]*?```/g,'').replace(/<PROMPTBOX>[\s\S]*?(?:<\/PROMPTBOX>|$)/g,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/[*#`]/g,'').trim();
 const limit=Math.max(1,Math.min(Math.floor(maxLength),3500));const chunks:string[]=[];
 for(let remaining=text;remaining.length;){let end=Math.min(limit,remaining.length);if(end<remaining.length){const boundary=remaining.lastIndexOf(' ',end);if(boundary>limit/2)end=boundary;}chunks.push(remaining.slice(0,end));remaining=remaining.slice(end).trimStart();}
 return chunks;
}
