# Gaming Shorts pilot

## Offer and launch gate

One customer-owned MP4, up to 30 minutes and 2 GB, produces three reviewed vertical Shorts, three covers, editable SRT captions and three sets of publishing metadata. Target delivery is 1–2 business days after order and source-quality approval.

The package identifier is `GAMING_SHORTS_3`. The preparation script creates a hidden, inactive DRAFT with no price. Price approval and an acceptable public sample are required before publishing the offer. This release does not activate sales.

Proposed launch price for owner review is **690,000 toman per three-clip order**, with one correction round. This is an assumption-based proposal, not a measured profitable price. Validate it against three timed manual deliveries. A 30-minute input limit bounds review effort. At an assumed labor rate of 500,000 toman/hour, a 30-minute edit/review budget costs 250,000 toman. Add actual provider fees, storage, payment fees and correction time before calculating contribution. The local render benchmark does not measure the editor's labor.

## Implemented routes

- `/video-factory?service=gaming` contains customer drafts, upload, purchase link, submission and private deliveries.
- `/admin/users/requests` includes a separate Gaming Shorts queue.
- `/api/video-factory/gaming` lists and creates owned drafts.
- `PUT /api/video-factory/gaming/:id` accepts at most 8 MiB at the server-acknowledged `X-Upload-Offset`.
- `POST /api/video-factory/gaming/:id` finishes the upload or submits it using an unused successful payment snapshot.
- `DELETE /api/video-factory/gaming/:id` removes an unpaid draft and its source.
- `/api/admin/video-factory/gaming` lists requests, approves them, accepts reviewed deliveries and separately queues the delivery email.
- Protected source and delivery downloads are authorized on every request. Video downloads support byte ranges.

The complete source is hashed after upload and inspected with FFprobe. Each chunk is persisted as an immutable file before its offset is acknowledged. A lost acknowledgement resumes from the server offset without overwriting previous chunks. Assembly uses a separate temporary file. Disk reservations include space for both chunks and the assembled source. A unique payment reference prevents duplicate package redemption. Gaming purchases are excluded from automatic film quotas and do not debit the credit wallet. Existing economy orders keep their workflow.

Approval and explicit delivery notifications reuse the existing notification table and Resend outbox. Inbox receipt requires a live test with an accessible recipient.

Large admin delivery endpoints bypass Next's 10 MiB proxy body clone while retaining route-level authentication, origin checks and rate limits. A real local Next HTTP test delivered a 12,584,391-byte archive intact, rejected an unauthenticated request and left order state unchanged for invalid media. The focused suite passes 21 tests, including routing, resumable chunks, single redemption and private delivery. These checks do not certify a real bank payment or email inbox receipt.

## Delivery ZIP contract

The administrator uploads a ZIP no larger than 150 MiB containing exactly:

- `clip-1.mp4`, `clip-2.mp4`, `clip-3.mp4`
- `cover-1.png`, `cover-2.png`, `cover-3.png`
- `captions-1.srt`, `captions-2.srt`, `captions-3.srt`
- `publishing.json`, an array of three objects with `title`, `description` and `tags`

Video files must be vertical 9:16, 15–90 seconds, and contain audio. Covers are decoded and normalized. Archive entries and extraction sizes are bounded. The customer downloads each artifact or the complete ZIP.

Before a production rollout, apply additive migration `20261123090000_gaming_shorts` after a database backup, generate an isolated Prisma runtime, and permit a 150 MiB body plus overhead on the exact admin delivery endpoint. Existing default upload limits can serve the 8 MiB source chunks. Run `scripts/prepare-gaming-shorts.ts` to prepare the inactive offer. Review retention and disk capacity for customer sources before enabling sales.

## Source and sample review

The local source is 640×360 at about 29.97 fps, 30:42 long. The existing local rights record identifies it as the owner's gameplay. It contains embedded Persian subtitles and a portrait overlay. Its length exceeds the customer input limit, so it is used only for internal rendering research.

Five inspected candidate windows:

| Source window | Observation | Decision |
| --- | --- | --- |
| 05:00–05:30 | Boat departure | Rejected for limited payoff |
| 06:10–06:40 | Open-water travel | Rejected for limited payoff |
| 08:55–09:25 | Descent and underwater environment | Internal preview |
| 21:20–21:50 | Scanner beside wreck debris | Internal preview |
| 29:38–30:08 | Pickup driving and turning | Internal preview |

Three internal 720×1280 previews took 21.62 seconds to render in one local benchmark. No paid API calls were made. Their captions are editorial observations, not verified speech transcripts. They are not approved advertising examples. Full-resolution source footage, timed human review and speech-caption verification are still needed.

## Repository review

No third-party repository code has been copied into the order implementation.

- [ClipKaro](https://github.com/allthingsaman/ClipKaro) declares MIT and is a candidate for a later isolated clipping worker. Check asset-specific notices and execution requirements before reuse.
- [GTA Clips Kitty plugin](https://github.com/ColinGPT9/Grand-Theft-Auto-6-Clips-Kitty-Plugin) declares MIT for the detector, while its host is AGPL.
- [clipping-gta-6](https://github.com/R3LAMP4GO/clipping-gta-6) declares AGPL-3.0. Review obligations before combining code.
- [flow-mcp](https://github.com/GTAI-1/flow-mcp) drives a local browser. Its documented Windows limitations require a separate acceptance run. It is not required for this manual upload-and-edit pilot.

The existing local GTAVI studio has its own API, filesystem and owner-oriented access controls. It must not be exposed directly as the AIFekr customer backend. Its core and chat-detection tests passed locally (25 tests). The complete media pipeline was not re-certified.

## Sales experiment

Draft copy: “ویدیوی گیم‌پلی خودت را بفرست؛ سه شورت عمودی با زیرنویس، کاور و عنوان تحویل بگیر. نمونه، قیمت نهایی و شرایط را پیش از پرداخت ببین.”

After owner approval, introduce the offer to ten relevant creators. Record source length, edit minutes, processing cost, delivery turnaround, revisions, paid conversion and net contribution. The initial experiment target is three paid deliveries. Contacting creators, publishing ads, approving the final price and promising delivery capacity remain owner decisions.

Proceed to automation after reviewed deliveries establish quality and labor cost. A public sample and payment-to-private-download acceptance run are required before paid advertising.
