"use client";
import { useEffect, useState } from "react";
import ExportReport from "./ExportReport";
import OverviewTab from "./OverviewTab";
import CampaignsTab from "./CampaignsTab";
import CustomersTab from "./CustomersTab";
import AutomationsTab from "./AutomationsTab";
import SettingsTab from "./SettingsTab";
import FollowupEngineTab from "./FollowupEngineTab";
import FollowupAnalyticsTab from "./FollowupAnalyticsTab";
import FollowupLogsTab from "./FollowupLogsTab";
import { useT } from "./shared";
import "./growth-center.css";

const TABS = ["overview", "customers", "automations", "followup", "campaigns", "analytics", "logs", "settings"] as const;
type Tab = typeof TABS[number];

/** Admin Customer Growth Center: acquisition → activation → conversion → retention, from real data only. */
export default function GrowthCenter() {
  const { t, fa } = useT();
  const [tab, setTab] = useState<Tab>("overview");
  useEffect(() => {
    const read = () => { const h = location.hash.slice(1) as Tab; if (TABS.includes(h)) setTab(h); };
    const timer = setTimeout(read, 0);
    addEventListener("hashchange", read);
    return () => { clearTimeout(timer); removeEventListener("hashchange", read); };
  }, []);
  const label: Record<Tab, string> = { overview: t("نمای کلی و قیف", "Overview & funnel"), campaigns: t("کمپین‌ها", "Campaigns"), customers: t("مشتریان و بخش‌ها", "Customers & segments"), automations: t("قواعد و متن پیام‌ها", "Rules & templates"), followup: t("موتور پیگیری", "Follow-up engine"), analytics: t("تحلیل تبدیل", "Conversion analytics"), logs: t("گزارش ارسال‌ها", "Send log"), settings: t("تنظیمات", "Settings") };
  return <div className="gc" dir={fa ? "rtl" : "ltr"}>
    <header className="gc-head"><div><h1>{t("مرکز پیگیری و تبدیل مشتری", "Customer Follow-up & Conversion")}</h1><p className="gc-sub">{t("از کلیک تبلیغ تا اولین نتیجه، خرید و تمدید — فقط با دادهٔ واقعی. مشتریانِ CRM کاربران اینجا نیستند.", "From ad click to first result, purchase and renewal — real data only. Your users' own CRM contacts are not shown here.")}</p></div></header>
    <ExportReport/>
    <div className="gc-tabs" role="tablist">{TABS.map(k => <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); history.replaceState(null, "", `#${k}`); }}>{label[k]}</button>)}</div>
    <div role="tabpanel">{tab === "overview" ? <OverviewTab/> : tab === "campaigns" ? <CampaignsTab/> : tab === "customers" ? <CustomersTab/> : tab === "automations" ? <AutomationsTab/> : tab === "followup" ? <FollowupEngineTab/> : tab === "analytics" ? <FollowupAnalyticsTab/> : tab === "logs" ? <FollowupLogsTab/> : <SettingsTab/>}</div>
  </div>;
}
