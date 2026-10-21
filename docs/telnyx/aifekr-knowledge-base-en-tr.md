# AIFekr Knowledge Base - English / Türkçe

Reviewed against repository source and requested release changes, 9 October 2026.

Support: support@aifekr.com | Website: https://aifekr.com

## 01. AIFekr: purpose and audiences / AIFekr: amaç ve kullanıcı grupları

Routes: /about

### English

AIFekr is an online AI workspace at https://aifekr.com. It brings conversational AI, media creation, student study tools and business workflows into one account. Business areas include CRM, sales, marketing, SEO, accounting and strategic advisors. The Student workspace supports study materials, planning and learning; the Academy offers published courses and verified completion records.
The platform interface supports English, Turkish, Persian and German. Persian uses right-to-left layout. A user can choose a language during onboarding and change it later in Settings. Educational course content has its own language; changing the interface does not translate an existing course.
An AI credit balance, a subscription entitlement and a third-party service connection are different requirements. A positive balance alone does not unlock an expired subscription. Availability can also depend on administrator settings, team permissions and provider configuration. Ask what the caller wants to accomplish before suggesting a package.

### Türkçe

AIFekr, https://aifekr.com adresindeki çevrim içi yapay zekâ çalışma alanıdır. Sohbet, medya üretimi, öğrenci çalışma araçları ve işletme süreçlerini tek hesapta birleştirir. İşletme bölümleri CRM, satış, pazarlama, SEO, muhasebe ve strateji danışmanlarını içerir. Öğrenci alanı ders materyalleri, planlama ve öğrenmeyi destekler; Akademi yayımlanmış kurslar ve doğrulanmış tamamlama kayıtları sunar.
Arayüz İngilizce, Türkçe, Farsça ve Almanca destekler. Farsça sağdan sola gösterilir. Dil, ilk kurulumda seçilebilir ve Ayarlar'dan değiştirilebilir. Kurs içeriğinin dili ayrıdır; arayüz dilini değiştirmek mevcut kursu tercüme etmez.
Yapay zekâ kredisi, abonelik erişimi ve dış hizmet bağlantısı farklı gereksinimlerdir. Kredi bulunması süresi dolmuş aboneliği açmaz. Kullanılabilirlik yönetici ayarlarına, ekip izinlerine ve hizmet sağlayıcısına da bağlıdır. Paket önermeden önce arayanın yapmak istediği işi öğrenin.

## 02. Navigation and getting started / Gezinme ve ilk adımlar

Routes: /home

### English

Start at Home after registration and onboarding. Chat is the general assistant. Business navigation groups tools into Sales & customers, Marketing, Finance & accounting and Strategy. Student users access the Student workspace and Learn / Academy. Create contains image, video, music, gallery and custom-agent areas. Plans, Credits, Referrals and Settings handle the account.
On mobile the main sidebar collapses; use the menu and bottom navigation. Some tool groups only appear after the appropriate account audience, package or industry selection. A missing menu item is not evidence that data was deleted.
Recommended first steps: choose the account audience and language, complete the relevant profile, inspect the available package and credits, then try one clearly scoped task. For business analysis, provide actual business details. For study help, create a course and add readable materials. Direct routes in this guide are relative to https://aifekr.com; sign-in and permission checks still apply.

### Türkçe

Kayıt ve ilk kurulumdan sonra Ana Sayfa'dan başlayın. Sohbet genel asistandır. İşletme araçları Satış ve müşteriler, Pazarlama, Finans ve muhasebe, Strateji altında gruplanır. Öğrenciler Öğrenci alanına ve Öğren / Akademi'ye gider. Oluştur bölümünde görsel, video, müzik, galeri ve özel ajanlar bulunur. Paketler, Krediler, Davetler ve Ayarlar hesabı yönetir.
Mobilde yan menü daralır; menü düğmesini ve alt gezinmeyi kullanın. Bazı bölümler uygun hesap türü, paket veya sektör seçilince görünür. Bir menünün görünmemesi verilerin silindiği anlamına gelmez.
İlk adımlar: hesap türünü ve dili seçin, ilgili profili doldurun, paket ile kredileri inceleyin ve kapsamı belirli bir görev deneyin. İşletme analizinde gerçek bilgileri kullanın. Ders desteği için bir ders alanı oluşturup okunabilir materyal ekleyin. Bu rehberdeki yollar https://aifekr.com adresine aittir; giriş ve yetki kontrolü geçerlidir.

## 03. Registration and Google sign-in / Kayıt ve Google ile giriş

Routes: /register; /login

### English

Register using the information requested by the form: name, country, contact information, language and account audience. Email/password registration requires a password; phone verification follows the available SMS/OTP flow. Review and accept the displayed terms. A referral link or invitation code can attribute the registration to an inviter.
Google is offered on both login and registration pages. Select a Google account with a verified email. A new Google registration receives its own AIFekr account and referral code. The selected package, language and invitation context continue through the Google flow. An existing account with the same verified email may be linked to Google. Blocked accounts cannot sign in.
If Google fails, retry from the AIFekr login page. Do not reuse an old callback URL or share authorization codes. A redirect configuration or client-credential error requires the administrator to check the Google Cloud OAuth client and the exact HTTPS callback, https://aifekr.com/api/auth/google/callback. Support never needs the caller's Google password or OTP.

### Türkçe

Formun istediği ad, ülke, iletişim bilgisi, dil ve hesap türüyle kayıt olun. E-posta ile kayıtta parola gerekir; telefon doğrulaması kullanılabilir SMS/OTP akışını izler. Gösterilen koşulları inceleyip kabul edin. Davet bağlantısı veya kodu kaydı davet eden kişiye bağlayabilir.
Giriş ve kayıt ekranlarında Google seçeneği bulunur. E-postası doğrulanmış bir Google hesabı seçin. Yeni Google kaydı kendi AIFekr hesabını ve davet kodunu alır. Seçilen paket, dil ve davet bilgileri Google akışında korunur. Aynı doğrulanmış e-postaya sahip mevcut hesap Google'a bağlanabilir. Engellenmiş hesaplar giriş yapamaz.
Google girişinde hata olursa AIFekr giriş ekranından yeniden başlayın. Eski geri dönüş bağlantısını kullanmayın ve yetkilendirme kodlarını paylaşmayın. Yönlendirme veya istemci hatasında yönetici Google Cloud OAuth istemcisini ve https://aifekr.com/api/auth/google/callback adresini kontrol etmelidir. Destek, Google parolanızı veya tek kullanımlık kodunuzu istemez.

## 04. Account audiences and entitlements / Hesap türleri ve erişim hakları

Routes: /plans

### English

Personal, Student and Business describe the intended audience of an account. They are not administrator roles and they do not automatically grant paid features. Access follows the active plan, expiry, team permissions and module configuration.
Existing users do not need a second account to buy a Student package. Select the Student account option during purchase; approved payment classifies the existing account as Student and activates the Student workspace. A Student subscription replaces the general AI subscription; standalone CRM remains a separate entitlement. Existing conversations and files stay with the account.
New business bundles include the business workspace and CRM according to their configured entitlements. Standalone CRM packages are also available. Voice access depends on a voice-including bundle or separate active service. If a menu is restricted, check the current entitlement and expiry before advising a top-up. Never claim that an administrator can bypass a certificate's completion requirements.

### Türkçe

Kişisel, Öğrenci ve İşletme hesabın kullanım amacını belirtir. Yönetici yetkisi değildir ve ücretli özellikleri kendiliğinden açmaz. Erişim aktif pakete, bitiş tarihine, ekip izinlerine ve modül ayarlarına bağlıdır.
Mevcut kullanıcıların öğrenci paketi almak için ikinci hesap açmasına gerek yoktur. Satın alma sırasında Öğrenci hesabı seçeneğini işaretleyin; ödeme onaylanınca aynı hesap öğrenci olarak sınıflandırılır ve çalışma alanı açılır. Öğrenci aboneliği genel yapay zekâ aboneliğinin yerini alır; bağımsız CRM ayrı bir erişim hakkıdır. Sohbetler ve dosyalar aynı hesapta kalır.
Yeni işletme paketleri yapılandırılmış hakları kapsamında işletme alanını ve CRM'yi içerir. Bağımsız CRM paketleri de vardır. Sesli ajan erişimi, ses hizmeti içeren bir paket veya ayrı aktif hizmet gerektirir. Bir bölüm kısıtlıysa kredi yüklemesi önermeden önce paketi ve bitiş tarihini kontrol edin. Yöneticinin sertifika tamamlama koşullarını atlayabileceğini söylemeyin.

## 05. Student prices and daily currencies / Öğrenci fiyatları ve günlük kurlar

Routes: /pricing; /plans

### English

The standard Student package has two purchase options: one month (30 days), TRY 1,199.99; three months (90 days), TRY 2,799.99. Three separate monthly purchases total TRY 3,599.97, so the three-month saving is TRY 799.98, approximately 22%. These are total package prices, not per-day prices. The three-month package is renewable and is not restricted to a first purchase.
TRY is the canonical base. USD equivalent = TRY price / current TRY-per-USD rate. Toman equivalent = USD equivalent × current Toman-per-USD rate. One Toman equals ten Rial. The site uses its reference exchange-rate feed, refreshed periodically; a saved/fallback rate is labelled when live fetching is unavailable. The reference feed's Iranian rate is not a promise of an individual bank's or cash market's exchange rate.
The checkout confirms the final amount and selected payment currency. Extra AI credits are separate; package credit allowances are shown in the current catalog. The support assistant must use live pricing tools or the checkout for current USD/Toman figures, rather than treating a PDF quote as permanently current. Historical paid orders retain their recorded terms.

