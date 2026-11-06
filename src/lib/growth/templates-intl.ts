/**
 * Built-in German and Turkish texts for the lifecycle rules (fa/en live on each
 * rule in automation.ts). Same variables as the fa/en texts. When an admin has
 * customised a rule without writing de/tr, de/tr users get the admin's English text,
 * so the admin's words always win over a built-in translation.
 */
export type IntlText = { title: string; body: string };

export const INTL_TEMPLATES: Record<string, { de: IntlText; tr: IntlText }> = {
  welcome: {
    de: { title: "Willkommen bei AIFekr, {{first_name}}", body: "Zum Start: {{recommended_next_step}}. Das dauert nur ein paar Minuten." },
    tr: { title: "AIFekr'e hoş geldiniz, {{first_name}}", body: "Başlamak için: {{recommended_next_step}}. Sadece birkaç dakika sürer." },
  },
  getting_started_24h: {
    de: { title: "Ihr erstes Ergebnis mit {{preferred_module}}", body: "Unser Vorschlag: {{recommended_next_step}}. Sie haben aktuell {{credit_balance}} Credits." },
    tr: { title: "{{preferred_module}} ile ilk sonucunuzu alın", body: "Önerimiz: {{recommended_next_step}}. Şu anda {{credit_balance}} krediniz var." },
  },
  second_workflow_day3: {
    de: { title: "Ihr nächster Schritt mit {{preferred_module}}", body: "{{recommended_next_step}} – machen Sie dort weiter, wo Sie aufgehört haben." },
    tr: { title: "{{preferred_module}} ile sonraki adımınız", body: "{{recommended_next_step}} – kaldığınız yerden devam edin." },
  },
  paid_benefits_day5: {
    de: { title: "Mehr erstellen mit AIFekr", body: "Sie nutzen {{preferred_module}} viel. Alle Pläne und ihre Credits finden Sie unter {{pricing_url}}." },
    tr: { title: "AIFekr ile daha fazlasını üretin", body: "{{preferred_module}} aracını sık kullanıyorsunuz. Tüm planları ve kredilerini {{pricing_url}} adresinde görün." },
  },
  low_credit_day7: {
    de: { title: "Ihre Credits gehen zur Neige", body: "Aktueller Stand: {{credit_balance}} Credits. Aufladeoptionen und Pläne: {{pricing_url}}" },
    tr: { title: "Krediniz azalıyor", body: "Mevcut bakiye: {{credit_balance}} kredi. Kredi yükleme ve plan seçenekleri: {{pricing_url}}" },
  },
  demo_offer_day10: {
    de: { title: "Sollen wir gemeinsam die beste Einrichtung finden?", body: "Wenn Sie Hilfe für Ihr Unternehmen möchten, schreiben Sie uns – wir helfen gern." },
    tr: { title: "En iyi kurulumu birlikte bulalım mı?", body: "İşletmeniz için yönlendirme isterseniz bize yazın, yardımcı olalım." },
  },
  feedback_day14: {
    de: { title: "Ihre Meinung ist uns wichtig", body: "Wie gefällt Ihnen AIFekr? Wenn etwas fehlt oder Sie nicht weiterkommen, schreiben Sie uns kurz (freiwillig)." },
    tr: { title: "Görüşünüz bizim için değerli", body: "AIFekr nasıldı? Eksik bir şey varsa ya da takıldıysanız bize kısaca yazın (isteğe bağlı)." },
  },
  voice_first_generation: {
    de: { title: "Erstellen Sie Ihre erste Stimme", body: "Schreiben Sie einen kurzen Satz, wählen Sie einen Sprecher und erstellen Sie die Audiodatei. Die Kosten sehen Sie vorher." },
    tr: { title: "İlk sesinizi oluşturun", body: "Kısa bir cümle yazın, bir seslendirmen seçin ve oluşturun. Ücret, oluşturmadan önce gösterilir." },
  },
  live_first_session: {
    de: { title: "Sprechen Sie mit AIFekr Live", body: "Starten Sie ein kurzes Live-Gespräch und stellen Sie Ihre Frage – AIFekr antwortet sofort mit Stimme." },
    tr: { title: "AIFekr Live ile konuşun", body: "Kısa bir canlı görüşme başlatın ve sorunuzu sorun; AIFekr anında sesli yanıt verir." },
  },
  inactive_return: {
    de: { title: "Ihre Projekte warten auf Sie", body: "Ihre gespeicherten Arbeiten in {{preferred_module}} sind noch da. {{recommended_next_step}}." },
    tr: { title: "Projeleriniz sizi bekliyor", body: "{{preferred_module}} içindeki kayıtlı çalışmalarınız hâlâ orada. {{recommended_next_step}}." },
  },
  payment_failed: {
    de: { title: "Ihre Zahlung wurde nicht abgeschlossen", body: "Ihr Kauf von {{current_plan}} ist nicht durchgegangen. Falls Ihnen etwas abgebucht wurde, erstattet das Zahlungsportal es wie üblich. Mit diesem Link können Sie es erneut versuchen oder Banküberweisung wählen." },
    tr: { title: "Ödemeniz tamamlanmadı", body: "{{current_plan}} satın alımınız tamamlanmadı. Ücret kesildiyse ödeme sistemi her zamanki gibi iade eder. Bu bağlantıyla tekrar deneyebilir veya banka havalesini seçebilirsiniz." },
  },
  first_result_30m: {
    de: { title: "Ihr erstes Ergebnis ist fertig 🎉", body: "Toller Start! Weiter mit {{preferred_module}}: {{recommended_next_step}}." },
    tr: { title: "İlk sonucunuz hazır 🎉", body: "Harika bir başlangıç! {{preferred_module}} ile sıradaki adım: {{recommended_next_step}}." },
  },
  inactive_3d: {
    de: { title: "Ihre Arbeit in {{preferred_module}} wartet", body: "Sie waren ein paar Tage nicht da. Ihre gespeicherte Arbeit ist noch da; {{recommended_next_step}}." },
    tr: { title: "{{preferred_module}} içindeki çalışmanız sizi bekliyor", body: "Birkaç gündür uğramadınız. Kayıtlı çalışmanız yerinde duruyor; {{recommended_next_step}}." },
  },
  post_purchase: {
    de: { title: "Ihr Plan {{current_plan}} ist aktiv", body: "So holen Sie das Beste heraus: {{recommended_next_step}}." },
    tr: { title: "{{current_plan}} planınız aktif", body: "En iyi şekilde yararlanmak için: {{recommended_next_step}}." },
  },
  renewal_soon: {
    de: { title: "Ihr Plan endet bald", body: "Ihr Plan {{current_plan}} endet bald. Verlängern Sie, um ohne Unterbrechung weiterzuarbeiten." },
    tr: { title: "Planınız yakında sona eriyor", body: "{{current_plan}} planınız yakında sona eriyor. Kesintisiz devam etmek için yenileyebilirsiniz." },
  },
};
