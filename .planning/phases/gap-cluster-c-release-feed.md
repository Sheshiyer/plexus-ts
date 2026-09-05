> Historical August planning snapshot. For current counts, commands and next actions, use ISA.md and P6-labs-migration-acceptance.md. This snapshot is not an execution queue.

# Gap Cluster C — Release Feed + Rollback Verification

**Status**: blocked (requires R2 access + production environment audit)
**Combo**: te-dispatch-paid
**Parallelism**: sequential (secrets audit first, then rollback verification)
**ISCs**: 41.1, 42.1, 43.3 (3 ISCs)

## Goal

Verify R2 rollback objects, confirm secrets audit, and validate release candidate workflow.

## ISC Checklist

- [ ] ISC-41.1: signed `v0.5.2` rollback objects satisfy current manifest and immutable-object cache-policy verifier without changing bytes
- [ ] ISC-42.1: unprivileged manual Release Candidate run passes on exact post-hardening `main` SHA without invoking Publish OTA
- [ ] ISC-43.3: `ota-production` contains all nine unique `OTA_*` secrets and no legacy Apple/R2 credential remains repository-scoped

## Blockers

- R2 bucket access for rollback object verification
- `ota-production` environment access for secrets audit
- Post-hardening `main` SHA for RC workflow test

## Exit Test

```bash
# Secrets audit
gh secret list --env ota-production | grep OTA_ | wc -l  # expect 9
# Rollback verification
curl -I https://ota.thoughtseed.space/rollback/v0.5.2/manifest.json  # expect 200
```
