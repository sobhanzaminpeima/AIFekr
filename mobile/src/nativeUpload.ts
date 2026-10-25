/** React Native's FormData transports files by URI, not browser Blob buffers. */
export function appendNativeFile(form:FormData,uri:string,name:string,type:string){
 if(!/^(file|content):\/\//.test(uri)||!name||!type)throw new Error('Invalid native upload');
 form.append('file',{uri,name,type} as unknown as Blob);
}
