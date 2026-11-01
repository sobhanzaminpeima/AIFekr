# Web app installation and original Halloween catalog

Production app build: `a8fb73e0`; UI build: `2914b24`.

- UI: install entry in the platform sidebar, public menu and landing callout; Persian, English, German and Turkish instructions. Native installation only uses an actual browser `beforeinstallprompt` event. iOS and unsupported browsers receive manual instructions. No APK/store links or offline claim.
- Existing manifest identity, `/chat` start URL and app icons are preserved. No service worker caching of private API responses was added.
- Six original AI-generated Halloween previews and editable prompts are in `prisma/catalogs/halloween-2026.json`. Full PNG artwork and optimized WebP thumbnails are under `public/prompts/halloween/`.
- Canonical category: `halloween`. Admin: `/admin/prompts`. User: image studio → advanced settings → ready prompts → Halloween.
- `scripts/seed-halloween-catalog.cjs --apply` inserts only the six stable catalog IDs and preserves existing admin edits. Take and verify a consistent database backup before applying it. Production insertion completed once: 6 created, no replacements.

Validation: both production builds passed; 25 UI logic tests passed; isolated catalog seed created six rows on first run and zero on second. Production root and three localized landing pages, manifest and four app icons returned 200. All six public catalog thumbnails returned 200. Browser checked the native-install availability signal, mobile instructions at 390px and no dialog horizontal overflow at 320px. All six Halloween gallery images loaded. No provider generation or user-credit operation was run during production verification. Actual OS installation remains user initiated.

Runtime: backend `/var/www/aifekr-voice-49954a8/.next-rel-a8fb73e0`; UI `/var/www/aifekr-ui-v2-2914b24`; both PM2 processes online. Previous backend `.next-rel-e1251e55` and UI `/var/www/aifekr-ui-v2-3c9057b` retained for rollback. Existing module flags remain enabled. No schema, rates, limits or user data changes.
