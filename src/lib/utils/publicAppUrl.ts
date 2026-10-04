/** Server links must never inherit a localhost URL baked into a production build. */
export function publicAppUrl(){
 const configured=process.env.APP_URL||process.env.NEXT_PUBLIC_APP_URL;
 if(configured){try{const url=new URL(configured);const loopback=["localhost","127.0.0.1","::1","[::1]"].includes(url.hostname);if(["http:","https:"].includes(url.protocol)&&(process.env.NODE_ENV!=="production"||(!loopback&&url.protocol==="https:")))return url.origin;}catch{}}
 return process.env.NODE_ENV==="production"?"https://aifekr.com":"http://localhost:3000";
}
