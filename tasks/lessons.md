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
