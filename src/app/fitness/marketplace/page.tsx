export const dynamic="force-dynamic";export const metadata={robots:{index:false,follow:false}};import {cookies} from "next/headers";import {redirect} from "next/navigation";import {verifyToken} from "@/lib/auth/jwt";import {prisma} from "@/lib/db/prisma";import MarketplaceWorkspace from "@/components/fitness/MarketplaceWorkspace";import {getServerLang} from "@/lib/i18n/server";
export default async function Page(props:{searchParams: Promise<{lang?:string}>}) {
  const searchParams = await props.searchParams;
  const token=(await cookies()).get("token")?.value;const auth=token?verifyToken(token):null;if(!auth)redirect("/login?redirect=/fitness");const u=await prisma.user.findUnique({where:{id:auth.userId},select:{isBlocked:true}});if(!u||u.isBlocked)redirect("/login");return <MarketplaceWorkspace language={["en","fa","tr","ar","de"].includes(searchParams.lang||"")?searchParams.lang:await getServerLang()}/>;
}
