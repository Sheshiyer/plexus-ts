import React, { useEffect, useMemo, useState } from 'react';
import type { AgentSessionCandidate, AgentSessionScanResult, AssistantContextScope, Project } from '../../shared/types';
import { hasVerifiedGitHubRepository } from '../../shared/github-repository-authority';
import { Button, fmtHM } from './ui';
import { IconBridge, IconCheck, IconClose, IconSync } from './Icons';
import {
  CommandDock,
  EmptyStatePanel,
  InstrumentPanel,
  Ledger,
  LedgerRail,
  StatusChip,
  middleTruncate,
  type PlexusTone,
} from './PlexusUI';

interface Props {
  projects: Project[];
  onEntriesChange: () => void | Promise<void>;
  onOpenQueue?: () => void;
  onOpenProjects?: () => void;
  onOpenAssistant?: (intent: { message: string; contextScopes: AssistantContextScope[]; metadata?: Record<string, unknown> }) => void;
}

export default function AgentSessionFocusRail({ projects, onEntriesChange, onOpenQueue, onOpenProjects, onOpenAssistant }: Props) {
  const [result, setResult] = useState<AgentSessionScanResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const verifiedProjectIds = useMemo(
    () => new Set(projects.filter(projectReady).map((project) => project.id)),
    [projects],
  );
  const visible = useMemo(
    () => sortCandidatesForAction(result?.candidates ?? [], verifiedProjectIds).slice(0, 3),
    [result?.candidates, verifiedProjectIds],
  );
  const availableSources = result?.roots.filter((root) => root.exists).length ?? 0;

  const loadStatus = async () => {
    const next = await window.plexus.agentSessionStatus();
    setResult(next);
  };

  useEffect(() => {
    loadStatus().catch((err: any) => setError(err?.message ?? String(err)));
  }, []);

  const scan = async () => {
    if (busy) return;
    setBusy('scan');
    setError('');
    try {
      const next = await window.plexus.agentSessionScan();
      setResult(next);
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setBusy(null);
    }
  };

  const accept = async (candidate: AgentSessionCandidate) => {
    if (busy) return;
    setBusy(candidate.id);
    setError('');
    try {
      await window.plexus.agentSessionAccept(candidate.id);
      await onEntriesChange();
      await loadStatus();
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setBusy(null);
    }
  };

  const dismiss = async (candidate: AgentSessionCandidate) => {
    if (busy) return;
    setBusy(candidate.id);
    setError('');
    try {
      await window.plexus.agentSessionDismiss(candidate.id);
      await loadStatus();
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setBusy(null);
    }
  };

  const enableScan = async () => {
    if (busy) return;
    setBusy('enable');
    setError('');
    try {
      await window.plexus.agentSessionSetConsent(true);
      const next = await window.plexus.agentSessionScan();
      setResult(next);
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <InstrumentPanel
      label="agent session pickup"
      title="Local CLI work suggestions"
      note={error || (result?.enabled
        ? 'Recent Codex, Claude, Cursor, and OpenCode sessions that can become verified work records.'
        : 'Enable local metadata pickup to recover CLI work when the timer was not started.')}
      actions={(
        <CommandDock compact>
          <StatusChip tone={error ? 'error' : (result?.readyPending ?? 0) > 0 ? 'accent' : 'idle'}>
            {!result ? 'checking' : result.enabled ? ((result.readyPending ?? 0) > 0 ? `${result.readyPending} ready` : `${result.totalPending ?? 0} pending`) : 'off'}
          </StatusChip>
          {result?.enabled ? (
            <Button variant="ghost" onClick={scan} disabled={busy !== null}>
              <IconSync s={12} /> {busy === 'scan' ? 'Scanning' : 'Scan'}
            </Button>
          ) : (
            <Button variant="ghost" onClick={enableScan} disabled={busy !== null}>
              <IconBridge s={12} /> {busy === 'enable' ? 'Enabling' : 'Enable'}
            </Button>
          )}
          {onOpenAssistant && (result?.totalPending ?? 0) > 0 && (
            <Button
              variant="ghost"
              onClick={() => onOpenAssistant({
                contextScopes: ['session_group', 'project', 'task', 'today', 'app'],
                message: 'Group recent local agent sessions into reviewable work clusters and call out anything that needs project or repo matching.',
                metadata: {
                  totalPending: result?.totalPending ?? 0,
                  readyPending: result?.readyPending ?? 0,
                  visibleCandidateIds: visible.map((candidate) => candidate.id),
                },
              })}
            >
              <IconBridge s={12} /> Group sessions
            </Button>
          )}
          {onOpenQueue && <Button variant="ghost" onClick={onOpenQueue}>Queue</Button>}
        </CommandDock>
      )}
      trace
    >
      {!result ? (
        <EmptyStatePanel
          icon={<IconBridge s={24} />}
          title="Checking local agent pickup"
          message="Plexus is reading scanner consent and local source availability."
        />
      ) : !result.enabled ? (
        <EmptyStatePanel
          icon={<IconBridge s={24} />}
          title="Agent pickup is off"
          message="Turn it on to suggest local CLI sessions as reviewable work records."
          action={<Button onClick={enableScan} disabled={busy !== null}><IconBridge s={14} /> Enable Local Scan</Button>}
        />
      ) : availableSources === 0 ? (
        <EmptyStatePanel
          icon={<IconBridge s={24} />}
          title="No local agent sources found"
          message="Plexus looked for Codex, Claude, Cursor, and OpenCode session folders on this device."
          action={<Button variant="ghost" onClick={scan} disabled={busy !== null}><IconSync s={14} /> Re-check</Button>}
        />
      ) : visible.length === 0 ? (
        <EmptyStatePanel
          icon={<IconBridge s={24} />}
          title="No pending agent sessions"
          message="Run a scan after CLI work to pull local metadata into the review queue."
          action={<Button variant="ghost" onClick={scan} disabled={busy !== null}><IconSync s={14} /> Scan</Button>}
        />
      ) : (
        <Ledger>
          {visible.map((candidate, index) => {
            const ready = candidateReady(candidate, verifiedProjectIds);
            return (
              <LedgerRail
                key={candidate.id}
                index={String(index + 1).padStart(2, '0')}
                marker={<span className="px-swatch" style={{ background: ready ? 'var(--accent)' : 'var(--t3)' }} />}
                title={candidate.title}
                meta={`${candidate.projectName ?? candidate.repoFullName ?? statusLabel(candidate)} - ${formatDuration(candidate)} - ${middleTruncate(candidate.sourceLabel, 52)}`}
                status={statusLabel(candidate)}
                statusTone={statusTone(candidate, ready)}
                action={(
                  <CommandDock compact>
                    {ready ? (
                      <Button onClick={() => accept(candidate)} disabled={busy !== null}>
                        <IconCheck s={12} /> Accept
                      </Button>
                    ) : (
                      <Button variant="ghost" onClick={onOpenProjects ?? onOpenQueue} disabled={busy !== null || (!onOpenProjects && !onOpenQueue)}>
                        <IconBridge s={12} /> {candidate.matchStatus === 'repo_unverified' ? 'Verify' : 'Resolve'}
                      </Button>
                    )}
                    <Button variant="ghost" onClick={() => dismiss(candidate)} disabled={busy !== null}>
                      <IconClose s={12} /> Dismiss
                    </Button>
                  </CommandDock>
                )}
              />
            );
          })}
        </Ledger>
      )}
    </InstrumentPanel>
  );
}

function formatDuration(candidate: AgentSessionCandidate): string {
  const start = new Date(candidate.startedAt).getTime();
  const end = new Date(candidate.endedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return '15m';
  return fmtHM(Math.max(900, Math.floor((end - start) / 1000)));
}

function sortCandidatesForAction(candidates: AgentSessionCandidate[], verifiedProjectIds: Set<string>): AgentSessionCandidate[] {
  const score = (candidate: AgentSessionCandidate) => {
    if (candidateReady(candidate, verifiedProjectIds)) return 0;
    if (candidate.matchStatus === 'repo_unverified') return 1;
    if (candidate.matchStatus === 'needs_project') return 2;
    return 3;
  };
  return [...candidates].sort((a, b) => score(a) - score(b) || new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime());
}

function candidateReady(candidate: AgentSessionCandidate, verifiedProjectIds: Set<string>): boolean {
  return candidate.matchStatus === 'ready' || Boolean(candidate.projectId && verifiedProjectIds.has(candidate.projectId));
}

function statusLabel(candidate: AgentSessionCandidate): string {
  if (candidate.matchStatus === 'ready') return 'ready';
  if (candidate.matchStatus === 'repo_unverified') return 'verify repo';
  if (candidate.matchStatus === 'low_confidence') return 'low confidence';
  return 'needs project';
}

function statusTone(candidate: AgentSessionCandidate, ready: boolean): PlexusTone {
  if (ready) return 'accent';
  if (candidate.matchStatus === 'low_confidence') return 'idle';
  return 'warning';
}

function projectReady(project: Project): boolean {
  return hasVerifiedGitHubRepository(project);
}
