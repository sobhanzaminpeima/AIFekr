import {cookies} from "next/headers";
import {verifyToken} from "@/lib/auth/jwt";
import {prisma} from "@/lib/db/prisma";
import type {Lang} from "@/lib/i18n/server";
import {getEntryPlans} from "@/lib/marketing/entryPlans";
import PlanChoice from "./PlanChoice";
export default async function EntryPlans({lang,initialGroup="CHAT",embedded=false}:{lang:Lang;initialGroup?:string;embedded?:boolean}){
 const payload=verifyToken((await cookies()).get("token")?.value||""),user=payload?await prisma.user.findUnique({where:{id:payload.userId},select:{isBlocked:true}}):null;
 return <PlanChoice plans={await getEntryPlans(lang)} authenticated={!!user&&!user.isBlocked} initialGroup={initialGroup} embedded={embedded}/>;
}
