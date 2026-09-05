# P5 reconciliation overlay — 2026-09-05

The prior snapshot below is historical. Actual initial count was 303/327 checked
and 24 open. Ten historical criteria now have exact GitHub evidence: ISC-42.1,
66–69, 111–115. This yields 313/327 before current migration criteria.

Retain 41.1, 43.3, 70, 162–165, 167–169, 173–175 and 239 open. ISC-239 is a
historical failed transition whose later recovery is ISC-246; it is not a new
request to publish v0.7.7. The old bare Wrangler/plexus-db example in Cluster B
is superseded by P6's explicit Labs config and schema-first probe instructions.

Continue in P6-labs-migration-acceptance.md. The manual main RC criterion has
historical success plus a skipped publishing workflow; it does not need a new
run to prove that historical criterion. Five environment values remain pending
with the user. Labs Worker App/Realtime secret names are present, though live
credential/permissions proof remains pending.

## Retained prior phase snapshot

# Phase P5 — Gap Execution

**Status**: in-progress
**Historical combo (retired, do not dispatch)**: te-algorithm + te-build
**Parallelism**: Cluster C (ISC-43.3) first, then B/A/D as access permits

## Goal

Close28 ISA gaps across four clusters via operational work.

## Cluster Status

### Cluster C: Release Feed + Rollback (ISC-41.1, 42.1, 43.3)

- [x] **ISC-42.1**: RC workflow passes on main — demonstrated by v0.7.9-v0.7.12 tag-triggered runs (all success). Manual `workflow_dispatch` run available but not yet triggered.
- [ ] **ISC-43.3**: ota-production has4/9 OTA_* secrets. **5 missing**: OTA_APPLE_APP_SPECIFIC_PASSWORD, OTA_CSC_LINK, OTA_CSC_KEY_PASSWORD, OTA_R2_ACCESS_KEY_ID, OTA_R2_SECRET_ACCESS_KEY. Values are write-only in GitHub — user must provide or run migration command.
- [ ] **ISC-41.1**: R2 rollback object verification — blocked by R2 access credentials.

### Cluster B: GitHub App Permission + Live Probes (ISC-162-175, 10 ISCs)

- [ ] **ISC-167/173**: GitHub App permission audit — blocked by JWT auth (personal token can't call `/app` endpoint).
- [ ] **ISC-163/164/165**: D1 live probes — blocked by Wrangler/D1 access.
- [ ] **ISC-168/169**: Installation permission verification — blocked by GitHub App admin.
- [ ] **ISC-174/175**: Installation-token proof — blocked by GitHub App admin.

### Cluster A: Protected Release Publication (ISC-66-70, 111-115, 10 ISCs)

- [ ] All ISCs require protected CI merge + tag + signed publication.
- [ ] **Blocker**: Apple signing certificate + notarization credentials + R2 secrets in ota-production.

### Cluster D: OTA Live Upgrade Proof (ISC-239)

- [ ] Requires signed v0.7.7 publication + live app probe.
- [ ] **Blocker**: Depends on Cluster A completion.
- [x] GH issue created: thoughtseed-vault#240

## Secret Migration (ISC-43.3)

**Current ota-production secrets (4):**
- OTA_APPLE_ID ✓
- OTA_APPLE_TEAM_ID ✓
- OTA_R2_ACCOUNT_ID ✓
- OTA_R2_BUCKET ✓

**Missing (5):**
- OTA_APPLE_APP_SPECIFIC_PASSWORD
- OTA_CSC_LINK
- OTA_CSC_KEY_PASSWORD
- OTA_R2_ACCESS_KEY_ID
- OTA_R2_SECRET_ACCESS_KEY

**Migration command** (user must run with actual values):
```bash
gh secret set OTA_APPLE_APP_SPECIFIC_PASSWORD --env ota-production -R Sheshiyer/plexus-ts
gh secret set OTA_CSC_LINK --env ota-production -R Sheshiyer/plexus-ts
gh secret set OTA_CSC_KEY_PASSWORD --env ota-production -R Sheshiyer/plexus-ts
gh secret set OTA_R2_ACCESS_KEY_ID --env ota-production -R Sheshiyer/plexus-ts
gh secret set OTA_R2_SECRET_ACCESS_KEY --env ota-production -R Sheshiyer/plexus-ts
```

## Acceptance Criteria

- All28 ISCs checked in ISA.md
- Each cluster's exit tests pass
- No ISC marked complete without tool-verified evidence

## Dependencies

- User provides secret values for ISC-43.3 migration
- GitHub App JWT auth for Cluster B
- Apple signing certificate for Cluster A
- R2 access credentials for ISC-41.1
