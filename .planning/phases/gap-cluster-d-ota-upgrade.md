> Historical August planning snapshot. For current counts, commands and next actions, use ISA.md and P6-labs-migration-acceptance.md. This snapshot is not an execution queue.

# Gap Cluster D — OTA Live Upgrade Proof

**Status**: blocked (requires signed v0.7.7 publication + live app probe)
**Combo**: te-dispatch-paid
**Parallelism**: sequential
**ISCs**: 239 (1 ISC)

## Goal

Prove end-to-end installed upgrade from v0.7.6 to v0.7.7 with consent boundaries, account continuity, and content-bearing streamed turn.

## ISC Checklist

- [ ] ISC-239: installed signed v0.7.6 upgrades to v0.7.7 through separate consent boundaries, preserves account/workspace continuity, renders governed lane catalog, and completes a content-bearing streamed Clio turn

## Blockers

- Signed v0.7.7 publication in production OTA feed
- Live installed v0.7.6 instance for upgrade test
- Cloudflare Access relay-carrier configuration

## Exit Test

```bash
# Verify feed has 0.7.7
curl -s https://ota.thoughtseed.space/feed.json | jq '.version'  # expect "0.7.7"
# Verify installed version after upgrade
cat ~/Library/Application\ Support/Plexus/version  # expect 0.7.7
```
