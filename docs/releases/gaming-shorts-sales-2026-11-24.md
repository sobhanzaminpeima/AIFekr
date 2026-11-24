# Gaming Shorts sales activation — 2026-11-24

The owner explicitly requested public sales activation and Zarinpal/admin integration. `GAMING_SHORTS_3` is now active, public and PUBLISHED at a fixed 690,000 toman service price. Scope remains three team-reviewed 30–60-second Shorts from one owned MP4, at least 720p, at most 30 minutes and 500 MB, with covers/captions/publishing metadata, one revision and capacity-controlled intake. This is an editing service, not generated gameplay or automatic YouTube publishing.

## Fixes and verification

- Gaming quotes use gaming entitlements rather than long-video credit limits. Three focused quote tests passed, including malformed entitlements and the sales approval gate.
- The package catalog exposes Gaming availability independently of automatic film production readiness. Other video packages retain their existing readiness rules.
- A production checkout test found that legacy FX validation ran before the immutable toman quote was applied. The fixed quote now bypasses that intermediate conversion. A regression test with missing FX rates and the payment-create suite passed (29 tests).
- Backend `b0a7f3bc` and UI `3ed3265a` were built and deployed. The package remains manageable in `/admin/packages?category=VIDEO_FACTORY`; orders and delivery are managed at `/admin/users/requests?type=gaming`; payment lifecycle remains in the existing admin Payments module.
- Actual production API calls obtained a 690,000-toman quote and a real `www.zarinpal.com/pg/StartPay/…` authority using the approved test account. The resulting PENDING order was visible in admin and was cancelled through the real admin endpoint after the gateway was checked. No money was paid and no SUCCESS entitlement was fabricated.
- Live browser checks at 390 and 1366 pixels passed: Gaming page buy link, direct fixed-toman checkout, Zarinpal pay button, and the published package in admin. The public catalog reports `purchaseAvailable: true`, `currency: IRT`, `minor: 690000`. Production health is 200.

## Practical limits

Gateway request creation and unpaid admin cancellation are confirmed. Actual card payment/settlement and activation after a paid bank transaction remain unverified. Earlier isolated acceptance covered successful entitlement redemption, duplicate prevention, media delivery, private downloads, revisions and cancellation resolution. All three actual notification emails were confirmed by the owner in Inbox.

The available 360p footage remains unsuitable as a high-quality advertising sample. Public sales were enabled at the owner's express direction; this activation does not certify sample quality, virality or channel revenue. Keep the two-order intake cap and storage checks in place.
