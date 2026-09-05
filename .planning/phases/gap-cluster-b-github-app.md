> Historical August planning snapshot. For current counts, commands and next actions, use ISA.md and P6-labs-migration-acceptance.md. This snapshot is not an execution queue.

# Gap Cluster B — GitHub App Permission + Live Probes

**Status**: blocked (requires live production access + GitHub App admin)
**Combo**: te-dispatch-paid
**Parallelism**: 3 concurrent groups (D1 probes, permission verification, token proof)
**ISCs**: 162-175 (12 ISCs, minus 166/170-172 which are already checked)

## Goal

Verify GitHub App registration, installation permissions, and live D1 probes for both personal and organization installations.

## ISC Checklist

### Desktop Delivery Proof

- [ ] ISC-162: signed desktop delivery proof recorded for first Plexus release with repaired GitHub surface

### D1 Live Probes

- [ ] ISC-163: read-only D1 probe confirms personal installation becomes `selected`
- [ ] ISC-164: read-only D1 probe confirms `thoughtseed-labs` binds to installation `146468777`
- [ ] ISC-165: authenticated Plexus probe shows founder actor as verified after active binding

### Permission Verification

- [ ] ISC-167: GitHub App requests only metadata read, contents write, PRs write, issues read, actions read, checks read
- [ ] ISC-168: organization installation grants complete required permission set
- [ ] ISC-169: personal installation grants complete required permission set
- [ ] ISC-173: read-only GitHub API probe confirms no unnecessary admin/merge-queue/hook/org-admin/project permissions
- [ ] ISC-174: live installation-token probe lists at least one explicitly selected repository
- [ ] ISC-175: permission approval via GitHub installation authority, not direct DB mutation

## Blockers

- GitHub App admin access for permission audit
- Live D1 database read access
- Production Plexus instance for authenticated probes

## Exit Test

```bash
# D1 probe
wrangler d1 execute plexus-db --command "SELECT * FROM installations WHERE selected = true" --remote
# Permission audit
gh api /app/installations/<id>/permissions
```
