export const dynamic="force-dynamic";
export const metadata={robots:{index:false,follow:false}};
import {renderPlatformShell} from "@/components/layout/PlatformShell";
export default function Layout({children}:{children:React.ReactNode}){return renderPlatformShell(children);}
