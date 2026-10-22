export function validStudioOrigin(origin:string|null,requestOrigin:string,production:boolean){
 if(!origin)return false;
 try{return new URL(origin).origin===(production?"https://aifekr.com":new URL(requestOrigin).origin);}catch{return false;}
}
