> Historical August planning snapshot. For current counts, commands and next actions, use ISA.md and P6-labs-migration-acceptance.md. This snapshot is not an execution queue.

# Gap Cluster A — Protected Release Publication (v0.5.5 + v0.5.6)

**Status**: blocked (requires Apple signing + R2 secrets in `ota-production`)
**Combo**: te-dispatch-paid
**Parallelism**: sequential (v0.5.5 first, then v0.5.6)
**ISCs**: 66-70, 111-115 (10 ISCs)

## Goal

Execute protected CI merge, tag, signed/notarized publication for v0.5.5 and v0.5.6.

## ISC Checklist

### v0.5.5 Consolidation

- [ ] ISC-66: protected PR CI passes on macOS, Ubuntu, and Windows
- [ ] ISC-67: reviewed head merges to `main` without bypassing checks
- [ ] ISC-68: tag `v0.5.5` identifies exact protected merge commit
- [ ] ISC-69: Publish OTA produces signed/notarized artifacts, feed updates to `0.5.5`
- [ ] ISC-70: downloaded ZIP passes packaged-renderer launch smoke

### My Studio v0.5.6

- [ ] ISC-111: protected PR CI passes on macOS, Ubuntu, and Windows
- [ ] ISC-112: reviewed head merges to `main` without bypassing checks
- [ ] ISC-113: tag `v0.5.6` points to exact merge commit (PR #107 + My Studio)
- [ ] ISC-114: OTA publisher produces signed/notarized macOS artifacts, feed to `0.5.6`
- [ ] ISC-115: GitHub Release assets have exact v0.5.6 filenames, paths, sizes, SHA-512

## Blockers

- Apple Developer signing certificate + notarization credentials in `ota-production` environment
- R2 credentials for OTA feed publication
- All nine unique `OTA_*` secrets present (see Cluster C, ISC-43.3)

## Exit Test

```bash
gh release view v0.5.5 --json tagName,assets | jq '.tagName'
gh release view v0.5.6 --json tagName,assets | jq '.tagName'
curl -s https://ota.thoughtseed.space/feed.json | jq '.version'
```
