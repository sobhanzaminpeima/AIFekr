// Real HTTP requests against the isolated local preview; never production.
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const assert = require('node:assert/strict');
const db = new PrismaClient();
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:3005';
const ids=[]; const orderIds=[]; const checks=[];
if (process.env.DATABASE_URL !== 'file:./uiux-preview.db' || !['localhost','127.0.0.1'].includes(new URL(base).hostname)) throw Error('Isolated localhost preview required');
const make = async role => {
  const user=await db.user.create({data:{email:`operations-${role}-${Date.now()}@qa.invalid`,role,name:'Operational QA',onboardingDone:true}});
  ids.push(user.id);return {id:user.id,cookie:'token='+jwt.sign({userId:user.id,role,plan:'FREE'},process.env.JWT_SECRET,{expiresIn:'15m'})};
};
async function call(path,who,opts={}) { return fetch(base+path,{...opts,headers:{...(who?{cookie:who.cookie}:{}),...opts.headers}}); }
const json = body => ({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const receipt = text => {const form=new FormData();form.append('receipt',new Blob([text],{type:'application/pdf'}),'receipt.pdf');return {method:'POST',body:form};};
async function status(label,request,expected) {const res=await request;assert.equal(res.status,expected,label);checks.push(label);return res;}
async function main() {
  const buyer=await make('USER'), stranger=await make('USER'),admin=await make('ADMIN');
  await status('purchase requires authentication',call('/api/payment/create',null,json({plan:'TEAM_BUSINESS_START'})),401);
  await status('invalid plan rejected',call('/api/payment/create',buyer,json({plan:'UNKNOWN'})),400);
  await status('null request rejected',call('/api/payment/create',buyer,json(null)),400);
  await status('unsupported currency rejected',call('/api/payment/create',buyer,json({plan:'TEAM_BUSINESS_START',currency:'BTC'})),400);
  await status('invalid term rejected',call('/api/payment/create',buyer,json({plan:'TEAM_BUSINESS_START',period:'weekly'})),400);
  const create=await status('quarterly euro bundle order created',call('/api/payment/create',buyer,json({plan:'TEAM_BUSINESS_START',period:'quarterly',currency:'EUR'})),200);
  const order=await create.json(), id=order.paymentId;orderIds.push(id);
  const same=await (await status('pending order safely reused',call('/api/payment/create',buyer,json({plan:'TEAM_BUSINESS_START',period:'quarterly',currency:'EUR'})),200)).json();assert.equal(same.paymentId,id);
  await status('another buyer cannot read order',call(`/api/payment/${id}`,stranger),404);
  await status('buyer cannot approve',call(`/api/admin/payments/${id}`,buyer,{...json({action:'approve',note:''}),method:'PATCH'}),403);
  await status('approval requires receipt',call(`/api/admin/payments/${id}`,admin,{...json({action:'approve',note:''}),method:'PATCH'}),409);
  await status('invalid receipt rejected',call(`/api/payment/${id}/receipt`,buyer,receipt('<script>invalid</script>')),400);
  await status('oversized receipt rejected',call(`/api/payment/${id}/receipt`,buyer,receipt('%PDF-'+ '0'.repeat(5*1024*1024+65536))),413);
  await status('valid PDF accepted',call(`/api/payment/${id}/receipt`,buyer,receipt('%PDF-1.4\nSynthetic operational QA '+id)),200);
  await status('duplicate upload rejected',call(`/api/payment/${id}/receipt`,buyer,receipt('%PDF-1.4\nDuplicate '+id)),409);
  await status('receipt owner download',call(`/api/payment/${id}/receipt`,buyer),200);
  await status('receipt stranger download blocked',call(`/api/payment/${id}/receipt`,stranger),404);
  assert.equal((await db.user.findUniqueOrThrow({where:{id:buyer.id}})).plan,'FREE');checks.push('upload alone never activates access');
  await status('admin approval activates',call(`/api/admin/payments/${id}`,admin,{...json({action:'approve',note:'Synthetic transfer verification'}),method:'PATCH'}),200);
  await status('repeat approval rejected',call(`/api/admin/payments/${id}`,admin,{...json({action:'approve',note:''}),method:'PATCH'}),409);
  const user=await db.user.findUniqueOrThrow({where:{id:buyer.id}}),team=await db.team.findUniqueOrThrow({where:{ownerId:buyer.id}});
  assert.equal(user.plan,'TEAM');assert.equal(user.crmPlan,'TEAM');assert.equal(user.voicePlan,'ACTIVE');assert.equal(team.maxSeats,3);assert.equal(team.credits,12000);checks.push('bundle grants all paid workspaces and correct quarterly credits');
  const access=await (await status('paid module access API available',call('/api/crm/module-access?keys=crm.property,agent.voiceCallCenter',buyer),200)).json();
  assert.equal(access.access['crm.property'],true);assert.equal(access.access['agent.voiceCallCenter'],true);checks.push('industry modules included without separate purchase');
  const r=await (await status('monthly lira order created',call('/api/payment/create',stranger,json({plan:'TEAM_BUSINESS_GROW',period:'monthly',currency:'TRY'})),200)).json();
  orderIds.push(r.paymentId);
  await status('second buyer receipt accepted',call(`/api/payment/${r.paymentId}/receipt`,stranger,receipt('%PDF-1.4\nDifferent QA '+r.paymentId)),200);
  await status('rejection requires explanation',call(`/api/admin/payments/${r.paymentId}`,admin,{...json({action:'reject',note:''}),method:'PATCH'}),400);
  await status('admin rejection recorded',call(`/api/admin/payments/${r.paymentId}`,admin,{...json({action:'reject',note:'Synthetic transfer not found'}),method:'PATCH'}),200);
  await status('rejected order cannot be approved',call(`/api/admin/payments/${r.paymentId}`,admin,{...json({action:'approve',note:''}),method:'PATCH'}),409);
  assert.equal((await db.user.findUniqueOrThrow({where:{id:stranger.id}})).plan,'FREE');checks.push('rejection does not grant access');
  await status('new order after rejection',call('/api/payment/create',stranger,json({plan:'TEAM_BUSINESS_GROW',period:'monthly',currency:'TRY'})),200);
  console.log(JSON.stringify({passed:checks.length,checks},null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(async()=>{
  // Cascades remove only the synthetic accounts created in this invocation.
  if(orderIds.length)await db.notification.deleteMany({where:{type:"payment_receipt",body:{in:orderIds}}});
  if(ids.length)await db.user.deleteMany({where:{id:{in:ids}}});
  await db.$disconnect();
});
