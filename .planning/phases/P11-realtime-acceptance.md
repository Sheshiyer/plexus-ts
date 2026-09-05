# P11 — Realtime acceptance

Status: planned; existing client wiring requires live acceptance.
Acceptance: [ISA](../../ISA.md), ISC-294–296. This is W5 of the
[connected-operations overview](P7-connected-operations.md); retain existing
issues #26 and #23 without claiming either is complete.

## Objective and ownership

Prove authorized two-client media through the canonical SFU broker with explicit
consent, observable authorization and complete teardown. Recording controls must
tell the truth about accepted implementation.

Accountable owner: Plexus Realtime maintainer. Broker/API co-owner: canonical
Workspace Worker maintainer. Provider configuration owner supplies the SFU
binding and live negotiation evidence. Product/privacy owner defines consent,
capture scope and, if separately implemented, recording retention policy.

## Scope and dependencies

- Preserve the finding that project media wiring is enabled; establish exact
  canonical Worker source/deployed revisions before diagnosing missing behavior.
- Verify room/project authorization, session negotiation, required media types,
  remote tracks, audit events and resource cleanup across two installed clients.
- Keep unavailable recording actions withheld unless matching main handlers,
  consent, storage, access and retention paths are implemented and accepted.
  Preload declarations alone provide no capability; transcription stays deferred.
- Client and fixture work can run alongside P9/P10. Live probes require P7's actor
  and project boundaries, provider access and a declared signed client candidate.
  Realtime acceptance is separate from the first daily-report migration slice.

## Execution package

1. Pin broker source/configuration, deployed revision and both client digests;
   specify required media and consent/audit behavior before opening test rooms.
2. Run contract fixtures for authorized and denied joins, expired sessions,
   project changes and provider failures. Inventory actual recording executors.
3. Use two synthetic authorized members in a scoped room. Exercise the declared
   media matrix and capture negotiation, remote-track and audit receipts.
4. Repeat denial, permission withdrawal, disconnect, leave and application-exit
   cases; verify capture stops, devices/tracks close and room/session state clears.

## Fixtures and acceptance probes

| Criterion | Required proof |
| --- | --- |
| ISC-294: Two authorized installed clients exchange the required media through the canonical SFU broker. | Two distinct installed clients exchange the declared required audio/video/screen media; correlate broker negotiation and received tracks with pinned revisions. |
| ISC-295: The Realtime consent and authorization audit suite passes across join, capture, leave and teardown. | Test consent grant/denial/revocation, wrong project/member, expired authority, device failure and disconnect; verify scoped audits, stopped capture and no lingering tracks/sessions. |
| ISC-296: Unavailable recording operations are withheld unless their complete consent and storage path is accepted. | Missing/disabled executors expose no usable recording action. Any enabled path must prove handlers, consent, authorized storage/readback, retention and failure cleanup together. |

## Live gates and phase exit

Provider configuration changes, broker deployment and real participant capture
need the owning execution packet. Use consenting synthetic test participants and
bounded test media; document how to end sessions and withdraw the candidate
configuration. Do not introduce recording or transcription merely to close a
Realtime issue.

Exit requires ISC-294–296 receipts for both installed clients and the canonical
broker. Source-wiring tests do not prove SFU negotiation or delivery. Recording
may remain unavailable while ISC-296 passes by truthful withholding; document
that accepted product state and preserve any separate recording implementation
backlog. Supply accepted scope and teardown evidence to
[P12](P12-installed-acceptance.md).

## GitHub work packages

Phase epic: [P11](https://github.com/Sheshiyer/plexus-ts/issues/153). Current links and dependencies: [GitHub roadmap](../GITHUB_ROADMAP.md).

- [P11-SFU](https://github.com/Sheshiyer/plexus-ts/issues/26): Accept canonical SFU broker and two-client media — Operator gate.
- [P11-PRIVACY](https://github.com/Sheshiyer/plexus-ts/issues/23): Accept Realtime permissions, consent and recording availability — Ready local.