### Türkçe

Standart öğrenci paketinin iki seçeneği vardır: bir ay (30 gün), 1.199,99 TL; üç ay (90 gün), 2.799,99 TL. Üç ayrı aylık satın alma 3.599,97 TL eder; üç aylık pakette tasarruf 799,98 TL, yaklaşık %22'dir. Bunlar paket toplamlarıdır, günlük fiyat değildir. Üç aylık paket yenilenebilir; yalnızca ilk satın almaya özel değildir.
Temel fiyat TRY'dir. USD karşılığı = TRY fiyatı / güncel USD başına TRY kuru. Toman karşılığı = USD karşılığı × güncel USD başına Toman kuru. Bir Toman on İran Riyali'dir. Site referans kur kaynağını düzenli yeniler; canlı veri alınamazsa kayıtlı/yedek kur belirtilir. Kaynağın İran kuru, belirli bir bankanın veya serbest nakit piyasasının kuru taahhüdü değildir.
Son tutar ve ödeme para birimi ödeme ekranında doğrulanır. Ek yapay zekâ kredileri ayrı alınır; paketteki kredi miktarı güncel katalogda gösterilir. Asistan, güncel USD/Toman tutarları için canlı fiyat aracı veya ödeme ekranını kullanmalıdır; PDF'deki bir tutarı sürekli güncel saymamalıdır. Geçmiş ödemeler kayıtlı koşullarını korur.

## 06. Business, CRM and service packages / İşletme, CRM ve hizmet paketleri

Routes: /plans

### English

Business bundles are organized as Launch, Growth and Scale. They provide the business AI workspace and CRM, with different credit capacity and team sizes. The configured baseline catalog uses 3, 10 and 25 seats respectively; the current Plans screen is authoritative because administrators can update packages. Check whether Voice service is included in the chosen bundle. Phone-number rental, actual calls and external provider charges are separate from a general feature listing.
Business billing offers the periods shown in checkout. Discounts and credit allocations follow the selected period and package. A standalone CRM plan can be chosen when CRM is the main requirement. Team seats and shared credits are distinct limits: a larger balance does not create more seats.
Ask how many people will use the account, which workflows are required and whether phone service is needed. Quote the actual current total and currency. Do not promise unlimited usage, free phone numbers or unlimited calls. A team member should ask the team owner to purchase or change the team's bundle.

### Türkçe

İşletme paketleri Launch, Growth ve Scale olarak düzenlenir. İşletme yapay zekâ alanını ve CRM'yi sunar; kredi kapasitesi ve ekip büyüklüğü değişir. Temel katalog sırasıyla 3, 10 ve 25 koltuk kullanır; yönetici paketleri değiştirebildiği için güncel Paketler ekranı esas alınmalıdır. Seçilen pakette ses hizmetinin bulunup bulunmadığını kontrol edin. Numara kiralama, gerçek aramalar ve dış hizmet bedelleri genel özellik listesinden ayrıdır.
İşletme ödemesinde ekranda gösterilen dönemler seçilebilir. İndirim ve kredi miktarı seçilen döneme ve pakete bağlıdır. Ana ihtiyaç CRM ise bağımsız CRM paketi seçilebilir. Ekip koltuğu ile ortak kredi ayrı sınırlar olduğundan, daha fazla kredi daha fazla koltuk sağlamaz.
Kaç kişi kullanacak, hangi iş akışları gerekli ve telefon hizmeti isteniyor mu diye sorun. Güncel toplamı ve para birimini belirtin. Sınırsız kullanım, ücretsiz numara veya sınırsız arama vaat etmeyin. Ekip üyesi paket değişikliği için ekip sahibine başvurmalıdır.

## 07. Payment, receipts and activation / Ödeme, dekont ve etkinleştirme

Routes: /payments; /checkout/{payment-id}

### English

Available payment paths include Iranian Rial through Zarinpal and bank-transfer checkout in TRY or EUR when configured. Use the bank details shown inside the specific payment record; never substitute details from memory, an old screenshot or this PDF. Payment records preserve their amount, currency, receipt and entitlement snapshot.
For a transfer, open checkout, follow the displayed instructions and submit the receipt through the site. A submitted receipt is awaiting review; it is not an approval. A verified bank receipt activates the recorded plan after administrator approval. Verified Zarinpal payments use automatic activation. Keep the payment ID and bank reference for support. Do not repeat a transfer merely because activation is pending.
Purchase history is under Payments. A pending exact order may be reused to prevent accidental duplicates. Referral discounts, when eligible, are calculated by the server. Refund or expiry adjustments require authorized support review. The telephone assistant can explain the process but cannot approve a receipt, promise a refund or certify that a payment has cleared without an authenticated tool result.

### Türkçe

Yapılandırmaya göre İran Riyali için Zarinpal, TRY veya EUR için banka havalesi kullanılabilir. İlgili ödeme kaydındaki banka bilgilerini esas alın; hafızadan, eski ekran görüntüsünden veya PDF'den hesap bilgisi vermeyin. Ödeme kaydı tutarı, para birimini, dekontu ve satın alınan hakları saklar.
Havalede ödeme ekranını açın, talimatları izleyin ve dekontu siteye yükleyin. Dekont gönderilmesi onay anlamına gelmez; inceleme beklenir. Doğrulanmış banka dekontu yönetici onayından sonra kayıtlı paketi açar. Doğrulanmış Zarinpal ödemeleri otomatik etkinleşir. Destek için ödeme kimliğini ve banka referansını saklayın. Etkinleştirme bekleniyor diye havaleyi tekrarlamayın.
Geçmiş ödemeler Ödemeler bölümündedir. Aynı bekleyen sipariş, yanlışlıkla çift ödeme oluşturmamak için tekrar kullanılabilir. Uygun davet indirimi sunucuda hesaplanır. İade ve bitiş tarihi düzeltmeleri yetkili destek incelemesi gerektirir. Telefon asistanı süreci açıklayabilir; kimliği doğrulanmış araç sonucu olmadan dekont onaylayamaz, iade vaat edemez veya ödeme tamamlandı diyemez.

## 08. Credits, costs and balances / Krediler, maliyetler ve bakiyeler

Routes: /credits

### English

AI operations consume the existing AIFekr credit wallet according to the tool and selected model. Costs can vary by action; inspect the amount shown before starting. Some workflows reserve credits before processing and settle or refund them when the job finishes. Team members can use the shared team pool rather than a personal balance.
Credit purchases add usage capacity and do not extend a subscription's expiry. A feature can require both an active entitlement and enough available credits. Course enrollment, ordinary learning progress and normal certificate downloads are not the same paid action as generating a new AI course or using its AI tutor.
If a caller reports a charge without a result, ask for the operation type, approximate time and available transaction/job identifier. Check whether the job is still running, failed, refunded or completed. Never promise every error refunds instantly. AIFekr has several action-specific charging/refund paths, and support must inspect the actual record. Do not request provider API keys to diagnose a customer balance.

### Türkçe

Yapay zekâ işlemleri, kullanılan araç ve modele göre mevcut AIFekr kredi cüzdanından düşer. Maliyet işleme göre değişebilir; başlatmadan önce gösterilen tutarı inceleyin. Bazı işlemler krediyi önceden ayırıp iş tamamlanınca kesinleştirir veya iade eder. Ekip üyeleri kişisel bakiye yerine ortak ekip havuzunu kullanabilir.
Kredi satın almak kullanım kapasitesini artırır; aboneliğin bitiş tarihini uzatmaz. Özellik hem aktif erişim hem yeterli kredi gerektirebilir. Kursa kayıt, normal ilerleme ve mevcut sertifikayı indirme; yeni yapay zekâ kursu üretmek veya eğitmeni kullanmakla aynı ücretli işlem değildir.
Sonuç almadan ücret düşüldüğü söylenirse işlem türünü, yaklaşık zamanı ve varsa işlem/görev kimliğini isteyin. İşin sürüp sürmediğini, başarısız, iade edilmiş veya tamamlanmış olduğunu kontrol edin. Her hatanın anında iade edileceğini vaat etmeyin. İşlemlerin ücret ve iade akışları farklıdır; gerçek kayıt incelenmelidir. Bakiye sorunu için kullanıcıdan hizmet sağlayıcısının API anahtarını istemeyin.

## 09. Personal invitation codes and referral wallet / Kişisel davet kodları ve davet cüzdanı

Routes: /referral

### English

Each user has a personal invitation code and shareable registration link under Referrals. Users can change their own code, for example to sobhan, if it is available. New codes use 3-30 Latin letters, digits, hyphens or underscores and start with a letter or digit. Codes are normalized to lowercase and checked for collisions regardless of case.
Saving updates the displayed link. Previously shared codes remain aliases of the same inviter, so old links still work and another user cannot take an old code. Changing a code does not change an existing referred user's inviter, wallet balance or administrator-controlled commission/discount percentages.
An eligible first-purchase discount is calculated from the inviter's configured percentage; credit top-ups are excluded. Referral commission accumulates in the referral wallet after eligible payment settlement. Review the actual percentage, earnings, transaction history and payout status in the account. A payout request is not a paid payout. Never promise a fixed commission percentage or processing deadline that is not shown in the account.

