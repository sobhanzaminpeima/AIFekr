# Video Factory audit — 2026-11-16

Backend implementation 5d34a454. UI implementation d93f6770.

## Implemented and tested
- Saved completed media now requires an owned, ready, unexpired asset with a file matching its recorded size. Missing output stops with SAVED_MEDIA_MISSING without an automatic paid re-submission.
- Fingerprint reuse checks the file for all media kinds.
- Completed rendered shots from failed and cancelled jobs can be reused by the existing render signature.
- Narrated scene quality checks reject missing audio, unreadable volume and invalid duration.
- Production progress follows the current media task kind and includes generated video. Partial progress survives failure.
- Failed and cancelled jobs have a direct continuation action opening the existing cost approval screen.
- Channel form loading uses stable dependencies, ignores late unmounted responses and exposes retry.
- Project refresh clears a previous loading error on success.

## Evidence
The isolated module suite passed 111 tests, with four skipped. The subsequent integration run passed 27 tests, including six saved images followed by only two new submissions and missing-file rejection without a provider call. Three new quality tests passed. Two native FFmpeg tests passed after updating their mock for current project/channel lookups. These generated MP4 files, checked duration and audio, and exercised image/video inputs, narration, music and Persian captions. Provider calls were mocked.
UI TypeScript and production build passed. A rendered-component regression confirmed that a failed narration task leaves completed images marked done.

## Routes traced
Projects, production wizard, script, storyboard/timeline/edit, costs, assets/download, ideas, characters, media, library, history, publishing, channel, advanced settings and packages are wired in LiveFactory. Administration uses the existing video-factory, control and economics endpoints.
Single-scene image regeneration, character upload/library/import, sample-image approval, narration timing, private downloads and publication confirmation already exist.

## Remaining verification
Complete interactive coverage of every authenticated route, responsive visual comparison, real-provider semantic quality and deployed end-to-end job verification remain outstanding. The connected browser inventory timed out twice. No new paid provider request or public publishing action was performed in this audit.
The render-reuse extension still needs a dedicated interrupted-render regression. Cross-attempt voice reuse is fingerprint-based and remains sensitive to provider version changes. Archive/trash semantics and full product-design review remain to be completed.
This report does not certify the module as fully audited.
