# Gaming upload before payment

The user uploads and technically verifies their own MP4 before checkout. File size, duration and minimum resolution checks complete before a quote is issued. The quote snapshot contains the owned uploaded order ID; payment creation validates it again and preserves it in the immutable payment entitlement snapshot. An account without a checked file cannot buy this service, including through a direct API request. Existing unbound successful package purchases remain redeemable with Submit.

Verified bank settlement atomically marks the bound upload PENDING, assigns its unique payment reference and creates the administrator notification. The same transaction activates module access without changing the customer's credit wallet. Duplicate callbacks do not duplicate orders or notifications. A file with a pending linked payment cannot be deleted; a cancelled/failed payment can be retried against the same uploaded file. Free trial accounts may upload/check through the scoped gaming endpoints, but cannot submit for editing without a successful entitlement.

This change also fixes an existing settlement bug: Gaming Shorts entitlements were previously validated as automatic long-video limits. They now have their own zero-credit service activation path. Unit/integration checks cover real database settlement, idempotency, unchanged credits, cross-user ownership and pending-payment deletion protection. Gateway network calls are not mocked as successful money movement in production.

Public sales are temporarily closed during deployment. Reopen the same 690,000-toman offer only after the new build passes server acceptance. Source limits, two-order intake cap, delivery scope and existing customer purchases remain unchanged.