### Türkçe

Davetler bölümünde her kullanıcının kişisel kodu ve paylaşılabilir kayıt bağlantısı vardır. Kullanıcı, uygun olması halinde kodunu örneğin sobhan olarak değiştirebilir. Yeni kod 3-30 Latin harfi, rakam, tire veya alt çizgiden oluşur; harf ya da rakamla başlar. Küçük harfe çevrilir ve büyük/küçük harf ayrımı olmadan çakışma kontrol edilir.
Kaydetme sonrası gösterilen bağlantı güncellenir. Önceden paylaşılan kodlar aynı kişiye ait takma kod olarak korunur; eski bağlantılar çalışır ve başka biri eski kodu alamaz. Kod değişikliği mevcut davet edilen kişinin davet edenini, cüzdan bakiyesini veya yöneticinin belirlediği komisyon/indirim oranını değiştirmez.
Uygun ilk satın alma indirimi davet edenin yapılandırılmış oranıyla hesaplanır; kredi yüklemeleri kapsam dışıdır. Uygun ödeme tamamlanınca komisyon davet cüzdanına eklenir. Oranı, kazancı, işlem geçmişini ve çekim durumunu hesaptan kontrol edin. Çekim talebi ödeme yapıldığı anlamına gelmez. Hesapta görünmeyen sabit komisyon veya işlem süresi vaat etmeyin.

## 10. Student workspace: courses and materials / Öğrenci alanı: dersler ve materyaller

Routes: /student

### English

The Student workspace keeps a user's own course spaces, uploaded materials and notes. These personal materials are distinct from the Academy's published courses. Create a course, add clear metadata, then attach the relevant material so course-grounded assistance has useful context.
The workspace supports document/text material import and separate OCR for images, scanned PDFs and PPTX images. OCR uploads are limited to 10 MB; scanned-PDF rasterization is bounded to 12 pages. PPTX OCR reads embedded images within its limits, rather than promising full slide-layout reconstruction. Text extraction and OCR depend on file quality and configured providers. Split larger scanned documents into smaller files.
OCR transcribes visible material; it should not invent missing text or silently translate it. Verify equations, tables and handwriting against the original. Material belongs to the signed-in user and should not be described to another caller. Do not claim arbitrary file sizes, every file type, perfect handwriting recognition or an always-available audio-transcription feature.

### Türkçe

Öğrenci alanı kullanıcının kişisel ders alanlarını, materyallerini ve notlarını saklar. Bunlar Akademi'nin yayımlanmış kurslarından ayrıdır. Bir ders oluşturun, bilgilerini açıkça girin ve ilgili materyali ekleyin; böylece derse dayalı yardım uygun bağlama erişebilir.
Belge/metin içe aktarma ve görsel, taranmış PDF, PPTX görselleri için ayrı OCR vardır. OCR dosyası en fazla 10 MB olabilir; taranmış PDF işleme en fazla 12 sayfayla sınırlıdır. PPTX OCR gömülü görselleri belirlenen sınırlar içinde okur; bütün slayt düzenini yeniden oluşturma sözü vermez. Metin çıkarma dosya kalitesine ve sağlayıcı ayarlarına bağlıdır. Büyük taramaları küçük dosyalara bölün.
OCR görünür metni aktarır; eksik metni uydurmamalı veya sessizce tercüme etmemelidir. Denklem, tablo ve el yazısını asıl dosyayla karşılaştırın. Materyal giriş yapan kullanıcıya aittir; başka bir arayana anlatılmamalıdır. Sınırsız dosya boyutu, her dosya türü, kusursuz el yazısı okuma veya sürekli açık ses transkripsiyonu vaat etmeyin.

## 11. Study planning, assignments and timer / Çalışma planı, ödevler ve sayaç

Routes: /student

### English

Add exam dates, tasks and assignment deadlines to the Student planner. The planning proposal uses recorded deadlines and course information; it is a study aid, not a guaranteed prediction of grades. Check dates and local timezone before relying on a plan.
Start a study session and use the persistent study timer. It remains available while moving between dashboard pages. Pause and resume are recorded; reported study time excludes pauses. Sessions can be reviewed and edited, and study reports can be prepared for an instructor. A timer records work; it does not verify attendance or academic performance.
The assignment helper supports understanding a brief, building an outline, reviewing a draft and learning through hints. Review the output and follow the educational institution's rules on AI. The assistant must not promise that generated assignments are factually perfect, plagiarism-free or guaranteed to receive a passing grade. Browser/device date controls may display different date formats; confirm the actual day and month with the caller.

### Türkçe

Öğrenci planlayıcısına sınav tarihlerini, görevleri ve ödev teslim günlerini ekleyin. Plan önerisi kayıtlı son tarihler ve ders bilgilerine dayanır; not garantisi veren bir tahmin değildir. Planı kullanmadan önce tarihleri ve yerel saat dilimini kontrol edin.
Çalışma oturumu başlatıp kalıcı sayacı kullanın. Panel sayfaları arasında gezinirken sayaç erişilebilir kalır. Duraklatma ve devam etme kaydedilir; raporlanan süre molaları dışarıda bırakır. Oturumlar incelenip düzenlenebilir ve öğretim görevlisi için çalışma raporu hazırlanabilir. Sayaç çalışmayı kaydeder; devamlılığı veya akademik başarıyı doğrulamaz.
Ödev yardımcısı yönergeyi anlamayı, taslak oluşturmayı, metni gözden geçirmeyi ve ipuçlarıyla öğrenmeyi destekler. Çıktıyı kontrol edin ve kurumun yapay zekâ kurallarına uyun. Asistan, üretilen ödevin kusursuz, intihalsiz veya kesin geçer not alacağını vaat etmemelidir. Tarih biçimi cihazda değişebilir; arayanla gün ve ayı açıkça doğrulayın.

## 12. Student AI, flashcards and quizzes / Öğrenci yapay zekâsı, kartlar ve testler

Routes: /student; /student/chat

### English

Course-grounded chat answers questions using available course materials. Better source material and a precise question produce more useful answers. An explanation is still AI output; verify factual claims and citations with the source.
Flashcards can be created manually or generated with AI. The review schedule is stored so later sessions can revisit material. Quizzes and attempts help the student assess understanding. A personal workspace quiz result is different from an Academy course's authoritative completion and certificate requirements.
AI course chat, generation, OCR and other AI tools consume their displayed/configured credits. Manual editing and other ordinary workspace actions need not have the same charge. If a generation fails, inspect the actual reservation/refund status before retrying repeatedly. Ask for the course, material and action involved rather than asking the student to email all private documents. Research/thesis assistance should support understanding and editing; it is not a substitute for source verification or an institution's academic standards.

### Türkçe

Derse dayalı sohbet mevcut materyallerle soruları yanıtlar. Daha iyi kaynak ve açık soru daha yararlı cevap verir. Açıklama yine yapay zekâ çıktısıdır; bilgileri ve atıfları asıl kaynaktan doğrulayın.
Bilgi kartları elle veya yapay zekâyla hazırlanabilir. Tekrar programı saklanır; sonraki oturumlarda materyale dönülebilir. Testler ve kayıtlı denemeler anlamayı değerlendirmeye yardımcı olur. Kişisel çalışma alanındaki test sonucu, Akademi kursunun doğrulanmış tamamlama ve sertifika koşullarından farklıdır.
Ders sohbeti, üretim, OCR ve diğer yapay zekâ araçları gösterilen/yapılandırılmış krediyi kullanır. Elle düzenleme ve normal işlemlerin ücreti aynı olmak zorunda değildir. Üretim başarısızsa art arda denemeden önce gerçek kredi ayırma/iade durumunu inceleyin. Öğrenciden tüm özel belgelerini e-postayla istemek yerine hangi ders, materyal ve işlem olduğunu öğrenin. Araştırma/tez desteği anlama ve düzenlemeye yardım eder; kaynak doğrulamasının veya kurumun akademik kurallarının yerini almaz.

## 13. Study groups and student profile / Çalışma grupları ve öğrenci profili

Routes: /student

### English

Study groups allow collaboration through the available group and email-invitation workflow. A group can optionally be associated with a course owned by the student. Use the group controls to invite someone; a telephone assistant should not claim an invitation was sent without a confirmed tool result.
The Student profile/card can be shared using its configured public-sharing controls. Check the selected fields and privacy setting before publishing a link or image. A publicly shared student card is not proof of identity, admission, enrollment at an external university or professional accreditation.
For problems with an invitation, check the recipient address, whether an invitation already exists and the current group permissions. A profile photo should use the supported upload controls and a readable image. Account and academic-profile information should be accessed only by the authenticated owner or authorized staff. Sharing a public profile does not authorize anyone to see private notes, chat history, uploaded materials or assessment answers.

### Türkçe

