# Plexus 0.7.14 test release

Status: corrected source `d920616` is signed, notarized and installed normally at `/Applications/Plexus.app`. The real Access redirect chain returns200 and the owner confirms the workspace opens. Normal quit/reopen preserves the exact encrypted credential and actor/workspace; visible reopen confirmation remains pending. Corrected ZIP/DMG archives and real OTA acceptance remain separate. The earlier archives do not contain this callback fix and must not be distributed. See [corrected candidate evidence](evidence/2026-10-24-0714-callback-candidate.json).

This release prepares a normal macOS installation with durable account custody
and safer upgrade recovery. It also includes the reviewed Clio/Phloem, scoped
growth handoff and teammate calling source from PR175.

## Changes

- The shared Cloudflare Access callback through the Clio relay is permitted only in the canonical Plexus API login window, after the expected Labs login page and in the main frame. Unrelated relay navigation remains blocked.

- A local automation port conflict leaves the desktop open rather than aborting
  startup, and cannot overwrite another instance's API credential.
- A temporary Keychain decryption failure retains encrypted sign-in custody for
  retry. Normal same-account reopen preserves credentials.
- Explicit logout or a validated account/workspace switch clears the previous
  member bridge credential and pending growth confirmations.
- Installer errors release the update latch and permit an explicit retry.
  Channel selection cannot silently enable downgrade installation.
- Clio uses the protected hosted Phloem relay and presents confirmed, scoped
  growth requests with durable returned drafts and source references.

## Verification so far

The complete local `verify:all` pipeline passed at source `db9ae12`: 897 tests,
type checking, documentation policy, both dependency audits (zero vulnerabilities),
fuse/CSP checks, release policy, production smokes and renderer build. Lint has
zero errors and seven existing warnings. The packaged application matched all
128 files in the tested `dist` tree before signing. Artifact and installed proof
remain separate.

The callback repair passes 50 focused authentication/database checks, successful type checking and lint, and actual Electron before/after redirect and post-code location-navigation probes. The corrected signed payload matches all128 tested dist files; all16 native binaries are arm64. Packaged SQLite and isolated renderer startup pass.

The selected Apple account authenticated successfully for team BS6SZR4929.
Local notarization uses a native Keychain profile, without forwarding its
password through the build environment.

## Acceptance boundary

The candidate must pass source/dependency, signed artifact, notarization and
Gatekeeper checks before distribution. Then verify a normal installation,
quit/reopen persistence, and an actual prior-version signed OTA transition.
A successful update check or an unsigned build is not upgrade acceptance.

The original live growth draft and mandatory receipt ACK are verified after
the approved native-768 Cortex repair. Its attempt and content digest are
unchanged. Ordinary-employee native acceptance and two distinct physical-client
teammate call acceptance remain open.

The stable 0.7.13 artifacts and feed remain intact during test preparation.
