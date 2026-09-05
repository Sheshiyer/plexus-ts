# P7 identity and project authority continuation

Current source receipt: [P7 foundations](../docs/evidence/2026-09-05-p7-source-foundations.md).
Phase owner: [Plexus #149](https://github.com/Sheshiyer/plexus-ts/issues/149).
P6 remains an open installed-delivery dependency.

## Next source slice: current mapping authority

[P7-MAPPING #160](https://github.com/Sheshiyer/plexus-ts/issues/160) remains In
Progress. Identity retention is implemented; cached evidence is not permission.
Before changing runtime consumers, specify the authoritative membership/mapping
response and its freshness policy against the canonical Worker revision.

1. Establish the owning Worker checkout and deployed revision. Reconcile the
   differing entry point/control-plane files and missing remote Labs config;
   do not deploy the local non-Git directory by inference.
2. Implement actor/workspace-bound mapping state, successful-empty and revoked
   reconciliation, explicit stale/unknown states, and account-switch invalidation.
   Preserve local work on revocation. A failed read or summary fallback cannot
   renew permission; retain existing mapping timestamps only as historical data.
3. Apply one shared current-authority check to vault matching, timer/manual work,
   GitHub sync and verification, agent-session acceptance, and queued report/event
   delivery. Known consumer anchors: `vault-projects.ts`, `timer-session.ts`,
   `main.ts` (`requireVerifiedRepoProject`, `verifyAndPersistProjectRepository`),
   `agent-sessions.ts`; trace outbound consumers before finalizing the edit set.
4. Prove removed/inactive mappings, local-only UUIDs, empty versus failed reads,
   wrong tenant/actor, expiry, restart, offline behavior and account switch. Old
   local data must survive while denied actions produce no remote side effect.

## Cambium adapter and reference integration

[Cambium #371](https://github.com/Sheshiyer/cambium/issues/371) has a reviewed
source candidate for committed-reference checks. Before integration, implement
an authenticated adapter and trusted principal-to-resource grant resolution.
`Principal.allow` is UI subsection scope, not a WorkObject grant. The existing
wildcard tenant cannot be replaced by a request tenant. Recheck revocation at
the authoritative boundary, including after asynchronous reads as applicable.

The graph-reference receipt proves only an exact active anchor in a consistent
committed graph. Any action must separately satisfy owning approval, loadout,
lease/CAS and dispatch contracts. Multiple nodes may refer to one WorkObject;
carry the exact node ID and expected graph digest/version. ISC-277 requires
paired integration proof and cannot be closed by a cached receipt.

## Following slices and acceptance

After the mapping contract, [P7-ACTOR #161](https://github.com/Sheshiyer/plexus-ts/issues/161)
binds Access actor/workspace to bridge tenant/member and enforces logout,
revocation and account-switch recovery. App permission/selected-repository and
D1 checks retain [#162](https://github.com/Sheshiyer/plexus-ts/issues/162) and
[#163](https://github.com/Sheshiyer/plexus-ts/issues/163) as explicit dependencies.
Authenticated deployed/installed receipts must pin all service and app revisions.

Source candidates require main integration before deployed acceptance. Existing
`repo-verify-retry.test.ts` assertions also need a bounded persistence-coverage
repair; they fail against unchanged pre-P7 source. Do not report all tests green.
No new package, issue or duplicate criterion is needed for these remaining steps.