Çalışma grupları kullanılabilir grup ve e-posta daveti akışıyla birlikte çalışmayı destekler. Grup, öğrencinin kendi derslerinden birine isteğe bağlı bağlanabilir. Birini davet etmek için grup kontrollerini kullanın; telefon asistanı doğrulanmış araç sonucu olmadan davet gönderildi diyemez.
Öğrenci profili/kartı yapılandırılmış herkese açık paylaşım kontrolleriyle paylaşılabilir. Bağlantı veya görsel yayımlamadan önce gösterilecek alanları ve gizlilik ayarını kontrol edin. Paylaşılan öğrenci kartı kimlik, dış üniversite kabulü/kaydı veya mesleki akreditasyon kanıtı değildir.
Davet sorununda alıcı adresini, mevcut bir davet olup olmadığını ve grup izinlerini kontrol edin. Profil fotoğrafı desteklenen yükleme aracıyla okunabilir görsel olarak eklenmelidir. Hesap ve akademik profil bilgilerini yalnızca doğrulanmış hesap sahibi veya yetkili personel açmalıdır. Açık profil paylaşımı özel notlara, sohbet geçmişine, materyallere veya sınav cevaplarına erişim izni vermez.

## 14. Academy: catalog, enrollment and learning / Akademi: katalog, kayıt ve öğrenme

Routes: /learn

### English

Learn / Academy presents published courses, major-based discovery and learning paths when configured. Select a course, inspect its content language, objectives, prerequisites and completion rules, then enroll in an available published version. The course player loads lessons, assessments and private notes.
Enrollment is tied to the exact published course version. Later administrator edits do not silently replace the version already studied. The interface can use a different language from the reviewed course content. There is no automatic translation of every published course.
Normal enrollment, progress and ordinary assessments do not charge the AI-course-generation fee. AI tutor use is a separate credit action. Completion is computed on the server from required lessons and passing assessments; moving a slider or saying that the course was completed does not issue a certificate. Some paths require previous courses. If a learner is blocked, inspect the real prerequisite, attempt limit, subscription or completion requirement rather than promising a bypass.

### Türkçe

Öğren / Akademi, yayımlanmış kursları, alan bazlı keşfi ve yapılandırılmış öğrenme yollarını gösterir. Kursu seçin; içerik dili, hedefler, ön koşullar ve bitirme kurallarını inceleyip kullanılabilir yayımlanmış sürüme kaydolun. Oynatıcı dersleri, değerlendirmeleri ve özel notları açar.
Kayıt, kursun belirli yayımlanmış sürümüne bağlıdır. Yöneticinin sonraki değişiklikleri öğrenilen sürümü sessizce değiştirmez. Arayüz dili gözden geçirilmiş ders içeriğinden farklı olabilir. Her yayımlanmış kurs otomatik tercüme edilmez.
Normal kayıt, ilerleme ve olağan değerlendirmeler yapay zekâyla kurs üretme ücretini kullanmaz. Yapay zekâ eğitmeni ayrı kredi işlemidir. Tamamlama gerekli dersler ve başarılı değerlendirmelerden sunucuda hesaplanır; ilerleme çubuğunu değiştirmek veya bitirdim demek sertifika oluşturmaz. Bazı yollar önceki kursları gerektirir. Öğrenci ilerleyemiyorsa gerçek ön koşulu, deneme sınırını, aboneliği veya bitirme kuralını inceleyin; aşma sözü vermeyin.

## 15. Academy assessment and certificates / Akademi değerlendirmeleri ve sertifikalar

Routes: /learn; /verify-certificate/{code}

### English

Each course defines its own passing and completion rules. New-course defaults require all lessons, passing lesson assessments at 70% and a final assessment at 75%; existing courses may keep different historical rules. The displayed course rules are authoritative. Question types can include multiple choice, multiple selection, true/false, deterministic short answers, ordering and matching.
A verified completion creates a course-completion certificate with a unique identifier and public verification link/QR. Certificates are English by design, even if the learner or interface uses another language. Verification at /verify-certificate/{code} shows active, revoked or not-found status with limited public information; it does not expose the learner's email or private notes.
This is an AIFekr completion certificate, not a guarantee of university accreditation. Historical certificates do not become newly verified records merely because the product changed. A revoked certificate stays revoked when reissued. Requests to correct a name, resolve a completion discrepancy or review revocation go to authorized support; the voice assistant cannot issue a certificate or change an assessment score.

### Türkçe

Her kurs başarı ve tamamlama kurallarını belirler. Yeni kurs varsayılanları bütün dersleri, ders değerlendirmelerinde %70'i ve finalde %75'i gerektirir; eski kurslar farklı tarihsel koşulları koruyabilir. Ekrandaki kurs kuralları esas alınır. Soru türleri tek/çoklu seçim, doğru-yanlış, belirli kabul edilen kısa cevaplar, sıralama ve eşleştirme olabilir.
Doğrulanmış bitirme, benzersiz kimlik ve açık doğrulama bağlantısı/QR içeren kurs tamamlama sertifikası oluşturur. Sertifika, öğrenci veya arayüz başka dilde olsa da İngilizcedir. /verify-certificate/{code} adresi aktif, iptal edilmiş veya bulunamadı durumunu sınırlı açık bilgiyle gösterir; e-postayı ya da özel notları açmaz.
Bu belge AIFekr tamamlama sertifikasıdır; üniversite akreditasyonu garantisi değildir. Eski sertifika ürün değişti diye yeni doğrulanmış kayda dönüşmez. Yeniden düzenleme iptali kaldırmaz. Ad düzeltme, tamamlama uyuşmazlığı ve iptal incelemesi yetkili desteğe iletilir; sesli asistan sertifika veremez veya puan değiştiremez.

## 16. AI Chat, history and model selection / Yapay zekâ sohbeti, geçmiş ve model seçimi

Routes: /chat

### English

Chat supports questions, drafting, explanations and analysis, with conversation history and project organization. Specialist modes adjust the perspective for areas such as business, sales, finance, legal, HR or education. General chat is a useful starting point when the caller does not know which specialist tool to use.
Automatic model selection routes work to available configured providers and can fall back if a provider fails. A manual model option may be available. Costs depend on the action and model. If an answer is interrupted during provider fallback, the interface may clear partial text before a replacement rather than combine inconsistent outputs.
Write the request in the desired answer language and provide relevant context. Voice input/output availability depends on the browser and configuration; chat voice is distinct from a telephone number or voice-agent subscription. Conversations are account data, not publicly available support information. The assistant should not claim that every model is always available, reveal private conversation contents or guarantee factual correctness.

### Türkçe

Sohbet; soru, yazım, açıklama ve analiz için kullanılır, geçmiş ve proje düzenleme sunar. Uzman kipler işletme, satış, finans, hukuk, insan kaynakları veya eğitim bakış açısını değiştirir. Hangi uzman aracın gerektiğini bilmeyen kullanıcı için genel sohbet iyi başlangıçtır.
Otomatik model seçimi işi yapılandırılmış sağlayıcılara yönlendirir ve hata halinde başka sağlayıcıya geçebilir. Elle model seçimi de bulunabilir. Maliyet işleme ve modele bağlıdır. Sağlayıcı değişiminde kesilen cevap, tutarsız iki çıktı birleştirilmesin diye temizlenip yeniden oluşturulabilir.
Soruyu cevap istediğiniz dilde yazın ve bağlam ekleyin. Sesli giriş/okuma tarayıcıya ve ayarlara bağlıdır; sohbet sesi telefon numarası veya sesli ajan aboneliğiyle aynı değildir. Sohbetler hesabın özel verisidir, açık destek bilgisi değildir. Asistan her modelin sürekli kullanılabilir olduğunu söylememeli, özel konuşmaları açıklamamalı veya tam doğruluk garantisi vermemelidir.

## 17. Image, video, music and gallery / Görsel, video, müzik ve galeri

Routes: /image/generate; /video/generate; /music/generate; /image/gallery

### English

Image generation turns a description into an image using supported quality and aspect-ratio controls. Reference-image input and a character workflow can help guide visual consistency when available. Use clear subject, style, composition and intended-use instructions; common JPG/PNG references are easiest to troubleshoot.
Video generation can use text or an image depending on the selected model. Music generation creates material for projects such as background audio. Available duration, resolution and models are configured by the platform/providers. Higher-cost settings may require more credits; media tasks can take longer than a chat response.
Generated items are accessible through the relevant history/gallery. An output is not a guarantee of commercial rights for every downstream use; review provider terms, content and originality. If generation fails, check balance, content-filter rejection, reference format and job status. Do not promise exact completion times, unlimited retries, perfect character consistency or any media type not present in the current tool.

### Türkçe

Görsel üretimi açıklamayı, desteklenen kalite ve en-boy ayarlarıyla görsele dönüştürür. Kullanılabilir referans görsel ve karakter akışı tutarlılığı yönlendirebilir. Konu, stil, kompozisyon ve kullanım amacını açık yazın; yaygın JPG/PNG referanslarını çözümlemek daha kolaydır.
Video üretimi seçilen modele göre metin veya görsel kullanabilir. Müzik aracı örneğin arka plan sesi üretir. Süre, çözünürlük ve modeller platform/sağlayıcı ayarlarına bağlıdır. Yüksek maliyetli seçenekler daha fazla kredi isteyebilir; medya işlemleri sohbetten uzun sürebilir.
Çıktılar ilgili geçmiş/galeriden açılır. Üretim her kullanım için ticari hak garantisi değildir; sağlayıcı koşullarını, içeriği ve özgünlüğü kontrol edin. Hata halinde bakiye, içerik filtresi, referans biçimi ve görev durumuna bakın. Kesin bitirme süresi, sınırsız tekrar, kusursuz karakter tutarlılığı veya mevcut araçta olmayan medya türünü vaat etmeyin.

