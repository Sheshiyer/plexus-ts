# Architecture asset maintenance

Reviewed 2026-09-05. This marker records generator ownership and remaining
visual assets; it is not a release-readiness result.

| Asset | September status | Owner |
| --- | --- | --- |
| `SERVICES.md` | Manually reconciled against runtime and migration source | Host hook can overwrite it; review generic scanner output against `RUNTIME_MAP.md` |
| `DEPENDENCY-GRAPH.md` | Regenerated with the owning scanner; static import counts only | `DependencyGraphScanner.ts`, invoked independently of the hook |
| `RUNTIME_MAP.md` | Authored service/data/authority map | Repository documentation maintainers |
| `HERMES_REPORTING_CONTRACT.md` | Current product authority with explicit delivery limits | Repository documentation maintainers |
| `architecture.html` | Not present in this checkout | Optional rendered visual; no completion claim |
| `notebooklm-prompt.md` | Not present in this checkout | Optional derived research artifact; no completion claim |

The host `~/.codex/hooks/ArchitectureAssetsSync.hook.ts` owns the deterministic
scanner invocation. It also modifies the master plan and host observability,
so do not invoke the full hook merely to refresh these docs during an isolated
pass. The source-owned dependency scanner can be run directly:

```bash
bun ~/.codex/PAI/Tools/DependencyGraphScanner.ts "$PWD"
```

Review its output before replacing `DEPENDENCY-GRAPH.md`; restore the source
scope and evidence limitations in that document. Its regex scan does not
resolve TypeScript symbols, dynamic imports, runtime dependencies or service
health. Generic service detection is incomplete for this desktop/sibling-Worker
layout. Preserve authored operating contracts when a release hook rewrites a
file. Do not delete this marker solely because a scan finished.

The July marker was triggered by a read-only tag-list command, not proof that a
release or architecture review completed. September refreshed the two existing
inventories without creating a tag, publishing assets or running the hook.
