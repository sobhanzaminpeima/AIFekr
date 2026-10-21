import {createHmac,timingSafeEqual} from "node:crypto";
import {FactoryError} from "./domain";
function secret(){const key=process.env.TOKEN_ENCRYPTION_KEY||process.env.JWT_SECRET;if(!key)throw new FactoryError("DOWNLOAD_SIGNING_UNAVAILABLE",503);return key;}
export function signDownload(userId:string,artifactId:string,now=Date.now()){const payload=Buffer.from(JSON.stringify({purpose:"video-factory-download-v1",userId,artifactId,expires:Math.floor(now/1000)+600})).toString("base64url");return payload+"."+createHmac("sha256",secret()).update(payload).digest("base64url");}
export function verifyDownload(token:string,artifactId:string,now=Date.now()){
 try{if(token.length>2000)throw Error();const [payload,signature,...extra]=token.split(".");if(extra.length||!signature)throw Error();const expected=createHmac("sha256",secret()).update(payload).digest(),actual=Buffer.from(signature,"base64url");if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw Error();const value=JSON.parse(Buffer.from(payload,"base64url").toString());const time=Math.floor(now/1000);if(value.purpose!=="video-factory-download-v1"||value.artifactId!==artifactId||typeof value.userId!=="string"||!Number.isSafeInteger(value.expires)||value.expires<=time||value.expires>time+600)throw Error();return value.userId as string;}catch{throw new FactoryError("DOWNLOAD_LINK_INVALID",403);}
}
