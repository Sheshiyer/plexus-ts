# Plexus 0.7.14 test release

Status: signed/notarized app and ZIP/DMG artifacts pass security, architecture, payload and packaged startup checks. The app is installed locally. Publication is held for native sign-in acceptance. A fresh sign-in partition restored the Access window; a private network trace then demonstrated cancellation of the shared Access application callback through the Clio relay. The narrow callback repair is being tested before rebuilding the signed candidate. See [native handoff evidence](evidence/2026-10-24-native-access-handoff.json).

This release prepares a normal macOS installation with durable account custody
and safer upgrade recovery. It also includes the reviewed Clio/Phloem, scoped
growth handoff and teammate calling source from PR175.

## Changes

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