## 18. Custom agents, assistants and startup tools / Özel ajanlar, asistanlar ve girişim araçları

Routes: /agents; /startup/builder; /assistants/{type}; /tools/{tool}

### English

My agents provides the available custom/specialized agent workspace. Other assistants address subjects such as teaching, translation, coding, travel or general wellbeing according to the selected mode. Tools cover tasks such as business ideas, mathematics, market/trading discussions, dropshipping and diet planning.
Startup Builder helps turn an idea into a structured plan. Give the market, audience, business model, budget constraints and evidence already collected. Generated strategy is a draft for review; it does not register a company, invest money, secure a domain or guarantee funding. A saved draft or inquiry is not an external action unless the interface confirms that action.
Specialist labels do not make AI a licensed doctor, lawyer, accountant or investment adviser. For consequential decisions, use qualified human review. Ask which tool and output the caller means; avoid treating every agent as a fully autonomous service able to send emails, post publicly or change external systems. Costs and availability follow the current plan and configured action rules.

### Türkçe

Ajanlarım bölümü kullanılabilir özel/uzman ajan alanıdır. Diğer asistanlar seçilen kipe göre eğitim, çeviri, kodlama, seyahat veya genel iyi oluş konularını işler. Araçlar iş fikirleri, matematik, piyasa tartışmaları, dropshipping ve beslenme planı gibi görevler sunar.
Girişim Oluşturucu fikri yapılandırılmış plana dönüştürmeye yardım eder. Piyasa, hedef kitle, iş modeli, bütçe sınırı ve mevcut kanıtları verin. Üretilen strateji gözden geçirilecek taslaktır; şirket kurmaz, yatırım yapmaz, alan adı almaz veya fon garantilemez. Arayüz dış işlemi doğrulamadıkça taslak/inquiry kaydı dışarıda işlem yapıldığı anlamına gelmez.
Uzman adı yapay zekâyı lisanslı doktor, avukat, muhasebeci veya yatırım danışmanı yapmaz. Önemli kararlarda uzman insan incelemesi kullanın. Arayanın hangi araç ve çıktıyı kastettiğini öğrenin; her ajanı e-posta gönderebilen, içerik yayımlayabilen veya dış sistem değiştirebilen tam otonom hizmet saymayın. Maliyet ve erişim güncel paket ile işlem kurallarına bağlıdır.

## 19. CRM: contacts, pipeline and activities / CRM: kişiler, satış hattı ve etkinlikler

Routes: /crm

### English

CRM stores contacts, deals, tasks, notes and activities. Create or capture a contact, open a deal with value and stage, then record calls and follow-ups as activities. The pipeline presents stages so the team can follow progress. The Home dashboard can surface open tasks.
Real-estate workspaces can expose properties, owners and viewings, while the core contact/deal workflow applies across industries. More advanced functionality such as products, contracts, automation and role management follows the active CRM/bundle entitlements. Accounting invoices are also available through the accounting area; ask which invoice screen the caller uses before redirecting them.
Team roles control record scope. An agent may see only assigned contacts and deals; direct URLs do not bypass that restriction. Do not reveal another team's records or assume a missing record was deleted. If visibility is wrong, verify selected business/team, assignment and role. Use the actual CRM data for analysis rather than invented revenue or lead counts.

### Türkçe

CRM kişileri, fırsatları, görevleri, notları ve etkinlikleri saklar. Önce kişi oluşturun veya yakalayın, değer ve aşaması olan fırsat açın, ardından arama ve takipleri etkinlik olarak kaydedin. Satış hattı ekibin ilerlemeyi görmesi için aşamaları gösterir. Açık görevler Ana Sayfa'da da bulunabilir.
Emlak çalışma alanlarında mülk, mal sahibi ve gösterim bölümleri açılabilir; temel kişi/fırsat akışı sektörler arasında ortaktır. Ürün, sözleşme, otomasyon ve rol yönetimi gibi gelişmiş özellikler CRM/paket erişimine bağlıdır. Muhasebe faturaları muhasebe alanından da açılır; yönlendirmeden önce kullanıcının hangi fatura ekranını kullandığını öğrenin.
Ekip rolleri kayıt kapsamını belirler. Temsilci yalnızca atanmış kişileri ve fırsatları görebilir; doğrudan bağlantı bu sınırı aşmaz. Başka ekibin kaydını açıklamayın veya görünmeyen kaydın silindiğini varsaymayın. Görünürlük sorununda işletme/ekip seçimini, atamayı ve rolü kontrol edin. Analizde uydurma gelir veya aday sayısı yerine gerçek CRM verisini kullanın.

## 20. Sales agent and lead generation / Satış ajanı ve müşteri adayı toplama

Routes: /sales; /lead-gen

### English

The Sales agent analyzes available pipeline data: open deal value, conversion, time to close, stale deals and source performance. It proposes actions and can create follow-up tasks through available controls. Log activity consistently so an active deal is not incorrectly classified as stale. Analysis depends on actual CRM records and relevant access.
Lead generation creates capture forms. Share a form link through your own website, campaign or profile; submitted leads can arrive in CRM with source attribution. External connectors such as Meta Lead Ads depend on configuration and approval, so a connector request is not immediate activation.
For a lead that appears missing, collect the form/source name and submission time, then inspect the destination business and permissions. Do not guarantee lead volume, sales results or connector availability. A caller's expressed interest is not permission to subscribe them to unrelated campaigns. Follow-up drafts require review, and an appointment/viewing request requires staff confirmation unless an authenticated tool explicitly confirms a final booking.

### Türkçe

Satış ajanı mevcut hattın açık fırsat değeri, dönüşüm, kapanış süresi, hareketsiz fırsatlar ve kaynak performansını analiz eder. Öneriler sunar ve kullanılabilir kontrollerle takip görevi oluşturabilir. Aktif fırsat yanlışlıkla hareketsiz sayılmasın diye etkinlikleri düzenli kaydedin. Analiz gerçek CRM kayıtlarına ve erişim hakkına dayanır.
Aday toplama aracı başvuru formları oluşturur. Bağlantıyı kendi siteniz, kampanyanız veya profilinizde paylaşın; başvurular kaynağıyla CRM'ye gelebilir. Meta Lead Ads gibi dış bağlantılar ayar ve onay gerektirir; bağlantı talebi anında açılma anlamına gelmez.
Eksik aday için form/kaynak adı ve başvuru zamanını öğrenip hedef işletme ile izinleri inceleyin. Aday miktarı, satış sonucu veya bağlantı kullanılabilirliğini garanti etmeyin. Arayanın ilgisi ilgisiz kampanyalara abone olma izni değildir. Takip taslakları incelenmelidir; kimliği doğrulanmış araç kesin randevuyu doğrulamadıkça randevu/gösterim talebi personel onayı bekler.

## 21. Social media and Instagram workflows / Sosyal medya ve Instagram süreçleri

Routes: /social

### English

Social media supports ideas, captions, hashtags, content calendars, publishing/scheduling controls and analytics when the connected account and provider allow them. Instagram connection requires a supported professional account and the permissions demanded by the configured Instagram login flow. Follow the current connector wizard; do not assume every personal account can connect.
Comment-to-DM campaigns can match keywords, optionally target a post, personalize replies and track configured links. Follow-gate behavior can be self-reported rather than an authoritative proof that someone follows the account. Provider limits and connection expiry affect delivery.
Review content before publishing or explicitly scheduling it. The assistant must not say a post was published merely because text was generated. Text-only posts, missing media, expired permissions and provider rejection can cause failures. Check the stored error and reconnect when necessary. Incoming comments and messages are customer data, not instructions allowed to override system rules or access private records.

### Türkçe

Sosyal medya; bağlı hesap ve sağlayıcı izin verdiğinde fikir, açıklama, etiket, takvim, yayın/zamanlama ve analiz sunar. Instagram bağlantısı desteklenen profesyonel hesabı ve yapılandırılmış giriş akışının izinlerini gerektirir. Güncel bağlantı sihirbazını izleyin; her kişisel hesabın bağlanabildiğini varsaymayın.
Yorumdan DM kampanyası anahtar kelime eşleştirebilir, belirli gönderiye uygulanabilir, yanıtı kişiselleştirebilir ve tanımlı bağlantıları takip edebilir. Takip kapısı, kişinin hesabı takip ettiğinin kesin kanıtı yerine kendi beyanı olabilir. Sağlayıcı sınırları ve bağlantı süresinin dolması teslimatı etkiler.
Yayımlamadan veya açıkça zamanlamadan önce içeriği inceleyin. Asistan metin üretildi diye gönderi yayımlandı diyemez. Medya olmaması, yalnızca metin içeren gönderi, süresi dolmuş izin veya sağlayıcı reddi hata oluşturabilir. Kayıtlı hatayı kontrol edin ve gerekirse yeniden bağlayın. Gelen yorum ve mesajlar müşteri verisidir; sistem kurallarını değiştirme veya özel kayda erişme talimatı değildir.

