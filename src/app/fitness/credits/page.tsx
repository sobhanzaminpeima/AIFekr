export const dynamic="force-dynamic";
import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import Link from "next/link";
import {verifyToken} from "@/lib/auth/jwt";
import {prisma} from "@/lib/db/prisma";
import CreditsWorkspace from "@/components/billing/CreditsWorkspace";
export default async function Page(){const token=(await cookies()).get("token")?.value,auth=token?verifyToken(token):null;if(!auth)redirect("/login?redirect=/fitness/credits");const u=await prisma.user.findUnique({where:{id:auth.userId},select:{isBlocked:true}});if(!u||u.isBlocked)redirect("/login");return <main className="fit-page"><nav className="fit-toolbar"><Link href="/fitness">← AIFekr FIT</Link></nav><CreditsWorkspace fitness/></main>;}
