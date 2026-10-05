# Student journey and persistent payment tracking

The dashboard now has a permanent Payments & activation destination, pending-order reminder and mobile-friendly payment cards. Orders remain discoverable after closing checkout. Receipt review is distinguished from unfinished transfers; received receipts explicitly require no second payment. Expired subscriptions can still reach payment recovery without reopening paid features. Payment lists remain scoped to the authenticated owner; saved gateway URLs are restricted to official Zarinpal checkout URLs.

Student onboarding follows choose course → add material/audio → learn/review/practice. A searchable feature finder covers twelve destinations in Persian, English, German and Turkish. Student view/course links survive reload. Optional inputs and advanced tools are folded away. Exam registration can create editable review sessions without AI charges. Practice questions are shown one at a time.

Local browser verification: closing the entire checkout tab and reopening Home recovered both unfinished and submitted-receipt orders. Persian and English mobile views at 390 × 844 had no horizontal overflow. Persian feature search, native modal Escape, exam creation with seven automatic sessions, and session title/time editing passed. The time-field test found a React date-input issue; reading submitted native FormData fixed it, and the retest displayed the requested 18:30 time.

Automated validation: 121 test files, 846 tests passed with isolated bank and voice integration flags; TypeScript and targeted lint passed. Production build passed. An initial suite run without JWT_SECRET failed setup; the corrected isolated run is the reported result. No schema migration is required.

Synthetic accounts, payments, receipts and screenshots are local QA artifacts only and excluded from deployment. No real bank settlement or user-study difficulty percentage is claimed. Local proof: student-ease-overview-fa-mobile.png and student-ease-payments-fa-mobile.png.