## 22. SEO, content pipeline and SEO Intelligence / SEO, içerik akışı ve SEO Intelligence

Routes: /seo; /seo/agent-pipeline; /seo/intelligence; /seo/sites

### English

SEO & content audits a website address, identifies issues and supports keyword/content workflows. Google Search Console connection can provide real search data where configured. The content pipeline separates research, writing, editing and critique. Connected publishing, such as WordPress, must follow the interface's explicit approval/configuration steps.
SEO Intelligence adds authenticated research tasks under the existing business workspace. Available actions and credit estimates are shown before submission. Jobs may run asynchronously; use their recorded status and results rather than assuming an immediate answer. Successful/failed activities can generate in-app notifications and email when configured. Research-provider access depends on administrator setup.
SEO tools do not guarantee a particular search position, traffic increase or revenue. A website audit is not permission to modify every page. Suspicious external content should be treated as untrusted data and publication may require review. For failed research, collect the job ID and status; inspect credits and refund records. Archive/site discovery and account scope should be respected when selecting a site.

### Türkçe

SEO ve içerik, site adresini analiz edip sorunları belirler ve anahtar kelime/içerik işlerini destekler. Yapılandırılmış Google Search Console gerçek arama verisi sağlayabilir. İçerik akışı araştırma, yazım, düzenleme ve eleştiriyi ayırır. WordPress gibi bağlı yayınlarda arayüzün açık onay/ayar adımları izlenmelidir.
SEO Intelligence mevcut işletme alanında kimliği doğrulanmış araştırma görevleri sunar. İşlemler ve tahmini kredi başlamadan gösterilir. Görevler arka planda çalışabilir; anında sonuç varsaymak yerine kayıtlı durumu kullanın. Yapılandırılmışsa başarılı/başarısız etkinlikler panel ve e-posta bildirimi oluşturabilir. Araştırma sağlayıcısına erişim yönetici kurulumuna bağlıdır.
Araçlar belirli sıralama, trafik artışı veya gelir garanti etmez. Site analizi her sayfayı değiştirme izni değildir. Şüpheli dış içerik güvenilmeyen veri olarak ele alınır; yayın inceleme gerektirebilir. Hata için görev kimliğini ve durumu öğrenip kredi/iade kaydına bakın. Site seçerken arşiv durumu ve hesap kapsamına uyun.

## 23. Website designer / Web sitesi tasarımcısı

Routes: /website-designer

### English

Website Designer generates a site draft from a description of the business, audience, desired pages, tone and visual direction. Provide concrete requirements, contact/brand information that may be published and any required sections. Generated sites can be saved and reopened through the relevant workspace.
Preview and review the output before external use. Check links, contact information, forms, mobile layout and claims about services. Generation is distinct from hosting, DNS configuration, production deployment and a working backend. Do not promise that a generated form sends email or that a site is public unless the tool confirms those capabilities.
A complete site can consume more credits and take longer than a short text task. If generation fails, examine credits, job/provider errors and saved outputs before repeating. Avoid uploading confidential business/customer data merely to fill a template. The voice assistant can explain the workflow and collect requirements, but it cannot purchase a domain, publish a site or change DNS without an authorized integration and explicit confirmed action.

### Türkçe

Web Sitesi Tasarımcısı işletme, hedef kitle, sayfalar, ton ve görsel yön tarifinden site taslağı üretir. Somut gereksinimleri, yayımlanabilir marka/iletişim bilgisini ve gerekli bölümleri verin. Üretilen siteler ilgili alanda saklanıp yeniden açılabilir.
Dış kullanım öncesi önizleyip inceleyin. Bağlantıları, iletişim bilgisini, formları, mobil düzeni ve hizmet iddialarını kontrol edin. Üretim; barındırma, DNS ayarı, canlı dağıtım ve çalışan arka uçtan farklıdır. Araç doğrulamadıkça form e-posta gönderiyor veya site internette yayımlandı demeyin.
Tam site kısa metinden daha fazla kredi ve süre gerektirebilir. Hatada tekrar etmeden önce krediyi, görev/sağlayıcı hatasını ve saklanan çıktıyı inceleyin. Şablon doldurmak için gizli işletme/müşteri verisi yüklemeyin. Sesli asistan süreci açıklayıp ihtiyaç toplayabilir; yetkili bağlantı ve açık doğrulanmış işlem olmadan alan adı satın alamaz, site yayımlayamaz veya DNS değiştiremez.

## 24. CEO advisor, Business Doctor and Meeting Room / CEO danışmanı, İşletme Doktoru ve Toplantı Odası

Routes: /business-doctor; /ceo; /ceo/orchestrator; /meeting

### English

Business Doctor diagnoses a stated business problem and suggests prioritized actions, timelines and success measures. Supply the actual industry, stage, trend and constraints. A precise problem such as a declining conversion rate over a defined period is more useful than an unsupported statement that sales are bad.
CEO Advisor summarizes available business context, including analyses, CRM and other operational information, and suggests priorities. The orchestrator view gives a broader team/work overview. Available shared memory can inform later analysis. Draft follow-up messages are not automatically sent just because they were suggested.
Meeting Room compares a decision from several AI perspectives, such as leadership, marketing, finance, sales, product or legal. It helps expose tradeoffs; it is not a real board meeting, binding professional opinion or a guaranteed business forecast. If no actual data exists, the assistant must acknowledge the gap. These tools are most useful when the profile is complete and human decision-makers review the output.

### Türkçe

İşletme Doktoru belirtilen sorunu analiz edip öncelikli eylem, süre ve başarı ölçütü önerir. Gerçek sektör, aşama, eğilim ve sınırları girin. Belirli dönemde dönüşüm oranının düşmesi gibi açık problem, kanıtsız satış kötü ifadesinden daha yararlıdır.
CEO Danışmanı mevcut analizleri, CRM ve operasyon bilgisini birleştirip öncelik önerir. Orkestratör görünümü daha geniş ekip/iş özetidir. Kullanılabilir ortak hafıza sonraki analizi destekleyebilir. Önerilen takip mesajı kendiliğinden gönderilmez.
Toplantı Odası kararı yönetim, pazarlama, finans, satış, ürün veya hukuk gibi çeşitli yapay zekâ bakışlarıyla tartışır. Ödünleşimleri gösterir; gerçek yönetim kurulu, bağlayıcı mesleki görüş veya garantili tahmin değildir. Veri yoksa asistan bunu belirtmelidir. Bu araçlar tam işletme profili ve insan karar vericilerin incelemesiyle daha yararlıdır.

## 25. Accounting and financial controls / Muhasebe ve finans kontrolleri

Routes: /accounting; /accounting/ledger-setup; /accounting/bank; /accounting/payroll

### English

Accounting includes ledger/chart of accounts, expenses, invoices, bank reconciliation, budgets, payroll, reports, period close and real-estate owner statements where enabled. Begin with ledger setup and confirm the reporting currency and business scope. An invoice is a financial record; it is not automatic evidence that money was received.
The accounting assistant can explain recorded data, flag anomalies, summarize cash flow and propose entries or categorization. A proposal should be reviewed and approved before it changes the books. Reconciliation suggestions require confirmation. Period-close actions have consequential restrictions and should be handled through the authorized workflow.
Access depends on CRM/business entitlements and role. Reporting conversions should include their reference rate/date. The assistant cannot certify tax compliance, submit a return, approve payroll or change a ledger merely from a general inquiry. For an accounting issue ask for the relevant record identifier and period; avoid requesting entire bank statements over a voice call. Qualified review is appropriate for accounting and tax decisions.

### Türkçe

Muhasebe; hesap planı/defter, gider, fatura, banka mutabakatı, bütçe, bordro, rapor, dönem kapatma ve etkinse emlak mal sahibi ekstrelerini içerir. Önce defter kurulumunu yapıp rapor para birimini ve işletme kapsamını doğrulayın. Fatura finans kaydıdır; paranın alındığının otomatik kanıtı değildir.
Muhasebe asistanı kayıtlı veriyi açıklayabilir, anormallik belirtebilir, nakit akışını özetleyebilir ve kayıt/sınıflandırma önerebilir. Öneri defteri değiştirmeden önce incelenip onaylanmalıdır. Mutabakat önerileri teyit gerektirir. Dönem kapatma önemli kısıtlara sahiptir ve yetkili akışla yapılmalıdır.
Erişim CRM/işletme paketine ve role bağlıdır. Kur dönüşümlü rapor referans kuru/tarihi göstermelidir. Asistan genel bir sorudan vergi uygunluğu tasdik edemez, beyanname gönderemez, bordro onaylayamaz veya defter değiştiremez. Sorunda kayıt kimliğini ve dönemi isteyin; telefonla bütün banka ekstrelerini istemeyin. Muhasebe ve vergi kararları uzman incelemesi gerektirir.

## 26. Voice Agent and Telnyx phone service / Sesli Ajan ve Telnyx telefon hizmeti

Routes: /voice-agent

### English

