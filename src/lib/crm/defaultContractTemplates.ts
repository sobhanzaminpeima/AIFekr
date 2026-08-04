/**
 * Starter contract templates seeded on request (not automatically) via
 * POST /api/crm/contract-templates/seed-defaults. Tenants are expected to
 * edit the clause text to match their own business policy — these are a
 * starting point, not final legal documents. See LEGAL_DISCLAIMER below,
 * which the UI must show wherever a template or contract is edited/generated.
 */

export const LEGAL_DISCLAIMER_FA =
  "این قالب صرفاً یک نقطه شروع است و توصیه یا مشاوره حقوقی محسوب نمی‌شود. لطفاً پیش از استفاده، نسخه‌ی نهایی و سفارشی‌سازی‌شده را با یک وکیل یا مشاور حقوقی متخصص در حوزه‌ی قضایی خود بازبینی کنید.";

export const LEGAL_DISCLAIMER_EN =
  "This template is a starting point only and does not constitute legal advice. Please have your customized version reviewed by a qualified lawyer for your jurisdiction before use.";

export interface DefaultTemplate {
  name: string;
  content: string;
  industrySlug?: string;
}

export const DEFAULT_CONTRACT_TEMPLATES: DefaultTemplate[] = [
  {
    name: "قرارداد فروش/خدمات عمومی (فارسی)",
    content: `قرارداد فروش/ارائه خدمات

این قرارداد میان «{{contactName}}» (که از این پس «مشتری» نامیده می‌شود) و ارائه‌دهنده خدمت منعقد می‌گردد.

ماده ۱ — موضوع قرارداد
موضوع: {{dealTitle}}
مبلغ قرارداد: {{dealValue}} تومان

ماده ۲ — تعهدات طرفین
طرفین متعهد می‌شوند نسبت به اجرای کامل و به‌موقع تعهدات خود اقدام نمایند.

ماده ۳ — نحوه پرداخت
پرداخت طبق توافق طرفین و فاکتور صادرشده انجام می‌شود.

ماده ۴ — فسخ قرارداد
هر یک از طرفین در صورت عدم ایفای تعهدات طرف مقابل، حق فسخ قرارداد را با اطلاع کتبی قبلی خواهد داشت.

تاریخ: {{date}}
امضای مشتری: __________________
امضای ارائه‌دهنده: __________________`,
  },
  {
    name: "General Sales/Service Agreement (English)",
    content: `SALES / SERVICE AGREEMENT

This Agreement is entered into between "{{contactName}}" ("the Customer") and the Service Provider.

1. Subject of Agreement
Subject: {{dealTitle}}
Contract Value: {{dealValue}}

2. Obligations of the Parties
Both parties agree to fully and timely perform their respective obligations under this Agreement.

3. Payment Terms
Payment shall be made as agreed between the parties and per the issued invoice.

4. Termination
Either party may terminate this Agreement upon prior written notice if the other party fails to perform its obligations.

Date: {{date}}
Customer Signature: __________________
Provider Signature: __________________`,
  },
  {
    name: "قرارداد خرید/اجاره ملک (فارسی)",
    industrySlug: "real-estate",
    content: `قرارداد خرید/اجاره ملک

این قرارداد میان مالک و «{{contactName}}» (که از این پس «خریدار/مستأجر» نامیده می‌شود) منعقد می‌گردد.

ماده ۱ — مشخصات ملک
آدرس: {{address}}
متراژ: {{area}} متر مربع
نوع معامله: {{dealType}}

ماده ۲ — مبلغ و نحوه پرداخت
مبلغ کل: {{dealValue}} تومان — طبق توافق طرفین و اقساط تعیین‌شده پرداخت می‌گردد.

ماده ۳ — تعهدات مالک
مالک متعهد به تحویل ملک مطابق مشخصات فوق در تاریخ مقرر است.

ماده ۴ — تعهدات خریدار/مستأجر
خریدار/مستأجر متعهد به پرداخت به‌موقع و رعایت شرایط قرارداد است.

ماده ۵ — فسخ و انصراف
شرایط فسخ طبق توافق طرفین و قوانین جاری کشور تعیین می‌شود.

تاریخ: {{date}}
امضای مالک: __________________
امضای خریدار/مستأجر: __________________`,
  },
  {
    name: "Property Purchase/Rental Agreement (English)",
    industrySlug: "real-estate",
    content: `PROPERTY PURCHASE / RENTAL AGREEMENT

This Agreement is entered into between the Owner and "{{contactName}}" ("the Buyer/Tenant").

1. Property Details
Address: {{address}}
Area: {{area}} sq. m.
Transaction Type: {{dealType}}

2. Price and Payment Terms
Total Amount: {{dealValue}} — payable as agreed between the parties and per the scheduled installments.

3. Owner's Obligations
The Owner agrees to deliver the property as described above on the agreed date.

4. Buyer/Tenant's Obligations
The Buyer/Tenant agrees to make timely payments and comply with the terms of this Agreement.

5. Termination
Termination terms shall be governed by the agreement of the parties and applicable local law.

Date: {{date}}
Owner Signature: __________________
Buyer/Tenant Signature: __________________`,
  },
];
