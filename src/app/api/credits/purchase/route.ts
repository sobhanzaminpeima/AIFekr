import { NextRequest,NextResponse } from "next/server";
import { POST as checkout } from "@/app/api/payment/create/route";
export const dynamic="force-dynamic";
export async function POST(req:NextRequest){
 let body;try{body=await req.json();}catch{return NextResponse.json({error:"Invalid request"},{status:400});}
 if(typeof body.tierId!=="string")return NextResponse.json({error:"Invalid tier"},{status:400});
 return checkout(new NextRequest(req.url,{method:"POST",headers:req.headers,body:JSON.stringify({plan:`CREDITS_${body.tierId}`,period:"monthly",currency:body.currency||"TRY"})}));
}