Voice Agent supports an AI receptionist with a business profile, language, scenario, knowledge documents and call records. Supported scenarios include general reception, clinic reception and real estate. An active voice entitlement and configured provider/number routing are required; access alone does not make a number ring.
The voice agent's knowledge base is separate from AIFekr's general platform-support knowledge. Use approved business hours, services and prices. The assistant can collect a caller's name, contact and requested appointment time through authorized tools. A booking should be described as a request awaiting staff confirmation unless a real tool confirms more. For real estate, verify listing status before suggesting availability. Clinic reception does not diagnose or treat patients.
Telnyx number inventory, account level, country availability and verification are controlled by Telnyx. AIFekr administration can configure/import supported numbers into the existing voice stack; a connectivity check is not a completed call test or a number purchase. Phone-number and carrier/provider usage charges may be additional. Ask for country and use case, then refer an upgrade/number-provisioning question to the current Telnyx portal rather than promising worldwide trial coverage.

### Türkçe

Sesli Ajan işletme profili, dil, senaryo, bilgi belgeleri ve arama kayıtlarıyla yapay zekâ resepsiyonu sağlar. Genel resepsiyon, klinik ve emlak senaryoları bulunur. Aktif ses erişimi, sağlayıcı ve numara yönlendirmesi gerekir; erişim hakkı tek başına telefonun çalmasını sağlamaz.
Sesli ajanın bilgi tabanı AIFekr platform desteğinden ayrıdır. Onaylı çalışma saatlerini, hizmetleri ve fiyatları kullanın. Yetkili araçlarla arayanın adı, iletişimi ve istediği randevu zamanı alınabilir. Gerçek araç daha fazlasını doğrulamadıkça randevu personel onayı bekleyen talep olarak anlatılmalıdır. Emlakta müsaitlik önermeden ilan durumunu kontrol edin. Klinik resepsiyonu teşhis veya tedavi yapmaz.
Telnyx numara envanteri, hesap seviyesi, ülke kapsamı ve doğrulaması Telnyx'e bağlıdır. AIFekr yöneticisi desteklenen numaraları mevcut ses sistemine yapılandırıp aktarabilir; bağlantı testi gerçek arama testi veya numara satın alımı değildir. Numara ve operatör/sağlayıcı kullanım ücreti ek olabilir. Ülke ve ihtiyacı öğrenin; deneme hesabına dünya çapı kapsam vaat etmek yerine güncel Telnyx portalına yönlendirin.

## 27. Industry packs and business context / Sektör paketleri ve işletme bağlamı

Routes: /industry

### English

Industry packs adapt vocabulary, suggested agents and relevant sections to an industry. Available sectors include real estate, construction, clinics, restaurants, university/education, e-commerce, law and hotel/tourism when enabled. The marketplace shows the actual active choices.
Selecting an industry should not be described as a shortcut around subscription requirements. Real-estate context can expose property, owner and viewing workflows; a restaurant has different relevant tasks. Core CRM concepts such as contacts, tasks and deals remain useful across industries.
Complete the business profile with accurate details and select the correct current business before analysis. The Student package activates the education context through its purchase workflow. If an industry option is unavailable, use the general supported tools or ask support about configuration. Do not fabricate sector-specific integrations, accreditation, legal compliance or promised business outcomes simply because a pack has a specialist name.

### Türkçe

Sektör paketleri terminolojiyi, önerilen ajanları ve ilgili bölümleri sektöre uyarlar. Etkin olduğunda emlak, inşaat, klinik, restoran, üniversite/eğitim, e-ticaret, hukuk ve otel/turizm seçenekleri bulunur. Gerçek aktif seçenekler pazaryerinde gösterilir.
Sektör seçimi abonelik gereksinimini atlatan kısayol değildir. Emlak bağlamı mülk, mal sahibi ve gösterim akışlarını açabilir; restoranın ilgili işleri farklıdır. Kişi, görev ve fırsat gibi temel CRM kavramları sektörler arasında yararlıdır.
İşletme profilini doğru bilgilerle doldurun ve analizden önce doğru işletmeyi seçin. Öğrenci paketi satın alma akışıyla eğitim bağlamını açar. Seçenek yoksa genel araçları kullanın veya yapılandırma için destekle görüşün. Sektör adından özel bağlantı, akreditasyon, yasal uygunluk veya iş sonucu uydurmayın.

## 28. Settings, team roles and notifications / Ayarlar, ekip rolleri ve bildirimler

Routes: /settings; /notifications

### English

Settings covers profile, language, display preferences and theme. A language change affects the interface; it does not translate all saved content. Display currency is separate from the currency selected for a particular payment. Keep the account email and profile accurate.
Team owners manage membership and capacity through the available team controls. Record assignment and roles can limit what members see or edit. Shared credit usage should be distinguished from a member's individual wallet. Use the relevant team's expiry when assessing access.
In-app notifications show supported activity updates. New account registrations generate a support email to support@aifekr.com through the configured delivery worker; this is an internal support alert, not proof that a customer welcome email has arrived. Delivery may be retried after a provider issue. Historical users do not receive retrospective signup alerts from this release. A user should not send passwords or OTPs in a support notification.

### Türkçe

Ayarlar profil, dil, görünüm tercihleri ve temayı kapsar. Dil değişimi arayüzü etkiler; bütün kayıtlı içerikleri tercüme etmez. Görüntüleme para birimi bir ödemenin para biriminden ayrıdır. E-posta ve profil bilgisini güncel tutun.
Ekip sahipleri kullanılabilir kontrollerle üyeliği ve kapasiteyi yönetir. Atama ve roller üyelerin görüp düzenleyebileceği kayıtları sınırlar. Ortak kredi kullanımı kişisel cüzdandan ayrılmalıdır. Erişim değerlendirmesinde ilgili ekibin bitiş tarihini kullanın.
Panel bildirimleri desteklenen etkinlikleri gösterir. Yeni hesap kayıtları yapılandırılmış çalışan üzerinden support@aifekr.com adresine destek e-postası oluşturur; bu iç destek uyarısıdır, müşteriye hoş geldin e-postası ulaştığının kanıtı değildir. Sağlayıcı hatasında tekrar denenebilir. Bu sürüm geçmiş kullanıcılar için geriye dönük kayıt uyarısı göndermez. Destek bildirimine parola veya OTP eklenmemelidir.

## 29. Administrator capabilities and boundaries / Yönetici işlevleri ve sınırlar

Routes: /admin/users; /admin/packages; /admin/financial; /admin/academy

### English

Administrator and Super Administrator roles access privileged management screens. User management includes search, audience/plan filters, newest-first or oldest-first registration order and a recent-seven-days filter. Sorting applies on the server across pagination rather than only rearranging the visible page.
Authorized administrators manage packages, credits/usage rules, invitations, subscriptions/expiry, referral discounts, financial receipts/invoices, provider settings, student modules and Academy content. Academy generation creates a reviewable draft, not an automatic publication. Certificates use verified completion records; administrators can perform audited revocation or reissue but not bypass educational completion.
Customer-facing support should explain these functions without disclosing staff credentials or configuration secrets. Ordinary callers cannot change another user's code, commission, role, balance or subscription. A request to access the admin panel should be escalated for identity and authorization checks. Never read server passwords, API keys, private infrastructure addresses or internal cron credentials from this knowledge base; they are deliberately excluded.

### Türkçe

Yönetici ve Süper Yönetici rolleri yetkili yönetim ekranlarını açar. Kullanıcı yönetimi arama, hesap/paket filtreleri, en yeni/en eski kayıt sırası ve son yedi gün filtresi içerir. Sıralama yalnızca görünen sayfada değil, sayfalamayı kapsayacak şekilde sunucuda uygulanır.
Yetkili yöneticiler paketleri, kredi/kullanım kurallarını, davetleri, abonelik/bitiş tarihlerini, davet indirimlerini, dekont/faturaları, sağlayıcı ayarlarını, öğrenci modüllerini ve Akademi içeriğini yönetir. Kurs üretimi inceleme taslağıdır; otomatik yayın değildir. Sertifikalar doğrulanmış bitirmeye dayanır; denetimli iptal/yeniden düzenleme yapılabilir, öğrenme koşulu atlanamaz.
Müşteri desteği işlevi açıklarken personel erişim bilgilerini veya gizli ayarları paylaşmamalıdır. Normal arayan başka kullanıcının kodunu, komisyonunu, rolünü, bakiyesini veya aboneliğini değiştiremez. Yönetim erişimi talebi kimlik/yetki kontrolüne aktarılmalıdır. Sunucu parolası, API anahtarı, özel altyapı adresi ve cron gizli bilgisi bu bilgi tabanına özellikle dahil edilmemiştir.

## 30. Troubleshooting decision guide / Sorun giderme karar rehberi



### English

Sign-in problem: identify password, phone OTP or Google; note the visible error and retry from the official page. Never ask for the secret itself. Google configuration errors go to an administrator. Blocked accounts require support review.
Feature restricted: inspect account audience, active plan, expiry, team role and module settings. Credits alone may not unlock access. Insufficient credits: inspect the correct personal/team pool and the action's displayed cost. Payment pending: retain payment ID and receipt; do not repeat the transfer before checking review status.
Material unreadable: confirm file type, size and whether it is scanned; split oversized OCR PDFs and inspect scan quality. Course completion blocked: inspect required lessons, passing thresholds, attempts and final assessment. Provider job failed: retain job/time details and inspect refund/status before repeating. Instagram issue: confirm supported account, media and connection permissions. Wrong-language output: distinguish interface language from chat request and course-content language. If the cause is unknown, say so and collect a concise support request rather than inventing an explanation.

