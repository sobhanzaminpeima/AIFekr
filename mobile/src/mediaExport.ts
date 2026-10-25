export function shareableMediaUrl(raw:string):boolean{
 if(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(raw))return true;
 try{const url=new URL(raw);return url.protocol==='https:'&&!url.username&&!url.password&&!['localhost','127.0.0.1','[::1]','placehold.co','picsum.photos'].includes(url.hostname)&&!url.hostname.endsWith('.local');}catch{return false;}
}
export async function boundedBytes(response:Response,maxBytes:number):Promise<Uint8Array>{
 if(!response.ok)throw new Error('Download failed');const length=Number(response.headers.get('Content-Length'));if(length>maxBytes)throw new Error('File too large');
 if(!response.body)throw new Error('Streaming download unavailable');const reader=response.body.getReader();const chunks:Uint8Array[]=[];let total=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>maxBytes)throw new Error('File too large');chunks.push(value);}}catch(error){await reader.cancel();throw error;}
 const output=new Uint8Array(total);let offset=0;for(const chunk of chunks){output.set(chunk,offset);offset+=chunk.length;}return output;
}
