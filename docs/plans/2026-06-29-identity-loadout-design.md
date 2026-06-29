# Identity Loadout Page Design

Date: 2026-06-29
Status: validated design

## Goal

Create a dedicated Identity page that presents the signed-in member, available user skills, and Paperclip helper agents as an AAA-game-style operator loadout. The page should be read-only, truthful to live/local data, and visually aligned with the existing Plexus gunmetal HUD, chartreuse signal, mint text, hard-edge panels, and scanline field language.

Settings remains the place to edit profile and preferences. Fabric remains the place to manage local helpers and assigned tasks. Identity becomes the readable status surface: who the member is, what capabilities are unlocked, which skills are strong or degraded, and which Paperclip companions are available.

## Recommended approach

Use the RPG Loadout model:

- Member loadout first.
- Skills as stat-tree rows.
- Paperclip agents as companion cards or rows.
- Minimal actions: refresh, edit profile in Settings, and open Fabric only when helper data is degraded.

Rejected alternatives:

- Operations Passport: useful for credential proof, but too close to Settings/Admin.
- Agent Command Roster: useful for Fabric, but it makes agents primary and hides the member identity goal.

## Page structure

### 1. IdentityHeroCard

Promote the existing `PreferencesPanel` character preview into a first-class Identity hero.

Contains:

- 3D member model via `CharacterModelViewer`.
- Verified member title.
- Member name/reference.
- Level.
- Rank/class label derived from focus areas.
- Core stat bars: Focus, Cadence, Signal, Trust.
- Compact source tags such as `profile`, `preferences`, `proof`, and `fabric`.

The attached reference image is the visual baseline: large model viewport, sparse HUD frame, level badge, and stat meters. The Identity page should keep that feeling but make the lower half more useful by adding skills and companions.

### 2. SkillMatrix

Shows real app capabilities as game-like skills. Each skill has a score, meter, short explanation, source, and state.

Initial skills:

| Skill | Source | Meaning |
|---|---|---|
| Proofcraft | verified projects, GitHub evidence, work proof coverage | How well work can be traced to proof |
| Focus Control | focus areas, recent focus sessions | How clearly the member's work focus is configured |
| Cadence | working hours, standup compliance, quiet hours | How stable the member's rhythm and check-ins are |
| Signal | notes, bridge status, update channels | How much useful context Plexus has for summaries and nudges |
| Fabric Command | Paperclip health, helper availability, delegated task use | How ready local helper agents are |
| Collaboration | co-working presence, task updates, assignment sync | How connected the member is to workspace flow |
| Trust | verified identity, role, visibility, evidence quality | How strong the member's workspace trust posture is |

Rows can expand to show “why this score,” but they should not become editable forms.

### 3. AgentCompanionRoster

Paperclip agents should feel like companion loadouts, not diagnostics.

Use `AgentHealth` from `fabricStatus()`:

- `agentName` as companion name.
- `role` / `department` as class.
- `status` as health/readiness.
- `lastCycle` as freshness.
- `steps` as activity.
- `blocked` as friction.
- `missingFiles` and stale state as degraded signals.

If Paperclip is unavailable or there are no agents, the roster must say that plainly. Do not fake live companions.

### 4. LoadoutPerks

Small read-only capability chips:

- GitHub proof linked.
- Bridge connected.
- Daily proof ready.
- Local helpers available.
- Founder-visible reports.
- Quiet hours enabled.
- Rhythm enabled.
- Co-working presence available.

These are compact unlock indicators, not primary cards.

### 5. IdentityTimeline

A small optional feed of recent identity-related events:

- Profile saved.
- Bridge token active.
- Assignment synced.
- Proof submitted.
- Co-working joined.
- Helper scan completed.

This should stay compact and subordinate to the hero, skills, and companions.

## Data flow

Identity should load data in parallel:

- `window.plexus.memberPreferencesGet()`
- `window.plexus.settingsGet()`
- `window.plexus.fabricStatus()`
- `window.plexus.thoughtseedBridgeStatus()`
- `window.plexus.thoughtseedFabricTasks()`
- Existing project/evidence summaries used by Projects and work proof surfaces

Extract the current `getOperatorLoadout()` logic from `PreferencesPanel` into a shared helper so Settings and Identity compute consistent level and core stats.

Each data source degrades independently:

- Preferences unavailable: member card degrades.
- Fabric unavailable: companion roster degrades.
- Bridge unavailable: Signal and Collaboration degrade.
- Evidence missing: Proofcraft warns or locks.
- No Paperclip agents: companion bay shows an empty state.

The page should not fail as a whole unless every source fails.

## Interaction model

Identity is read-only and should have very few actions:

- Refresh loadout.
- Edit profile in Settings.
- Open Fabric only when helper data needs attention.

Allowed interactions:

- Click a skill row to expand score reasoning.
- Click an agent companion to reveal detail rows.
- Click a degraded state to navigate to the existing page that fixes it.

Disallowed interactions:

- Editing profile fields inline.
- Managing bridge tokens.
- Reporting task progress.
- Admin diagnostics.

Those belong in Settings, Fabric, Projects, Task Assignments, or Admin.

## Responsive behavior

Design for laptop screens first.

Wide desktop:

- Hero/model dominates one side.
- Skills and companions sit beside it in an asymmetric loadout grid.

Laptop:

- Hero compresses vertically.
- Core stats become two-column rows.
- SkillMatrix and companion roster become stacked rows.

Small/mobile windows:

- Model preview can collapse behind a “Profile preview” row.
- Skills stay visible before decorative model space.
- Agent companions become compact collapsible rows.

The page must never require scrolling through a giant model preview before reaching useful status data.

## Visual rules

- Use existing Plexus tokens and `px-*` components.
- Keep hard edges and hairline panels.
- Use chartreuse only for verified/unlocked/healthy state.
- Use warning for missing setup or stale data.
- Use rose only for real errors.
- Use Geist Mono for stat labels, values, and source tags.
- No emojis.
- No generic SaaS cards.
- No fake numbers.
- No pretending offline agents are live.

## Testing and verification

Unit-test pure scoring helpers where possible:

- Preferences to core loadout stats.
- Fabric status to companion readiness.
- Task state to Fabric Command modifiers.
- Evidence/project state to Proofcraft.

UI verification should cover:

- Fully connected identity.
- Partial degraded identity.
- No Paperclip agents.
- Small laptop-width layout.
- Read-only behavior with navigation-only actions.

