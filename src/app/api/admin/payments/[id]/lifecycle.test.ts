import {it,expect,vi} from "vitest";
import {NextRequest} from "next/server";
const state=vi.hoisted(()=>({admin:{id:"admin"} as {id:string}|null,manage:vi.fn(async()=>({status:"CANCELLED"}))}));
vi.mock("@/lib/auth/middleware",()=>({requireAdmin:async()=>state.admin}));
vi.mock("@/lib/payment/adminLifecycle",()=>({manageUnpaidOrder:state.manage,PaymentLifecycleError:class extends Error{}}));
import {PATCH} from "./route";
function request(origin="http://localhost",note="Cancelled by administrator"){return new NextRequest("http://localhost/api/admin/payments/order",{method:"PATCH",headers:{origin},body:JSON.stringify({action:"cancel",note})});}
it("requires same-origin administrator access for cancellation",async()=>{state.admin=null;expect((await PATCH(request(),{params:Promise.resolve({id:"order"})})).status).toBe(403);state.admin={id:"admin"};expect((await PATCH(request("https://attacker.example"),{params:Promise.resolve({id:"order"})})).status).toBe(403);expect(state.manage).not.toHaveBeenCalled();});
it("requires a review note and delegates a valid cancellation",async()=>{expect((await PATCH(request("http://localhost",""),{params:Promise.resolve({id:"order"})})).status).toBe(400);expect((await PATCH(request(),{params:Promise.resolve({id:"order"})})).status).toBe(200);expect(state.manage).toHaveBeenCalledWith("order","admin","cancel","Cancelled by administrator");});
