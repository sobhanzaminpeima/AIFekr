import { NextRequest,NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { timingSafeEqual } from "node:crypto";
import { factoryRoute } from "@/lib/video-factory/http";
import { exchangeYoutubeCode } from "@/lib/video-factory/publishing";
import { FactoryError } from "@/lib/video-factory/domain";
export const dynamic="force-dynamic";
export function GET(req:NextRequest){return factoryRoute(req,false,async userId=>{
  const state=req.nextUrl.searchParams.get("state") || "",stored=req.cookies.get("vf_youtube_state")?.value || "",code=req.nextUrl.searchParams.get("code");
  if(!state||state.length>2000||!stored||!code||Buffer.byteLength(state)!==Buffer.byteLength(stored)||!timingSafeEqual(Buffer.from(state),Buffer.from(stored))||!process.env.JWT_SECRET)throw new FactoryError("INVALID_OAUTH_STATE",400);
  let payload:jwt.JwtPayload;try{payload=jwt.verify(state,process.env.JWT_SECRET,{algorithms:["HS256"]}) as jwt.JwtPayload;}catch{throw new FactoryError("INVALID_OAUTH_STATE",400);}
  if(payload.userId!==userId||payload.purpose!=="video_factory_youtube")throw new FactoryError("INVALID_OAUTH_STATE",400);
  await exchangeYoutubeCode(userId,code);const response=NextResponse.redirect(new URL("/video-factory",req.url));response.cookies.set("vf_youtube_state","",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/api/video-factory/youtube",maxAge:0});return response;
});}
