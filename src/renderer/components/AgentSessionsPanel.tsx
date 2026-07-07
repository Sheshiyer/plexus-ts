import React, { useEffect, useMemo, useState } from 'react';
import type { AgentSessionCandidate, AgentSessionScanResult, Project } from '../../shared/types';
import { PageHeader, Button, fmtHM } from './ui';
import { IconBridge, IconCheck, IconClose, IconProjects, IconSync } from './Icons';
import {
  CommandDock,
  DegradedStatePanel,
  EmptyStatePanel,
  InstrumentPanel,
  Ledger,
  LedgerRail,
  MetricRail,
  MetricRailGroup,
  StatusChip,
  middleTruncate,
  type PlexusTone,
} from './PlexusUI';

interface Props {
  projects: Project[];
  onEntriesChange: () => void | Promise<void>;
  onOpenProjects?: () => void;
}

const PAGE_SIZE = 12;

export default function AgentSessionsPanel({ projects, onEntriesChange, onOpenProjects }: Props) {
  const [result, setResult] = useState<AgentSessionScanResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const loadStatus = async () => {
    const status = await window.plexus.agentSessionStatus();
    setResult(status);
  };

  useEffect(() => {
    loadStatus().catch((err: any) => setError(err?.message ?? String(err)));
  }, []);

  const scan = async () => {
    if (busy) return;
    setBusy('scan');
    setError('');
    setMessage('Scanning local agents...');
    try {
      const next = await window.plexus.agentSessionScan();
      setResult(next);
      setMessage(next.message ?? `Scanned ${next.scanned} session file${next.scanned === 1 ? '' : 's'}`);
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setBusy(null);
    }
  };

  const setConsent = async (enabled: boolean) => {
    if (busy) return;
    setBusy('consent');
    setError('');
    try {
      await window.plexus.agentSessionSetConsent(enabled);
      if (enabled) {
        const next = await window.plexus.agentSessionScan();
        setResult(next);
        setMessage(next.message ?? `Scanned ${next.scanned} session file${next.scanned === 1 ? '' : 's'}`);
      } else {
        await loadStatus();
        setMessage('Clio memory scanner disabled.');
      }
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
      setMessage("Clio memory added to today's work records.");
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
      setMessage('Clio memory suggestion dismissed.');
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setBusy(null);
    }
  };

  const candidates = useMemo(() => result?.candidates ?? [], [result?.candidates]);
  const knownRoots = result?.roots.filter((root) => root.exists).length ?? 0;
  const verifiedProjectIds = useMemo(
    () => new Set(projects.filter(projectReady).map((project) => project.id)),
    [projects],
  );
  const totalPages = Math.max(1, Math.ceil(candidates.length / PAGE_SIZE));
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageCandidates = useMemo(
    () => candidates.slice(pageStart, pageStart + PAGE_SIZE),
    [candidates, pageStart],
  );
  const groupedPageCandidates = useMemo(() => {
    const groups: {
      key: 'ready' | 'linking' | 'low_confidence';
      label: string;
      tone: PlexusTone;
      items: Array<{ candidate: AgentSessionCandidate; ready: boolean }>;
    }[] = [
      { key: 'ready', label: 'Ready to accept', tone: 'accent', items: [] },
      { key: 'linking', label: 'Needs repo linking', tone: 'warning', items: [] },
      { key: 'low_confidence', label: 'Low confidence', tone: 'idle', items: [] },
    ];

    for (const candidate of pageCandidates) {
      const ready = candidateReady(candidate, verifiedProjectIds);
      if (ready) {
        groups[0].items.push({ candidate, ready });
        continue;
      }
      if (candidate.matchStatus === 'low_confidence') {
        groups[2].items.push({ candidate, ready });
        continue;
      }
      groups[1].items.push({ candidate, ready });
    }

    return groups.filter((group) => group.items.length > 0);
  }, [pageCandidates, verifiedProjectIds]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  useEffect(() => {
    setCollapsedGroups((current) => {
      const next: Record<string, boolean> = {};
      for (const group of groupedPageCandidates) {
        next[group.key] = current[group.key] ?? false;
      }
      return next;
    });
  }, [groupedPageCandidates]);

  return (
    <div className="px-fadein">
      <PageHeader
        title="Clio Memories"
        sub="local agent context"
        right={
          <CommandDock>
            {message && <StatusChip tone="idle">{message}</StatusChip>}
            {result?.enabled ? (
              <>
                <Button variant="ghost" onClick={scan} disabled={busy !== null}><IconSync s={14} /> {busy === 'scan' ? 'Scanning' : 'Scan Now'}</Button>
                <Button variant="ghost" onClick={() => setConsent(false)} disabled={busy !== null}>Disable</Button>
              </>
            ) : (
              <Button onClick={() => setConsent(true)} disabled={busy !== null}><IconBridge s={14} /> Enable Local Scan</Button>
            )}
          </CommandDock>
        }
      />

      {error && <DegradedStatePanel title="Clio memory capture needs attention" message={error} tone="error" />}

      <MetricRailGroup>
        <MetricRail label="scanner" value={result?.enabled ? 'on' : 'off'} tone={result?.enabled ? 'accent' : 'idle'} hint="local consent" />
        <MetricRail label="sources" value={knownRoots} tone={knownRoots ? 'mint' : 'idle'} hint="agent roots" />
        <MetricRail label="pending" value={result?.totalPending ?? candidates.length} tone={(result?.totalPending ?? candidates.length) ? 'warning' : 'idle'} hint="total queue" />
        <MetricRail label="ready" value={result?.readyPending ?? 0} tone={(result?.readyPending ?? 0) ? 'accent' : 'idle'} hint={`${result?.matchedPending ?? 0} matched`} />
      </MetricRailGroup>

      {!result ? (
        <InstrumentPanel
          label="scanner status"
          title="Checking Clio memory pickup"
          note="Plexus is reading local consent and queued agent-memory suggestions."
          trace
        >
          <EmptyStatePanel
            icon={<IconBridge s={26} />}
            title="Loading Clio memory queue"
            message="The review queue will appear here once local memory status is available."
          />
        </InstrumentPanel>
      ) : !result.enabled ? (
        <InstrumentPanel
          label="permission"
          title="Local agent memory capture"
          note="Codex, Claude, Cursor, and OpenCode are scanned locally after consent; prompt text stays out of the ledger. Turning this off only stops new scans."
          trace
        >
          <EmptyStatePanel
            icon={<IconBridge s={26} />}
            title="Scanner is off"
            message={candidates.length > 0 ? `${result.totalPending} cached suggestions remain available below.` : 'Enable it to suggest recent local agent work as reviewable time records.'}
            action={<Button onClick={() => setConsent(true)} disabled={busy !== null}>Enable Local Scan</Button>}
          />
        </InstrumentPanel>
      ) : null}

      {result && (result.enabled || candidates.length > 0) && (
        <InstrumentPanel
          label="review queue"
          title="Suggested Clio memory records"
          note="Accepting a suggestion creates a normal repo-backed work record. Unmatched sessions stay here until the project resolver has a verified repo."
          actions={<StatusChip tone={(result?.readyPending ?? 0) ? 'accent' : candidates.length ? 'warning' : 'accent'}>{(result?.readyPending ?? 0) ? `${result?.readyPending} ready` : candidates.length ? `${result?.totalPending ?? candidates.length} pending` : 'clear'}</StatusChip>}
          trace
        >
          {candidates.length === 0 ? (
            <EmptyStatePanel
              icon={knownRoots === 0 ? <IconBridge s={26} /> : <IconCheck s={26} />}
              title={knownRoots === 0 ? 'No local agent sources found' : 'No pending Clio memories'}
              message={knownRoots === 0 ? 'Plexus looked for Codex, Claude, Cursor, and OpenCode session folders on this device.' : 'Run a scan after a CLI session or when a new project resolver is added.'}
              action={<Button variant="ghost" onClick={scan} disabled={busy !== null}><IconSync s={14} /> Scan Now</Button>}
            />
          ) : (
            <>
              <div style={{ marginBottom: 10 }}>
                <CommandDock align="start">
                <StatusChip tone="idle">
                  Showing {pageStart + 1}-{Math.min(pageStart + PAGE_SIZE, candidates.length)} of {candidates.length}
                </StatusChip>
                <StatusChip tone="idle">Page {page} / {totalPages}</StatusChip>
                <Button variant="ghost" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || busy !== null}>
                  Prev
                </Button>
                <Button variant="ghost" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages || busy !== null}>
                  Next
                </Button>
                </CommandDock>
              </div>

              {groupedPageCandidates.map((group) => (
                <InstrumentPanel
                  key={group.key}
                  label="session group"
                  title={group.label}
                  actions={
                    <CommandDock compact>
                      <StatusChip tone={group.tone}>{group.items.length}</StatusChip>
                      <Button
                        variant="ghost"
                        onClick={() => setCollapsedGroups((current) => ({ ...current, [group.key]: !current[group.key] }))}
                        disabled={busy !== null}
                      >
                        {collapsedGroups[group.key] ? 'Expand' : 'Collapse'}
                      </Button>
                    </CommandDock>
                  }
                >
                  {!collapsedGroups[group.key] && (
                    <Ledger>
                      {group.items.map(({ candidate, ready }, index) => (
                        <LedgerRail
                          key={candidate.id}
                          index={String(index + 1).padStart(2, '0')}
                          marker={<span className="px-swatch" style={{ background: ready ? 'var(--accent)' : 'var(--t3)' }} />}
                          title={candidate.title}
                          meta={`${candidate.projectName ?? candidate.repoFullName ?? statusLabel(candidate)} - ${formatCandidateDuration(candidate)} - ${middleTruncate(candidate.sourceLabel, 62)}${candidate.confidenceReasons[0] ? ` - ${candidate.confidenceReasons[0]}` : ''}`}
                          status={statusLabel(candidate)}
                          statusTone={candidateTone(candidate, ready)}
                          value={`${candidate.confidence}%`}
                          action={(
                            <CommandDock compact>
                              {ready ? (
                                <Button onClick={() => accept(candidate)} disabled={busy !== null}>
                                  <IconCheck s={12} /> {busy === candidate.id ? 'Adding' : 'Accept'}
                                </Button>
                              ) : (
                                <Button variant="ghost" onClick={onOpenProjects} disabled={!onOpenProjects}>
                                  <IconProjects s={12} /> Link
                                </Button>
                              )}
                              <Button variant="ghost" onClick={() => dismiss(candidate)} disabled={busy !== null}>
                                <IconClose s={12} /> Dismiss
                              </Button>
                            </CommandDock>
                          )}
                        />
                      ))}
                    </Ledger>
                  )}
                </InstrumentPanel>
              ))}
            </>
          )}
        </InstrumentPanel>
      )}
    </div>
  );
}

function formatCandidateDuration(candidate: AgentSessionCandidate): string {
  const start = new Date(candidate.startedAt).getTime();
  const end = new Date(candidate.endedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return '15m';
  return fmtHM(Math.max(900, Math.floor((end - start) / 1000)));
}

function candidateTone(candidate: AgentSessionCandidate, ready: boolean): PlexusTone {
  if (ready) return 'accent';
  if (candidate.matchStatus === 'low_confidence') return 'idle';
  if (candidate.matchStatus === 'repo_unverified' || candidate.matchStatus === 'needs_project') return 'warning';
  return 'idle';
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

function projectReady(project: Project): boolean {
  if (project.repoRequired === false) return true;
  return Boolean(
    project.githubRepoUrl &&
    project.githubRepoFullName &&
    project.repoVerifiedAt &&
    project.repoEvidenceStatus !== 'inaccessible',
  );
}
