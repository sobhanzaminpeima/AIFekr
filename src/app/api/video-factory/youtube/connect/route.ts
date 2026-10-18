import { NextRequest,NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { factoryRoute } from "@/lib/video-factory/http";
import { youtubeAuthorizationUrl } from "@/lib/video-factory/publishing";
export const dynamic="force-dynamic";
export function GET(req:NextRequest){return factoryRoute(req,false,async userId=>{
  if(!process.env.JWT_SECRET)throw Error("JWT configuration unavailable");
  const state=jwt.sign({userId,purpose:"video_factory_youtube",nonce:randomUUID()},process.env.JWT_SECRET,{expiresIn:"10m"});
  const response=NextResponse.redirect(youtubeAuthorizationUrl(state));response.cookies.set("vf_youtube_state",state,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/api/video-factory/youtube",maxAge:600});return response;
});}
