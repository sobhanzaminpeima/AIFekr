// One-off backfill: German content for IndustryPack rows. Safe to re-run --
// always overwrites the *De fields for the 8 known slugs below (idempotent),
// does nothing for any slug not in this list.
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const AGENT = (slug, name, role, description, icon) => ({ slug, name, role, description, icon });
const OUT = (metric, description) => ({ metric, description });

const DE = {
  construction: {
    nameDe: "Bauwesen",
    taglineDe: "Ihr KI-Team für Baumanagement",
    valuePropositionDe: "Liefern Sie Projekte pünktlich, behalten Sie die Kosten im Griff und gewinnen Sie mehr Aufträge — alles mit KI-Agenten, die rund um die Uhr arbeiten.",
    targetCustomersDe: ["Bauunternehmen", "Generalunternehmer", "Immobilienentwickler", "Bauträger und Subunternehmer"],
    painPointsDe: ["Projektverzögerungen, die täglich Tausende kosten", "Unkontrollierte Beschaffungs- und Materialkosten", "Eine dünne Lead-Pipeline und schwache Vertriebsnachverfolgung", "Keine Echtzeit-Einsicht in den Projektfortschritt", "Manuelle Berichterstattung, die jede Woche Stunden kostet"],
    agentsDe: [
      AGENT("project-manager", "KI-Projektmanager", "MANAGER", "Verfolgt Meilensteine, meldet Verzögerungen und hält Stakeholder automatisch auf dem Laufenden", "📋"),
      AGENT("procurement-manager", "KI-Beschaffungsmanager", "SPECIALIST", "Vergleicht Lieferantenpreise, verwaltet Bestellungen und verfolgt Materiallieferungen", "🛒"),
      AGENT("cost-controller", "KI-Kostencontroller", "SPECIALIST", "Überwacht das Budget gegenüber den tatsächlichen Ausgaben, meldet Überschreitungen und prognostiziert die Endkosten", "💰"),
      AGENT("sales-agent", "KI-Vertriebsagent", "SPECIALIST", "Qualifiziert Bau-Leads, versendet Angebote und folgt automatisch nach", "🤝"),
      AGENT("crm-agent", "KI-CRM-Agent", "WORKER", "Verwaltet Kundenbeziehungen und führt eine vollständige Interaktionshistorie", "📞"),
      AGENT("marketing-agent", "KI-Marketingagent", "WORKER", "Erstellt Projektpräsentationen, LinkedIn-Beiträge und Vorher/Nachher-Inhalte", "📣"),
      AGENT("ceo-assistant", "KI-CEO-Assistent", "CEO", "Fasst die Portfoliogesundheit und die daraus folgenden strategischen Entscheidungen zusammen", "👑"),
    ],
    outcomesDe: [
      OUT("30 % weniger Verzögerungen", "KI überwacht jeden Meilenstein und meldet Verzögerungen frühzeitig"),
      OUT("15 % Kosteneinsparung", "Bessere Beschaffung und frühzeitige Erkennung von Kostenüberschreitungen"),
      OUT("3x mehr Leads", "Eine automatisierte Akquise- und Nachverfolgungs-Pipeline"),
      OUT("10 Std./Woche gespart", "Berichte und Statusupdates werden automatisch erstellt"),
    ],
    kpisDe: ["Aktive Projekte", "Pünktlichkeitsrate", "Budgetabweichung", "Neue Leads", "Versendete Angebote", "Gewinnrate"],
  },
  "real-estate": {
    nameDe: "Immobilien",
    taglineDe: "Ihr KI-Vertriebsteam für Immobilien",
    valuePropositionDe: "Generieren Sie mehr qualifizierte Leads, schließen Sie Geschäfte schneller ab und dominieren Sie Ihren lokalen Markt mit 8 KI-Agenten, die nie aufhören zu arbeiten.",
    targetCustomersDe: ["Immobilienagenturen", "Immobilienentwickler", "Makler und Vermittler", "Immobilienverwaltungsgesellschaften"],
    painPointsDe: ["Leadgenerierung, die von Monat zu Monat stark schwankt", "Langsame Nachverfolgung lässt warme Leads abkühlen", "Keine Zeit, Marketinginhalte für Angebote zu erstellen", "CRM-Daten, die veraltet und unvollständig sind", "Schlechte Sichtbarkeit bei Google und in sozialen Medien"],
    agentsDe: [
      AGENT("lead-hunter", "KI-Lead-Jäger", "SPECIALIST", "Findet Käufer- und Verkäufer-Leads über soziale Medien, das Web und Portale, rund um die Uhr", "🎯"),
      AGENT("sales-agent", "KI-Vertriebsagent", "SPECIALIST", "Qualifiziert Leads, plant Besichtigungen und versendet personalisierte Angebote", "🤝"),
      AGENT("crm-agent", "KI-CRM-Agent", "WORKER", "Hält jeden Kontakt aktuell und automatisiert Nachfass-Erinnerungen", "📇"),
      AGENT("property-marketing", "KI-Immobilienmarketing", "SPECIALIST", "Verfasst Anzeigentexte, Social-Posts und E-Mail-Kampagnen für jede Immobilie", "📸"),
      AGENT("call-center", "KI-Callcenter", "SPECIALIST", "Beantwortet eingehende Anrufe, qualifiziert Anrufer und bucht Termine", "📞"),
      AGENT("seo-agent", "KI-SEO-Agent", "SPECIALIST", "Optimiert die Website der Agentur und die Immobilienanzeigen für die Google-Suche", "🔍"),
      AGENT("social-agent", "KI-Social-Media-Agent", "WORKER", "Veröffentlicht täglich Immobilieninhalte auf Instagram, Facebook und LinkedIn", "📱"),
      AGENT("ceo-assistant", "KI-CEO-Assistent", "CEO", "Wöchentliche Geschäftsleistungsprüfung und eine 90-Tage-Wachstumsstrategie", "👑"),
    ],
    outcomesDe: [
      OUT("5x mehr Leads", "Mehrkanalige KI-Akquise, die nie stoppt"),
      OUT("60 % schnellere Nachverfolgung", "KI beantwortet Anfragen in unter 60 Sekunden"),
      OUT("40 % mehr Angebote", "Inhalte im großen Maßstab, die Verkäufer anziehen"),
      OUT("Top 3 bei Google", "KI-SEO für die lokale Immobiliensuche"),
    ],
    kpisDe: ["Neue Leads", "Gebuchte Besichtigungen", "Aktive Angebote", "Abgeschlossene Geschäfte", "Durchschnittliche Tage am Markt", "Umsatz"],
  },
  clinic: {
    nameDe: "Arztpraxis",
    taglineDe: "Ihr KI-Praxismanager",
    valuePropositionDe: "Füllen Sie Ihren Terminkalender, reduzieren Sie Terminausfälle und steigern Sie Patientenbewertungen — während sich Ihr Personal auf die Behandlung konzentriert.",
    targetCustomersDe: ["Arztpraxen", "Zahnarztpraxen", "Fachärzte", "Physiotherapiezentren"],
    painPointsDe: ["Leere Termine, die Praxiskapazität verschwenden", "Hohe Ausfallquoten ohne Erinnerungen", "Unbeantwortete negative Bewertungen", "Marketingbudget, das in den falschen Kanälen verschwendet wird", "Empfangspersonal, das in Anrufen erstickt"],
    agentsDe: [
      AGENT("receptionist", "KI-Rezeptionist", "SPECIALIST", "Beantwortet Anrufe, bucht Termine und beantwortet Anfragen rund um die Uhr", "🗓️"),
      AGENT("appointment-agent", "KI-Terminagent", "WORKER", "Sendet Erinnerungen, reduziert Ausfälle und verwaltet Stornierungen", "⏰"),
      AGENT("call-center", "KI-Callcenter", "SPECIALIST", "Übernimmt Patienten-Nachfassanrufe und Check-ins nach dem Besuch", "📞"),
      AGENT("marketing-agent", "KI-Marketingagent", "SPECIALIST", "Erstellt Gesundheitsinhalte, saisonale Kampagnen und Patientenaufklärungsbeiträge", "📣"),
      AGENT("crm-agent", "KI-CRM-Agent", "WORKER", "Verfolgt Patientenhistorie, Besuchshäufigkeit und Wiedereinbestellung", "📋"),
      AGENT("reputation-manager", "KI-Reputationsmanager", "SPECIALIST", "Überwacht und beantwortet Bewertungen auf Google und Gesundheitsplattformen", "⭐"),
      AGENT("ceo-assistant", "KI-CEO-Assistent", "CEO", "Monatlicher Praxisleistungsbericht und Wachstumsempfehlungen", "👑"),
    ],
    outcomesDe: [
      OUT("40 % weniger Terminausfälle", "Automatische mehrkanalige Terminerinnerungen"),
      OUT("2x neue Patienten", "KI-Marketing und Reputationsmanagement"),
      OUT("4,8-Sterne-Durchschnitt", "Bewertungen werden aktiv gesammelt und beantwortet"),
      OUT("2 Vollzeitstellen eingespart", "Der KI-Rezeptionist übernimmt 80 % der eingehenden Anrufe"),
    ],
    kpisDe: ["Heutige Termine", "Ausfallquote", "Neue Patienten", "Google-Bewertung", "Monatsumsatz", "Patientenbindung"],
  },
  restaurant: {
    nameDe: "Restaurant",
    taglineDe: "Ihr KI-Team für den Restaurantbetrieb",
    valuePropositionDe: "Füllen Sie mehr Tische, übernehmen Sie die Kontrolle über Ihren Online-Ruf und gewinnen Sie treue Stammgäste mit einem KI-Team, das nie schläft.",
    targetCustomersDe: ["Restaurants", "Cafés und Kaffeehäuser", "Cloud-Küchen", "Catering-Unternehmen"],
    painPointsDe: ["Unvorhersehbare Buchungen und leere Nebenzeiten", "Negative Bewertungen, die dem Online-Ruf schaden", "Kein Budget für ein vollständiges Marketingteam", "Niedrige Kundenrücklaufquote", "Manuelles Posten in sozialen Medien kostet Zeit"],
    agentsDe: [
      AGENT("reservation-agent", "KI-Reservierungsagent", "SPECIALIST", "Verwaltet Online- und Telefonbuchungen und steuert die Tischverfügbarkeit", "🪑"),
      AGENT("marketing-agent", "KI-Marketingagent", "SPECIALIST", "Erstellt Werbekampagnen, Sonderangebote und Veranstaltungsankündigungen", "📣"),
      AGENT("social-agent", "KI-Social-Media-Agent", "WORKER", "Schreibt tägliche Bildunterschriften für Essensfotos, Stories, Hashtags und Interaktionen", "📱"),
      AGENT("review-manager", "KI-Bewertungsmanager", "SPECIALIST", "Überwacht Google, TripAdvisor und Zomato und beantwortet jede Bewertung", "⭐"),
      AGENT("crm-agent", "KI-CRM-Agent", "WORKER", "Verfolgt Stammgäste, Geburtstagskampagnen und das Treueprogramm", "❤️"),
      AGENT("ceo-assistant", "KI-CEO-Assistent", "CEO", "Wöchentliche Umsatz- und Speisekartenanalyse", "👑"),
    ],
    outcomesDe: [
      OUT("30 % mehr Gäste", "KI füllt Nebenzeiten mit gezielten Aktionen"),
      OUT("4,7-Sterne-Bewertung", "Jede Bewertung wird in unter 2 Stunden beantwortet"),
      OUT("25 % Rücklaufquote", "Treuekampagnen, die Kunden zurückbringen"),
      OUT("Tägliche Social-Media-Präsenz", "Inhalte werden täglich ohne Aufwand veröffentlicht"),
    ],
    kpisDe: ["Heutige Buchungen", "Tischauslastung", "Google-Bewertung", "Wiederkehrende Kunden", "Reichweite in sozialen Medien", "Wochenumsatz"],
  },
  university: {
    nameDe: "Universität / Schule",
    taglineDe: "Ihr KI-Team für Bildungsbetrieb",
    valuePropositionDe: "Steigern Sie die Einschreibungen, unterstützen Sie Studierende rund um die Uhr und automatisieren Sie den Verwaltungsaufwand mit KI, die für die Bildung entwickelt wurde.",
    targetCustomersDe: ["Private Universitäten", "Bildungsinstitute", "Schulen", "Online-Kursplattformen"],
    painPointsDe: ["Niedrige Einschreibungen und eine langsame Rekrutierungs-Pipeline", "Studierende erhalten außerhalb der Bürozeiten keine Antwort", "Marketingbudget mit schlechter Rendite", "Verwaltungspersonal, das in wiederkehrenden Fragen versinkt", "Keine Daten darüber, welche Studierenden abbruchgefährdet sind"],
    agentsDe: [
      AGENT("admissions-agent", "KI-Zulassungsagent", "SPECIALIST", "Qualifiziert potenzielle Studierende, bucht Infogespräche und folgt nach", "🎯"),
      AGENT("student-advisor", "KI-Studienberater", "SPECIALIST", "Beantwortet Fragen zu Kursen, Studiengebühren und Stundenplänen rund um die Uhr", "💬"),
      AGENT("call-center", "KI-Callcenter", "SPECIALIST", "Übernimmt eingehende Anrufe für Zulassung und Studierendenbetreuung", "📞"),
      AGENT("marketing-agent", "KI-Marketingagent", "SPECIALIST", "Erstellt Einschreibungskampagnen, Tag-der-offenen-Tür-Werbung und Erfahrungsberichte", "📣"),
      AGENT("crm-agent", "KI-CRM-Agent", "WORKER", "Verfolgt zukünftige und aktuelle Studierende über den gesamten Lebenszyklus", "📋"),
      AGENT("research-assistant", "KI-Forschungsassistent", "WORKER", "Fasst Fachartikel zusammen und unterstützt Dozenten bei Literaturrecherchen", "📚"),
      AGENT("ceo-assistant", "KI-CEO-Assistent", "CEO", "Analyse der Einschreibungstrends und ein institutionelles Leistungs-Dashboard", "👑"),
    ],
    outcomesDe: [
      OUT("3x Einschreibungs-Leads", "Die KI-Zulassungs-Pipeline läuft rund um die Uhr"),
      OUT("80 % der Antworten automatisiert", "Der KI-Studienberater übernimmt wiederkehrende Fragen"),
      OUT("50 % geringere Verwaltungskosten", "Terminplanung, Erinnerungen und Nachverfolgung laufen von selbst"),
      OUT("Höhere Bindung", "Frühzeitige Erkennung und Intervention bei Abbruchrisiko"),
    ],
    kpisDe: ["Interessenten", "Eingegangene Bewerbungen", "Einschreibungsquote", "Studierendenzufriedenheit", "Antwortzeit auf Fragen", "Bindungsrate"],
  },
  ecommerce: {
    nameDe: "Online-Shop",
    taglineDe: "Ihr KI-Wachstumsmotor für E-Commerce",
    valuePropositionDe: "Skalieren Sie den Umsatz, reduzieren Sie Warenkorbabbrüche und gewinnen Sie bei Google Shopping — mit einem KI-Team, das Ihren Shop rund um die Uhr optimiert.",
    targetCustomersDe: ["Online-Shops", "D2C-Marken", "Dropshipping-Unternehmen", "Amazon-/Marktplatzverkäufer"],
    painPointsDe: ["Hohe Warenkorbabbrüche ohne Nachverfolgung", "Schwache SEO-Rankings bei Google und Marktplätzen", "Steigende Werbekosten bei sinkender Rendite", "Keine Zeit für das Volumen des Kundensupports", "Produkt- und Preisentscheidungen ohne Datengrundlage"],
    agentsDe: [
      AGENT("product-manager", "KI-Produktmanager", "MANAGER", "Analysiert Bestseller, meldet Ladenhüter und schlägt Preisänderungen vor", "📦"),
      AGENT("ads-agent", "KI-Werbeagent", "SPECIALIST", "Führt Google- und Meta-Werbekampagnen und optimiert die Rendite täglich", "📊"),
      AGENT("seo-agent", "KI-SEO-Agent", "SPECIALIST", "Optimiert Titel, Beschreibungen und Kategorieseiten für die Suche", "🔍"),
      AGENT("customer-support", "KI-Kundensupport", "SPECIALIST", "Bearbeitet Rücksendungen, Fragen, Bestellstatus und Beschwerden sofort", "💬"),
      AGENT("crm-agent", "KI-CRM-Agent", "WORKER", "Warenkorbabbruch-Rückgewinnung, Wiederkaufkampagnen und VIP-Segmentierung", "❤️"),
      AGENT("sales-agent", "KI-Vertriebsagent", "SPECIALIST", "Bietet Cross-Selling und Upgrades per E-Mail und Chat an", "🤝"),
      AGENT("ceo-assistant", "KI-CEO-Assistent", "CEO", "Wöchentlicher Umsatzbericht und Wachstumsstrategie", "👑"),
    ],
    outcomesDe: [
      OUT("25 % mehr Umsatz", "KI-Warenkorb-Rückgewinnung und automatisiertes Cross-Selling"),
      OUT("3x organischer Traffic", "KI-SEO auf jeder Produktseite angewendet"),
      OUT("60 % schnellerer Support", "KI löst 80 % der Kundenanfragen sofort"),
      OUT("Höhere Werberendite", "Werbung wird täglich von KI optimiert"),
    ],
    kpisDe: ["Tägliche Bestellungen", "Umsatz", "Warenkorbabbruchrate", "Werberendite", "Organischer Traffic", "Support-Zufriedenheit"],
  },
  "law-firm": {
    nameDe: "Anwaltskanzlei",
    taglineDe: "Ihr KI-Wachstumsteam für den Kanzleibetrieb",
    valuePropositionDe: "Wandeln Sie mehr Beratungsanfragen um, automatisieren Sie die Mandantenaufnahme und steigern Sie den Online-Ruf Ihrer Kanzlei.",
    targetCustomersDe: ["Anwaltskanzleien", "Selbstständige Anwälte", "Rechtsberater", "Notariate"],
    painPointsDe: ["Langsame oder verpasste Antworten auf Beratungsanfragen", "Zeitverlust durch Verwaltung und nicht abrechenbare Aufnahme", "Geringe Online-Sichtbarkeit in einem wettbewerbsintensiven Rechtsmarkt", "Uneinheitliche Mandantenkommunikation und Nachverfolgung", "Kein System zur Verfolgung von Leads und Konversion"],
    agentsDe: [
      AGENT("intake-agent", "KI-Aufnahmeagent", "SPECIALIST", "Qualifiziert neue Mandantenanfragen, erfasst Falldetails und bucht Beratungen", "📝"),
      AGENT("crm-agent", "KI-CRM-Agent", "WORKER", "Verfolgt jede Mandanteninteraktion, Frist und Nachverfolgung", "📋"),
      AGENT("document-assistant", "KI-Dokumentenassistent", "SPECIALIST", "Entwirft Standardschreiben, Vertraulichkeitsvereinbarungen, Verträge und rechtliche Zusammenfassungen", "📄"),
      AGENT("marketing-agent", "KI-Marketingagent", "SPECIALIST", "Verfasst juristische Artikel, LinkedIn-Thought-Leadership und Fallstudienbeiträge", "📣"),
      AGENT("call-center", "KI-Callcenter", "SPECIALIST", "Beantwortet eingehende Anrufe, qualifiziert Anrufer vor und leitet sie an den richtigen Anwalt weiter", "📞"),
      AGENT("seo-agent", "KI-SEO-Agent", "WORKER", "Optimiert die Kanzlei-Website für Rechtsgebiets-Keywords und die lokale Suche", "🔍"),
      AGENT("ceo-assistant", "KI-CEO-Assistent", "CEO", "Monatliche Leistungsprüfung der Kanzlei, Pipeline-Gesundheit und Umsatzprognose", "👑"),
    ],
    outcomesDe: [
      OUT("3x gebuchte Beratungen", "Die KI-Aufnahme verpasst nie eine neue Mandantenanfrage"),
      OUT("5 Std./Woche pro Anwalt gespart", "KI entwirft Routinedokumente und Mandanten-Updates"),
      OUT("Top 5 lokal bei Google", "KI-SEO für Rechtsgebiet plus Stadtsuche"),
      OUT("90 % Lead-Antwortrate", "Jede Anfrage wird in unter 5 Minuten beantwortet"),
    ],
    kpisDe: ["Neue Anfragen", "Gebuchte Beratungen", "Gewonnene Fälle", "Abrechenbare Stunden", "Google-Ranking", "Monatsumsatz"],
  },
  hotel: {
    nameDe: "Hotel / Gastgewerbe",
    taglineDe: "Ihr KI-Team für Hotelumsatz und Gästeerlebnis",
    valuePropositionDe: "Maximieren Sie die Auslastung, automatisieren Sie die Gästekommunikation und bauen Sie mit KI-Gastgewerbe-Agenten einen 5-Sterne-Online-Ruf auf.",
    targetCustomersDe: ["Hotels", "Boutique-Pensionen", "Serviced Apartments", "Resortimmobilien"],
    painPointsDe: ["Niedrige Direktbuchungen — starke Abhängigkeit von OTAs", "Langsame Antworten auf Gästefragen und Bewertungen", "Kein personalisiertes Upselling oder Treueprogramm", "Hohe Personalkosten an Rezeption und Concierge", "Schwaches Online-Reputationsmanagement"],
    agentsDe: [
      AGENT("booking-agent", "KI-Buchungsagent", "SPECIALIST", "Bearbeitet Direktbuchungsanfragen, Verfügbarkeitsprüfungen und Bestätigungen", "🗓️"),
      AGENT("guest-experience", "KI-Gästeerlebnis-Agent", "SPECIALIST", "Nachrichten vor der Anreise, Anfragen während des Aufenthalts und Nachverfolgung nach dem Check-out", "🛎️"),
      AGENT("call-center", "KI-Callcenter", "SPECIALIST", "Beantwortet telefonische Anfragen, bearbeitet Wünsche und leitet sie an Abteilungen weiter", "📞"),
      AGENT("reputation-manager", "KI-Reputationsmanager", "SPECIALIST", "Überwacht Booking.com, TripAdvisor und Google und beantwortet Bewertungen", "⭐"),
      AGENT("marketing-agent", "KI-Marketingagent", "SPECIALIST", "Erstellt saisonale Pakete, Blitzverkäufe und Treuekampagnen", "📣"),
      AGENT("revenue-manager", "KI-Revenue-Manager", "WORKER", "Beobachtet die Preisgestaltung der Konkurrenz und schlägt dynamische Preisanpassungen vor", "💰"),
      AGENT("ceo-assistant", "KI-CEO-Assistent", "CEO", "Wöchentliche RevPAR-Analyse, Belegungsprognose und Strategieprüfung", "👑"),
    ],
    outcomesDe: [
      OUT("20 % mehr Direktbuchungen", "KI wandelt Website-Besucher in Direktgäste um"),
      OUT("4,9 Sterne auf allen Plattformen", "Jede Bewertung wird innerhalb einer Stunde beantwortet"),
      OUT("15 % höherer Durchschnittspreis", "KI bietet jedem Gast Upgrades und Pakete an"),
      OUT("1 Vollzeitstelle eingespart", "KI übernimmt 70 % der Rezeptionsanfragen"),
    ],
    kpisDe: ["Auslastung", "RevPAR", "Anteil Direktbuchungen", "Gästebewertung", "Antwortrate auf Bewertungen", "Durchschnittlicher Tagespreis"],
  },
};

async function main() {
  let updated = 0, skipped = 0;
  for (const [slug, fields] of Object.entries(DE)) {
    const pack = await prisma.industryPack.findUnique({ where: { slug } });
    if (!pack) { skipped++; console.log(`skip (not found): ${slug}`); continue; }
    await prisma.industryPack.update({
      where: { slug },
      data: {
        nameDe: fields.nameDe,
        taglineDe: fields.taglineDe,
        valuePropositionDe: fields.valuePropositionDe,
        targetCustomersDe: JSON.stringify(fields.targetCustomersDe),
        painPointsDe: JSON.stringify(fields.painPointsDe),
        agentsDe: JSON.stringify(fields.agentsDe),
        outcomesDe: JSON.stringify(fields.outcomesDe),
        kpisDe: JSON.stringify(fields.kpisDe),
      },
    });
    updated++;
  }
  console.log(`done: ${updated} updated, ${skipped} skipped`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