### Türkçe

Giriş sorunu: parola, telefon OTP veya Google yolunu belirleyin; görünen hatayı not edip resmî sayfadan tekrar deneyin. Gizli bilgiyi istemeyin. Google ayar hatası yöneticiye gider. Engelli hesap destek incelemesi gerektirir.
Özellik kısıtlı: hesap türünü, aktif paketi, bitiş tarihini, ekip rolünü ve modül ayarını kontrol edin. Kredi tek başına erişim sağlamayabilir. Kredi yetersiz: doğru kişisel/ekip havuzunu ve işlem maliyetini inceleyin. Ödeme bekliyor: ödeme kimliği ve dekontu saklayın; inceleme durumunu kontrol etmeden havaleyi tekrarlamayın.
Materyal okunmuyor: dosya türünü, boyutunu ve tarama olup olmadığını kontrol edin; büyük OCR PDF'lerini bölün, tarama kalitesine bakın. Kurs tamamlanmıyor: gerekli dersleri, puanları, denemeleri ve finali inceleyin. Sağlayıcı işi başarısız: görev/zaman bilgisiyle iade ve duruma bakın. Instagram sorunu: hesap türü, medya ve izinleri kontrol edin. Yanlış dil: arayüz, sohbet ve kurs dilini ayırın. Neden bilinmiyorsa bunu belirtip kısa destek talebi oluşturun; açıklama uydurmayın.

## 31. Privacy, policy and human escalation / Gizlilik, politikalar ve insan desteği

Routes: /terms; /privacy; /contact

### English

Use https://aifekr.com/terms and /privacy for the current published policies. This guide does not replace those policies or establish new refund deadlines, retention promises or service guarantees. AI outputs can be inaccurate and should be reviewed before consequential use.
Collect only the information needed to resolve the request: name, safe contact method, issue summary, affected page and relevant payment/job identifier. Do not request passwords, one-time codes, full card details, private keys or an entire medical history. Explain the AI-assistant identity and follow the configured call-recording/privacy notice. Do not claim recording is absent or consent has been obtained if no trusted system confirms it.
Escalate blocked accounts, payment/refund disputes, private account inspection, certificate corrections, security incidents and unavailable configuration to support@aifekr.com or the site's contact flow. Do not promise a support response time not published by AIFekr. For an emergency, direct the caller to local emergency services and qualified human help; AIFekr is not an emergency service.

### Türkçe

Güncel yayımlanmış politikalar için https://aifekr.com/terms ve /privacy adreslerini kullanın. Bu rehber bunların yerini almaz; yeni iade süresi, veri saklama taahhüdü veya hizmet garantisi oluşturmaz. Yapay zekâ çıktısı hatalı olabilir; önemli kullanım öncesi incelenmelidir.
Yalnızca gerekli bilgiyi toplayın: ad, güvenli iletişim yolu, sorun özeti, sayfa ve ilgili ödeme/görev kimliği. Parola, tek kullanımlık kod, tam kart bilgisi, özel anahtar veya tüm sağlık geçmişini istemeyin. Yapay zekâ asistanı olduğunuzu açıklayın ve yapılandırılmış kayıt/gizlilik bildirimine uyun. Güvenilir sistem doğrulamadıkça görüşme kaydedilmiyor veya onay alındı demeyin.
Engelli hesap, ödeme/iade anlaşmazlığı, özel hesap incelemesi, sertifika düzeltmesi, güvenlik olayı ve eksik kurulum support@aifekr.com veya sitenin iletişim akışına aktarılır. Yayımlanmamış cevap süresi vaat etmeyin. Acilde yerel acil hizmete ve yetkili insana yönlendirin; AIFekr acil hizmet değildir.

## 32. Telephone answer style and examples / Telefon yanıt biçimi ve örnekler



### English

Use the caller's English or Turkish, speak briefly and ask one question at a time. Start: "Hello, I am AIFekr's AI support assistant. How can I help?" Identify whether the caller needs a student, business or account/payment workflow. Give the direct page and the next action.
Student price example: "The one-month package is 1,199.99 Turkish lira; three months is 2,799.99 lira, approximately 22% less than three monthly purchases. Dollar and Toman equivalents follow the site's current reference rates. Checkout confirms the final amount."
Payment example: "Submitting a bank receipt starts review. I cannot confirm approval from this call alone. Please keep your payment ID; I can explain where to check it." Referral example: "Open Referrals, enter a unique code such as sobhan and save. Your previous links continue to work."
Escalation example: "I do not have access to verify that record here. With your permission, the configured support tool can submit a request; otherwise you can contact support@aifekr.com." Never say the request was sent before a tool confirms it.

### Türkçe

Arayanın İngilizce veya Türkçesini kullanın, kısa konuşun ve bir seferde tek soru sorun. Açılış: "Merhaba, AIFekr'in yapay zekâ destek asistanıyım. Nasıl yardımcı olabilirim?" İhtiyacın öğrenci, işletme veya hesap/ödeme olduğunu belirleyin. Doğru sayfayı ve sonraki adımı verin.
Fiyat örneği: "Bir aylık paket 1.199,99 TL; üç aylık paket 2.799,99 TL'dir. Üç ayrı aylık ödemeye göre yaklaşık yüzde 22 daha uygundur. Dolar ve Toman karşılığı sitenin güncel referans kuruna bağlıdır. Son tutarı ödeme ekranı doğrular."
Ödeme örneği: "Banka dekontunu yüklemek incelemeyi başlatır. Yalnızca bu görüşmeyle onayı doğrulayamam. Ödeme kimliğini saklayın; nereden kontrol edeceğinizi açıklayabilirim." Davet örneği: "Davetler'i açın, sobhan gibi benzersiz kod girip kaydedin. Eski bağlantılar çalışmaya devam eder."
Aktarma örneği: "Buradan kaydı doğrulayacak erişimim yok. İzninizle yapılandırılmış destek aracı talep gönderebilir; yoksa support@aifekr.com adresine yazabilirsiniz." Araç doğrulamadan talep gönderildi demeyin.

## 33. Telnyx ingestion and maintenance notes / Telnyx yükleme ve güncelleme notları



### English

This is a bilingual, text-based retrieval document: every topic has an English and a Turkish block. Upload the PDF through the Telnyx AI Assistant Builder knowledge-base controls and verify that document processing/embedding completes. Telnyx supports PDF embedding and portal knowledge uploads. Knowledge retrieval provides answers; it does not grant access to AIFekr customer accounts or perform authenticated account changes.
Configure the assistant instructions separately: identify as AI, answer in the caller's language, use this approved material for platform facts, use authenticated live tools for balances/payment state and current currency quotes, and escalate missing information. Test English/Turkish retrieval for pricing, Google login, code editing, student OCR, certificates and payments. Check correct pronunciation of currency and email addresses.
Refresh this file when product features, package prices or policies change. Current USD/Toman prices should come from a live tool because this PDF cannot update itself every day. Remove or replace obsolete document versions rather than letting contradictory price documents coexist. No passwords, API keys, sample staff accounts or private customer records belong in the uploaded knowledge base.

### Türkçe

Bu belge metin tabanlı, iki dilli bilgi kaynağıdır; her konuda İngilizce ve Türkçe bölüm vardır. PDF'yi Telnyx AI Assistant Builder bilgi tabanı kontrollerinden yükleyip işleme/embedding tamamlandığını doğrulayın. Telnyx PDF embedding ve portal yüklemelerini destekler. Bilgi erişimi cevap verir; AIFekr müşteri hesabına yetki sağlamaz veya doğrulanmış hesap değişikliği yapmaz.
Asistan talimatlarını ayrıca ayarlayın: yapay zekâ kimliğini açıklasın, arayanın dilini kullansın, platform bilgisi için bu onaylı belgeye dayansın, bakiye/ödeme durumu ve güncel kur için kimliği doğrulanmış canlı araç kullansın, eksik bilgiyi desteğe aktarsın. Fiyat, Google girişi, kod değiştirme, OCR, sertifika ve ödeme sorgularını iki dilde test edin. Para birimi ve e-posta telaffuzunu kontrol edin.
Özellik, paket veya politika değişince belgeyi yenileyin. PDF kendiliğinden günlük güncellenemediğinden USD/Toman fiyatı canlı araçtan gelmelidir. Çelişen eski fiyat belgelerini birlikte bırakmak yerine değiştirin. Parola, API anahtarı, örnek personel hesabı ve özel müşteri kaydı yüklenmemelidir.

## Sources and maintenance

Product basis: source routes and components, docs/knowledge-base/*.md, docs/student-academy.md, docs/admin-commerce-seo-voice.md, and the current release changes. Older conflicting notes were checked against implementation. No live customer records are included.

Public sources: https://aifekr.com ; https://aifekr.com/pricing ; https://aifekr.com/terms ; https://aifekr.com/privacy

Google OAuth reference: https://developers.google.com/identity/openid-connect/reference

Telnyx PDF embedding: https://developers.telnyx.com/api/inference/inference-embedding/post-embedding

Telnyx portal uploads: https://telnyx.com/release-notes/fast-knowledge-base-uploads

Exchange-rate reference endpoint: https://open.er-api.com/v6/latest/USD. A reference rate is not a promise of an individual bank or free-market cash quote.