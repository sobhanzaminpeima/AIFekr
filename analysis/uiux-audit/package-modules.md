# Package module lists and call center emphasis

Release 42807c3 deployed to https://aifekr.com/pricing on 2026-10-04.

Shared four-language module list now appears on public business package cards and authenticated purchase cards. Includes strategy agents, CRM/sales/leads, social/SEO, finance, website/startup tools, AI chat/media and industry/gallery tools. AI Call Center is bold with a bordered accent panel on Growth and Scale; Launch retains ordinary text because its existing bundle entitlement also includes voice access. Existing subscription approval already sets voicePlan and its expiry for business bundles, so no payment or entitlement changes were necessary. Telephone/provider costs remain separately disclosed.

Validation: TypeScript and targeted ESLint passed, production build succeeded. Persian public pricing and German authenticated purchase cards checked at 390px: eight entries per card, exactly two highlighted call centers, no horizontal overflow. Isolated server preview returned 200 and confirmed the list and two highlights before activation. Live desktop pricing confirmed all three lists and emphasis on Growth/Scale. Previous release d397cee preserved for rollback. No database changes or real payment actions.
