/** Only completed public results may leave the durable request ledger. */
export function publicRequestResult(status:string,responseJson:string|null):unknown {
  if(status!=="COMPLETED"||!responseJson)return null;
  try {
    const value=JSON.parse(responseJson);
    if(value?.kind==='push')return null;
    if(value?.kind==="media")return {type:value.type,provider:value.provider,credits:value.credits,output:value.output,status:value.status};
    return value;
  } catch {return null;}
}
