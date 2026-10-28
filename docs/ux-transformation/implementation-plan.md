# Implementation Plan & Status

## Done (branch `feat/customer-growth`, not deployed)
1. Workspace registry `src/lib/navigation/workspaces.ts` (6 workspaces over existing routes) + goal-search keywords.
2. Preference: `GrowthProfile.workspaces` / `activeWorkspace` (additive migration `20261028190000_workspace_preference`), API `GET/POST /api/user/workspaces`.
3. Sidebar: `WorkspaceNav` switcher + workspace groups; classic menu behind "All tools" when a workspace is active; untouched when none is.
4. Home: `WorkspaceHome` (picker or workspace header with first step, quick actions, search); business command centre shown only for business/real-estate/classic.
5. Search: `CommandPalette` ranks by names + fa/en goal synonyms; `feature_search_used` event.
6. Flag `adaptive_workspaces_enabled` in Admin → Customer Growth → Settings (rollback without deploy).
7. Events: `workspace_switched`, `workspace_selected`, `feature_search_used` feed the Growth Center.

## Recommended next (not implemented)
- Admin editor for workspace groups/labels (today: code registry; module on/off already admin-controlled).
- Favorites / recent tools in the sidebar.
- Smart onboarding: multi-select interests → set workspaces directly (today it suggests one).
- Relabel technical names in `destinations.ts` (e.g. "SEO workflow" → "Write articles").
- Contextual guide answers from the registry in the existing floating support widget.

## Rollout
1. Deploy with the flag on; existing users see only the switcher and a one-time picker on home.
2. Watch `workspace_switched` / `feature_search_used` in the Growth Center for 1–2 weeks.
3. Rollback: flag off (instant) or previous dist dir.
