# Plexus Lessons

## 2026-06-13 - Auth success is not product readiness

Pattern: Treating Cloudflare Access OTP success or a live `302` route as enough proof leaves Plexus stuck at "signed in, but no identity returned."

Rule: For Plexus auth work, proof requires the full chain: Access JWT captured for the app domain, Worker verifies it, `/v1/whoami` returns role-aware identity, Plexus stores a valid session, and the UI advances into real product state.

## 2026-06-13 - Onboarding must be real state, not a carousel

Pattern: A predetermined Next-button onboarding flow misrepresents the employee demo and hides optional feature choices.

Rule: Plexus onboarding must model required, optional, skipped, deferred, completed, and failed states through the Worker/D1 contract. Optional Paperclip/Vapor Clip, daily agent, standup, and preferences steps must be skippable and resumable.

## 2026-06-14 - Settings controls must have visible effect

Pattern: A settings dropdown that persists a value but does not change the renderer makes the app feel unfinished, even if the data layer technically writes.

Rule: Every Settings control must either apply immediately with visible feedback or be staged behind an explicit Save action. Theme controls must update the document theme tokens, not only store `settings.theme`.

## 2026-06-14 - Component references must survive implementation

Pattern: Good design-system references can still degrade into generic bordered boxes when each screen hand-rolls layout with inline styles.

Rule: Plexus screens should use shared composed primitives for command cards, flow cards, section bands, form grids, and report panels. Visual smoke must include both dark and light themes, because hard-coded dark SVG colors can fail after the Appearance setting starts working.

## 2026-06-15 - Verify R2 S3 keys before wiring release secrets

Pattern: `.claude/.env` can contain multiple R2-shaped key pairs. The uppercase `ACCESS_KEY_ID` / `SECRET_ACCESS_KEY` pair looked correct by length but failed R2 S3 calls with `SignatureDoesNotMatch`.

Rule: Before setting GitHub R2 secrets, test the exact candidate pair against the target bucket with the R2 S3 endpoint. For Plexus OTA, the working local pair is `Access_Key_ID` / `Secret_Access_Key`; keep `R2_BUCKET=plexus-updates` separate from TeamForge artifact buckets.

## 2026-06-15 - Slack and Huly are dependencies to retire, not integrations to build

Pattern: Realtime planning language can drift into "Slack integration" or "Huly integration" even when the intended product direction is to strip external SaaS dependencies and replace those workflows inside Plexus/TeamForge/Paperclip.

Rule: Describe Slack/Huly only as legacy external systems or replacement targets. Do not create new Slack/Huly-facing product phases, preference options, credentials, or route requirements unless the user explicitly re-opens a one-time import/backfill task.

## 2026-06-19 - Optional subsystems must degrade, not block the workspace

Pattern: Treating Paperclip, model-backed fabric work, standup sync, Worker refresh, OTA, or realtime media as required inline steps can halt the team workflow halfway through a timer, meeting, closeout, or logout.

Rule: Plexus should save the user's local action first, then hand off to optional subsystems through visible queued/sent/failed/retry states. Timer, Entries, Export, Backups, Settings, and Logout must remain reachable when Paperclip is offline, model quota is exceeded, Worker refresh fails, or SFU media negotiation fails.
