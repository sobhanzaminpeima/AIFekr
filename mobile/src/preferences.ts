import * as SecureStore from 'expo-secure-store';
import {z} from 'zod';
export const purposes=['personal','student','business','fitness','realestate'] as const;
export type Purpose=typeof purposes[number];
// introSeen/purpose only shape the first run and Home suggestions; nothing is sent to the server.
const schema=z.object({locale:z.enum(['fa','en','tr']).default('fa'),mode:z.enum(['dark','light','system']).default('system'),introSeen:z.boolean().default(false),purpose:z.enum(purposes).optional().catch(undefined)});
let writes:Promise<void>=Promise.resolve();
export async function readPreferences(){const raw=await SecureStore.getItemAsync('aifekr.preferences');try{return schema.parse(raw?JSON.parse(raw):{});}catch{return schema.parse({});}}
export function updatePreferences(patch:Partial<z.infer<typeof schema>>){const work=writes.then(async()=>{const current=await readPreferences();await SecureStore.setItemAsync('aifekr.preferences',JSON.stringify(schema.parse({...current,...patch})));});writes=work.catch(()=>{});return work;}
