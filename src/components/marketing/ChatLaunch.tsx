import Link from "./PublicLink";
import {MessageSquare,ArrowUpRight,Sparkles} from "lucide-react";
import type {Lang} from "@/lib/i18n/server";
import {text} from "@/lib/marketing/catalog";
export default function ChatLaunch({lang}:{lang:Lang}){
  return <section className="m-container m-chat-launch" aria-label="AIFekr AI Chat">
    <div className="m-chat-launch-copy"><span className="m-eyebrow"><Sparkles size={16}/> AIFekr AI Chat</span>
      <h2>{text(lang,["از یک سؤال شروع کن.","Start with a question.","Beginnen Sie mit einer Frage.","Bir soruyla başlayın."])}</h2>
      <p>{text(lang,["بنویس، یاد بگیر و ایده‌هایت را جلو ببر. بدون ثبت‌نام وارد محیط شو؛ هنگام ارسال پیام، ورود و انتخاب پکیج را انجام بده.","Write, learn and explore ideas. Explore without signup; sign in and choose a package when you send a message.","Schreiben, lernen und Ideen entwickeln. Ohne Anmeldung entdecken; zum Senden anmelden und Paket wählen.","Yazın, öğrenin ve fikirlerinizi geliştirin. Kayıt olmadan keşfedin; mesaj gönderirken giriş yapın ve paket seçin."])}</p>
      <Link href="/explore" className="m-button">{text(lang,["وارد پلتفرم شو","Explore the platform","Plattform entdecken","Platformu keşfedin"])}<ArrowUpRight size={17}/></Link>
    </div><div className="m-chat-demo" aria-hidden="true"><MessageSquare size={25}/><span>AIFekr AI Chat</span><p>{text(lang,["برای امروز یک برنامهٔ بهتر می‌خواهم…","Help me plan a better day…","Hilf mir, meinen Tag zu planen…","Bugünümü planlamama yardım et…"])}</p><div><i/><i/><i/></div><small>{text(lang,["فکرهایت را به قدم بعدی تبدیل کن","Turn your ideas into your next step","Aus Ideen wird Ihr nächster Schritt","Fikirlerinizi bir sonraki adıma dönüştürün"])}</small></div>
  </section>;
}
