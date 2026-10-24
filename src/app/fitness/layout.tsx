import {renderPlatformShell} from "@/components/layout/PlatformShell";
export const dynamic="force-dynamic";
import {cookies,headers} from "next/headers";
import {redirect} from "next/navigation";
import {verifyToken} from "@/lib/auth/jwt";
import {prisma} from "@/lib/db/prisma";
export default async function Layout({children}:{children:React.ReactNode}){const token=(await cookies()).get("token")?.value,auth=token?verifyToken(token):null;if(!auth){const current=(await headers()).get("x-aifekr-path")||"/fitness";redirect("/login?redirect="+encodeURIComponent(current.startsWith("/fitness")&&!current.startsWith("//")?current:"/fitness"));}const user=await prisma.user.findUnique({where:{id:auth.userId},select:{isBlocked:true}});if(!user||user.isBlocked)redirect("/login");return renderPlatformShell(children,true);}
