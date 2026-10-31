require('@next/env').loadEnvConfig(process.cwd());process.env.DATABASE_URL='file:C:/Claude Projects/AI Chat/ai-platform-voice/prisma/vitest-ui-accounting.db';
const {PrismaClient}=require('@prisma/client'),jwt=require('jsonwebtoken'),assert=require('node:assert/strict');const db=new PrismaClient(),base='http://localhost:3075';let owner,other,task,action,conversation;let passed=0;
function headers(u){return{cookie:'token='+jwt.sign({userId:u.id,role:u.role,plan:u.plan},process.env.JWT_SECRET,{expiresIn:600}),origin:base,'content-type':'application/json'}}
async function api(u,path,method='GET',body,status=200){const r=await fetch(base+path,{method,headers:headers(u),...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(120000)});assert.equal(r.status,status);passed++;return r.json()}
(async()=>{
 const make=tag=>db.user.create({data:{email:`team-${tag}-${Date.now()}@example.test`,passwordHash:'local-only',plan:'BUSINESS',onboardingDone:true}});owner=await make('owner');other=await make('other');
 const made=await api(owner,'/api/ceo/tasks','POST',{title:'Local goal',department:'general'},201);task=made.task;
 await api(other,'/api/ceo/tasks','PUT',{id:task.id,status:'done'},404);await api(owner,'/api/ceo/tasks','PUT',{id:task.id,status:'invalid'},400);await api(owner,'/api/ceo/tasks','PUT',{id:task.id,status:'approved'});
 conversation=await db.conversation.create({data:{userId:owner.id,title:'Local CEO',tool:'ceo',model:'auto'}});
 action=await db.orchestratorAction.create({data:{conversationId:conversation.id,workspaceUserId:owner.id,actingUserId:owner.id,toolKey:'local-fixture',argsJson:'{}',summary:'Local proposed action',expiresAt:new Date(Date.now()+60000)}});
 const workspace=await api(owner,'/api/ceo/workspace');assert.ok(workspace.actions.some(a=>a.id===action.id));assert.ok(!('argsJson' in workspace.actions[0]));passed++;
 const foreign=await api(other,'/api/ceo/workspace');assert.equal(foreign.actions.length,0);passed++;
 await api(other,'/api/orchestrator/action/'+action.id,'DELETE',null,404);await api(owner,'/api/orchestrator/action/'+action.id,'DELETE');
 const agents=await api(owner,'/api/agents/workspace');assert.ok(Array.isArray(agents.general));assert.ok(agents.general.every(a=>typeof a.href==='string'&&a.href.startsWith('/')));passed++;
 const after=await db.user.findUnique({where:{id:owner.id},select:{credits:true}});assert.equal(after.credits,owner.credits);passed++;
 console.log(JSON.stringify({passed}));
})().catch(e=>{console.log({test:'FAILED',error:e.code??e.name,detail:e.message,passed});process.exitCode=1}).finally(async()=>{if(action)await db.orchestratorAction.deleteMany({where:{id:action.id}});if(conversation)await db.conversation.deleteMany({where:{id:conversation.id}});for(const u of [owner,other])if(u){await db.growthTouch.deleteMany({where:{userId:u.id}});await db.user.delete({where:{id:u.id}})}await db.$disconnect()});
