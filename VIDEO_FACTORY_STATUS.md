# Video Factory: YouTube Video Factory master prompt, status checkpoint

Checkpoint for the master prompt `AIFekr_YouTube_Video_Factory_Claude_Code_Master_Prompt.md`. The owner asked (2026-11-14) to build it inside the existing **Video Factory** (کارخانهٔ ویدیو), fully automated: script → list of every image prompt → generate them one by one → a Google-Flow-like media page with upload and download.

Branches: backend `claude/video-factory-media-20261114`, UI `claude/video-factory-media-ui-20261114`. **Not pushed, not deployed.**

## Phase 0: what already exists (verified in code)

The factory is far along. Do not rebuild it.
- **Data (prisma):** `VideoFactoryProject` (configuration, manifest, version), Version, Job, Step, Artifact, Asset, StorageQuota, Provider, Resource, ConfigVersion, Approval, QualityReport, PublishJob, Channel, WebhookEvent.
- **Script and storyboard:** a manifest of chapters → shots, each with narration, `visualPrompt`, motion, optional `assetId` and revision (`lib/video-factory/domain.ts`). Shots per chapter are configurable; there is a character list, a style bible, and review gates (`AUTOPILOT`, `REVIEW_GATES`, `PRO_STUDIO`).
- **Production:** `production.ts` builds a costed task list per shot (IMAGE, VIDEO, TTS, ALIGNMENT, MUSIC, SFX, CLONE, TRANSCRIPTION). The media worker (`mediaWorker.ts`, provider adapters in `mediaAdapters.ts`) runs them with fingerprints, so unchanged shots are not paid for twice. Assets are saved per shot with a per-user storage quota (`assets.ts`).
- **Editing and output:**
  - Timeline and subtitles (SRT/VTT), plus aligned captions when forced alignment is on.
  - Native and Remotion rendering, quality reports and versions with restore.
  - YouTube connect and publishing.
- **Billing:** estimates per action, budget caps, package and retail pricing, and credit reservation and settlement through the shared ledger.
- **UI (new design):**
  - Tabs: Projects, Production wizard, Script & storyboard, Characters, Timeline, Edit shots, Asset library, Deliverables, Publishing, Audio & quality, Versions, Packages.
  - Files: `components/live-factory*.tsx`.

## Built in this checkpoint

- **One image for every shot** (`configuration.imageEveryShot`): every shot that is not a title, chart or map gets its own generated image, instead of the quality preset's image share. The estimate and the production plan both use it, so the price shown is the price charged. It appears in the project settings as a checkbox.
- **Media & prompts tab** (`/video-factory?tab=media`, `components/live-factory-media.tsx`):
  - Every shot in order as `SHOT_001…`, with its image prompt and image, refreshing while a job runs.
  - Progress shown as images present out of total shots, never a fake percentage.
  - **Prompts:** download all prompts as `[SHOT n]` blocks, ready for bulk tools; copy one prompt.
  - **Upload:** bulk upload where files named `SHOT_012.png`, `shot-12.jpg` or `012.webp` land on their shot, and files without a number are reported, not guessed. Replace or upload a single shot's image.
  - **Regenerate:** select shots, and they get new images on the next run (the revision changes the fingerprint).
  - **Download:** one image, or every image plus `prompts.txt` as a ZIP named `SHOT_###.ext`.
- **API** `GET|POST /api/video-factory/projects/[id]/media` (owner-only, through `factoryRoute`): list, `?format=prompts`, `?format=zip` and `attach` / `regenerate`. Edits go through the existing `editManifest`, so ownership, image types, busy jobs and version conflicts are enforced there. The ZIP writer is dependency-free (`lib/video-factory/media.ts`).
- **Tests:**
  - `lib/video-factory/media.test.ts`: numbering, prompt list, filename matching, edits, ZIP bytes and CRC, every-shot plan.
  - `api/video-factory/projects/[id]/media/route.test.ts`: list, prompts, ZIP, attach, unknown shot.
  - UI spec `tests/factory-media.spec.ts`.

## Not done yet, in order

1. **Live check:** an end-to-end run with real providers, from a script with N prompts to N generated images, a render and an MP4 checked with ffprobe. Not run here, because it is a paid provider call.
2. **Package limits:** the IMAGE_MOTION package caps shots per chapter at 8 (`PACKAGE_SHOT_LIMIT`). Long videos with 70–100 images need the owner to raise the limits or define a package for it. That is a pricing decision, deliberately not changed.
3. **Phase 2 items:** a visual bible and character sheet generation with reference images, stickman and custom-character presets, and channel presets.
4. **Phase 3 items:** forced alignment as the default timing (it exists as an option), drag-and-drop timeline editing and Ken Burns controls in the UI.
5. **Phases 4–5:** admin pricing versions for the factory, the landing page section, spend caps per provider and a monitoring runbook. Much of the billing already exists; it needs review against the prompt.
6. **Google Flow:** it has no official API, so it stays an import path (bulk upload by filename), never automation.
