# P6 first execution receipt

Observed 2026-09-05, final digest pass at 2026-09-05T14:04:19.018331+00:00. User instruction
"begin phase 1" resumes P6, the first phase of the published remaining roadmap.
This execution made GET-only cloud reads and prepared local change packets.

## Exact inventory and partial byte proof

[Structured object evidence](2026-09-05-p6-object-inventory.json) records181
legacy and165Labs objects under `plexus/`. The lists requested1000objects;
both were below that limit and returned no continuation. A separate per_page=1
probe returned a cursor/is_truncated=true, confirming pagination behavior.
API reference: [Cloudflare List Objects](https://developers.cloudflare.com/api/resources/r2/subresources/buckets/subresources/objects/methods/list/).

| Classification | Objects / keys | Meaning |
| --- | --- | --- |
| Byte-identical shared keys | 82 | Full streamed SHA256 matches in both accounts |
| Shared keys awaiting binary digests | 82 | Size matches only; ETags are not accepted as byte proof |
| Missing from Labs | 16 | ZIP/DMG/blockmaps for0.7.9,0.7.10,0.7.11,0.7.12 |
| Conflict | 1 | latest-mac.yml: legacy0.7.12 versusLabs0.7.8; excluded from copy |

174object reads (26,738,018bytes) completed SHA256/SHA512 and size verification.
The eight missing blockmaps have source digest evidence. Eight missing ZIP/DMG
reads timed out; all82shared large binaries remain unverified. The current ZIP
full-download probe received6,206,976of171,805,363bytes in60seconds (~103KB/s),
so partial bytes are not accepted as a digest or full-download receipt.

All164shared non-manifest objects differ in HTTP metadata. Labs lacks explicit
Cache-Control on164objects and Content-Type on38. Metadata repair therefore
needs a reviewed per-key contract as well as byte parity; copying bytes alone
will not establish transport acceptance.

The [copy candidates](../../.planning/P6-copy-candidates.json) include only the
eight fully hashed missing blockmaps. They are not approved or executed, exclude
all manifests/existing destination keys, and require refreshed source identity,
race-safe create-only behavior and destination byte verification. This is not a
complete release-copy set. No archive or manifest may be inferred into it.

## Hostname and public transport

[Profile-scoped route readback](2026-09-05-p6-route-readback.json) confirms exact
DNS read403; no upgrade hostname in the complete Worker domain list; no R2 custom
domains; Labs r2.dev disabled. The legacy public domain was independently matched
to its profile/account and is enabled. Curl observed the Labs hostname's DNS
prohibited-IP error1000, while the legacy latest manifest returned200/v0.7.12.
Python's default client instead hit1010 on public probes; those responses are
client-specific failures, not evidence the legacy feed is down.

The legacy0.7.12ZIP range0–31 returned206,32bytes and
`Content-Range: bytes 0-31/171805363`, with immutable cache metadata. This proves
only that range, not complete binary integrity or installed update acceptance.

## Reviewable route change

[Native R2 ownership packet](../../.planning/P6-route-repair-packet.md) and
[unapplied minimal config patch](../../.planning/patches/P6-native-r2-domain-owner.patch)
remove the future conflicting Worker claim while preserving both API domains.
The patch passed `git apply --check` on a scratch copy of the exact source.
Native R2 is the source-review recommendation; DNS access and canonical Worker
revision still precede integration. The patch does not fix existing proxy code
or establish that the shared Worker builds.

## Remaining acceptance and continuation

ISC-255/256 stay open, as do historical rollback/signing and installed-cohort
criteria. Resume the eight missing archive digests on an adequate download path,
then selected shared/rollback binary comparisons and per-key metadata review.
Obtain exact DNS ownership before applying the route packet. Keep all existing
objects and both discovery paths. No cloud objects, routes, credentials, releases
or application data were changed.

Routed review receipts: noesis-plan failed before response completion;
Antigravity Claude returned429quota exhausted; GitHub Claude returned401missing
provider credentials. None counts as a resolved successful worker. Independent
in-session source review supplied the route findings. The in-app console was
unavailable even though the injected manifest bridge receipt reported READY.

Local checks:190documents, zero link/catalog errors; release evidence and candidate
policies pass. Candidate entries match verified source hashes, exclude archives/
manifests and existing destination keys. ISC-255/256 remain unchecked.
