# Gaming Shorts release preparation — 2026-11-24

## Offer

Three team-reviewed vertical Shorts, each 30–60 seconds, from one customer-owned MP4 at 720p or higher, up to 30 minutes and 500 MB. Includes covers, editable captions and publishing metadata. The launch price being prepared is 690,000 toman, a single service purchase with no credit-wallet debit. Do not mix this entitlement with automatic or economic ten-minute video packages. Submit within 30 days of purchase; delivery is 1–2 business days after source approval. One in-scope revision may be requested within seven days of delivery.

## Intake and support

- At most two open orders/reservations. A shared database write serializes draft intake and payment capacity checks. Checkout refuses new orders when capacity or disk reserve is insufficient and refuses another purchase while an unredeemed package exists.
- Sources are bounded at 500,000,000 bytes; the existing immutable 8 MiB chunks preserve resumability. Keep at least 2 GB free at intake/checkout, in addition to assembly checks.
- Customers can request one revision after delivery. The request and note appear in the admin queue and notification outbox. The administrator reopens editing and uploads a replacement package. A second included revision is refused.
- Before editing starts, customers can request cancellation. Editing is blocked while cancellation is pending. Administrators must record an agreement and payment-resolution note before closing or resuming the order. Closing an order does not execute a bank refund or mutate settlement records.
- No promise of views, virality, monetization, new game footage, or automatic YouTube publication. This is an editing service for the customer's own gameplay.

## Email acceptance

Three explicitly labelled test notifications were sent to the owner's supplied address through the actual notification email sender using an isolated test database. The provider accepted all three, and the owner confirmed all three arrived in Inbox. No purchase was created and no customer notifications were sent by this test.

## Public launch gates

Keep the offer unpublished until a source with actual 720p+ quality is reviewed and a real bank checkout-to-delivery is completed. The existing internal 360p-derived outputs are transport/render fixtures, not advertising samples. Bank credentials must be entered by the owner, never requested in chat. A successful mocked callback is not bank settlement. Retain a release backup and test private mobile downloads after deploying these changes.

## Deployment acceptance

Backend `207dfcd2` and UI `5a57eeb` deployed successfully with a verified database backup and rollback versions preserved. The production package remains inactive, hidden and DRAFT, now with a fixed monthly-key service price of 690,000 toman and consistent 500 MB source limits. This is a one-time service entitlement, not a subscription renewal or wallet top-up.

The focused suite passes eight gaming lifecycle/capacity tests, ten automatic-package separation tests, and 46 pricing/payment/email tests. Interactive component checks pass at 390 and 1366 pixels, including revision and cancellation forms. An isolated database on the actual server passed native HTTP upload/resume, one entitlement redemption, FFmpeg-validated delivery, private file and ZIP downloads, a single revision, redelivery, and cancellation hold/resolution. No real bank settlement was performed by these tests. The owner separately confirmed that all three actual notification test emails arrived in Inbox.

The supplied footage directory was checked again: its only source is `videoplayback.mp4`, 640×360, 30:42.64. It cannot satisfy the public sample's quality gate and exceeds the advertised input duration. Do not relabel enlarged output as native 720p footage.

UI `97d625a` subsequently corrected the entry's placement in the live home layout. Live browser checks passed at 390 and 1366 pixels: the home card is visible, has no pilot label, and links to Gaming Shorts. The actual authenticated catalog reports a 500,000,000-byte maximum and sales disabled. The campaign copy was aligned with the 30–60-second output and seven-day revision window; it continues to describe closed intake honestly.
