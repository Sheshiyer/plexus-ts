# Plexus project status

Reviewed: 2026-09-05. This is a documentation orientation, not a generated inventory of the reader's checkout.

| Concern | Current reference |
|---|---|
| Source baseline | v0.7.12 / merged `e8d3a74`; check Git before starting new work |
| Planning and next steps | [`.planning/STATE.md`](.planning/STATE.md) |
| Acceptance | [`ISA.md`](ISA.md) |
| Documentation ownership | [`docs/DOCUMENTATION_MAP.md`](docs/DOCUMENTATION_MAP.md) |
| Labs migration receipts | [September 5 review](docs/evidence/2026-09-05-labs-migration-review.md) |
| Release operations | [`docs/OTA_RELEASE.md`](docs/OTA_RELEASE.md) |
| Repository and issues | [Plexus on GitHub](https://github.com/Sheshiyer/plexus-ts) |

The Workspace API is on Labs, but the feed pinned by v0.7.9–v0.7.12 is still on the personal Cloudflare account. The custom OTA hostname and a signed bridge release remain migration work. The review separates credentials, routing, object parity, and actual installed-client acceptance.

Preserve existing dirty files, branches, worktrees, and stashes. The July 28 generated snapshot previously shown here described a historical detached checkout and 54 changed files; those counts were not instructions to commit or stash the current workspace. Read the actual checkout's `AGENTS.md`, Git status, and planning state before acting.
