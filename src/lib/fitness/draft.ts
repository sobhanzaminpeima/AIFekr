type Session = {id:string;userId:string;revision:number;status:string;programSnapshot:string};
type Log = {exerciseId:string;setNumber:number;repetitions:number;weightGrams:number;completed:boolean;rpe?:number;rir?:number};
export function recoverWorkoutDraft(raw:unknown,userId:string,sessions:(Session&{sets?:Log[]})[]){
  if(!raw||typeof raw!=="object")return null;
  const draft=raw as {session?:Session;sets?:Log[]};
  if(draft.session?.userId!==userId||!Array.isArray(draft.sets))return null;
  const server=sessions.find(s=>s.id===draft.session!.id&&s.userId===userId);
  if(!server||server.status==="COMPLETED")return null;
  if(server.revision!==draft.session.revision)return {session:server,sets:server.sets||[]};
  return {session:server,sets:draft.sets};
}
