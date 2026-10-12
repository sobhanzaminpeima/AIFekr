import path from "node:path";
import {readFile} from "node:fs/promises";
export function privateAssetLocation(key:string){if(!/^(fitness-private|fitness-credentials)\/[a-zA-Z0-9_-]{1,100}\/[a-f0-9-]{36}\.pdf$/.test(key))throw Error("INVALID_ASSET");const root=path.resolve(process.env.FIT_PRIVATE_UPLOAD_DIR||path.join(process.cwd(),"private-uploads","fitness"));return path.join(root,key);}
export async function readPrivateAsset(key:string){return readFile(privateAssetLocation(key));}
