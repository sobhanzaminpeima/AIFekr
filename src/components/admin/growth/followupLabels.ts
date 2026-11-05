/** fa/en labels for the follow-up engine's statuses, reasons and blockers. */
export const FOLLOWUP_STATUS: Record<string, [string, string]> = {
  queued: ["در صف", "Queued"], processing: ["در حال پردازش", "Processing"], sent: ["ارسال‌شده", "Sent"], dry_run: ["آزمایشی (ارسال نشد)", "Dry run (not sent)"],
  suppressed: ["متوقف‌شده", "Suppressed"], holdout: ["گروه کنترل (ارسال نشد)", "Holdout (not sent)"], failed: ["ناموفق", "Failed"], cancelled: ["لغوشده", "Cancelled"],
};

export const FOLLOWUP_REASON: Record<string, [string, string]> = {
  engine_disabled: ["موتور پیگیری خاموش است", "Follow-up engine is off"], dry_run_mode: ["حالت آزمایشی (فقط ثبت)", "Dry-run mode (record only)"],
  lifecycle_automation_disabled: ["سوییچ «اتوماسیون چرخهٔ عمر» خاموش است", "Lifecycle automation flag is off"], communications_disabled: ["سوییچ «ارسال خودکار پیام» خاموش است", "Automated communications flag is off"],
  no_channel_enabled: ["هیچ کانالی روشن نیست", "No channel is on"], rule_disabled: ["این قاعده در «پیگیری خودکار» خاموش است", "Rule is off in Automations"],
  live_campaign_disabled: ["کمپین لایو خاموش است", "Live campaign is off"], expired: ["منقضی (دیر شد)", "Expired (too late)"], unknown_rule: ["قاعدهٔ ناشناخته", "Unknown rule"],
  user_unavailable: ["کاربر در دسترس نیست", "User unavailable"], unsubscribed: ["لغو اشتراک کرده", "Unsubscribed"], suppressed_all: ["همهٔ پیام‌ها برای کاربر متوقف شده", "All messages suppressed"],
  no_longer_eligible: ["دیگر واجد شرایط نیست", "No longer eligible"], paid_customer: ["مشتری پولی (پیام تبلیغاتی نمی‌گیرد)", "Paying customer (no promotions)"],
  already_sent: ["قبلاً ارسال شده", "Already sent"], quiet_hours: ["ساعت سکوت", "Quiet hours"], frequency_cap_per24h: ["سقف ۲۴ ساعت", "24-hour cap"], frequency_cap_per7d: ["سقف ۷ روز", "7-day cap"],
  no_channel: ["کانال مجاز ندارد", "No allowed channel"], template_error: ["خطای متن پیام", "Template error"], max_attempts: ["تلاش‌ها تمام شد", "Out of retries"],
  retry: ["در انتظار تلاش دوباره", "Waiting to retry"], interrupted: ["قطع شد (دوباره ارسال نمی‌شود)", "Interrupted (never re-sent)"], admin_cancelled: ["لغو توسط مدیر", "Cancelled by an admin"],
  recorded_after_error: ["ارسال شد؛ ثبت با تأخیر", "Sent; recorded after an error"],
};

export const label = (map: Record<string, [string, string]>, key: string | null | undefined, fa: boolean) => key ? map[key]?.[fa ? 0 : 1] ?? key : "—";
