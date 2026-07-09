import React, { useState, useEffect, useCallback } from 'react';
import TimeChart, { chartSeries } from './TimeChart';
import type { AssistantContextScope, Project, MemberKpiSummary } from '../../shared/types';
import { PageHeader, Button, Input, Toggle, Skeleton, fmtHM, localDateString } from './ui';
import { IconBridge, IconReports, IconSync } from './Icons';
import {
  CommandDock,
  DegradedStatePanel,
  EmptyStatePanel,
  InstrumentPanel,
  Ledger,
  LedgerRail,
  MetricRail,
  MetricRailGroup,
} from './PlexusUI';

interface Props { projects: Project[]; }
type Mode = 'daily' | 'weekly' | 'monthly';

function openAssistantIntent(input: {
  sourceRoute: 'reports';
  message: string;
  contextScopes: AssistantContextScope[];
  metadata?: Record<string, unknown>;
}) {
  const detail = {
    routeKey: 'assistant',
    createdAt: new Date().toISOString(),
    ...input,
  };
  try {
    window.sessionStorage.setItem('plexus:assistant-launch-intent', JSON.stringify(detail));
  } catch {
    // Ignore storage failures; the navigation event still carries the intent.
  }
  window.dispatchEvent(new CustomEvent('plexus:assistant-navigate', { detail }));
}

export default function Reports({ projects }: Props) {
  const [mode, setMode] = useState<Mode>('weekly');
  const [date, setDate] = useState(() => localDateString());
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [kpi, setKpi] = useState<MemberKpiSummary | null>(null);
  const [kpiLoadedAt, setKpiLoadedAt] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportLoadedAt, setReportLoadedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let r: any;
      if (mode === 'daily') {
        r = await window.plexus.reportDaily(date);
      } else if (mode === 'weekly') {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        r = await window.plexus.reportWeekly(localDateString(monday));
      } else {
        r = await window.plexus.reportMonthly(date.slice(0, 7));
      }
      setReport(r);
      setReportLoadedAt(new Date().toISOString());
      setReportError(null);
    } catch (e: any) {
      setReportError(e?.message ?? 'Could not load local report.');
    } finally {
      setLoading(false);
    }
  }, [mode, date]);

  useEffect(() => { load(); }, [load]);

  const [kpiError, setKpiError] = useState<string | null>(null);
  // Re-fetch KPI on an interval and surface failures so the panel never sits
  // on a stale or blank value when the Worker is briefly unreachable.
  const loadKpi = useCallback(async () => {
    try {
      setKpi(await window.plexus.memberKpi());
      setKpiLoadedAt(new Date().toISOString());
      setKpiError(null);
    } catch (e: any) {
      setKpiError(e?.message ?? 'Could not load KPI.');
    }
  }, []);

  useEffect(() => {
    loadKpi();
    const id = setInterval(loadKpi, 15000);
    return () => clearInterval(id);
  }, [loadKpi]);

  const projectName = (id: string) => projects.find(p => p.id === id)?.name || id.slice(0, 8);
  const entryCount = report?.entryCount ?? report?.entries?.length ?? '—';
  const dayCount = report?.days?.length ?? report?.weeks?.reduce((s: number, w: any) => s + (w.days?.length ?? 0), 0) ?? '—';
  const projectCount = report?.projectBreakdown ? Object.keys(report.projectBreakdown).length : 0;
  const evidence = report?.evidenceSummary;
  const denom = report ? Math.max(1, typeof dayCount === 'number' ? dayCount : 1) : 1;

  // Defense-in-depth: undefined seconds must degrade to 0, never NaN.
  const kpiTodayH = Math.floor((kpi?.todaySeconds ?? 0) / 3600);
  const kpiTodayM = Math.floor(((kpi?.todaySeconds ?? 0) % 3600) / 60);
  const kpiWeekH = Math.floor((kpi?.weekSeconds ?? 0) / 3600);
  const kpiWeekM = Math.floor(((kpi?.weekSeconds ?? 0) % 3600) / 60);
  const series = chartSeries();
  const prepareDailyUpdate = () => openAssistantIntent({
    sourceRoute: 'reports',
    contextScopes: ['today', 'week', 'project', 'task', 'session_group', 'infra', 'app'],
    message: `Prepare a daily update for ${date} using the current ${mode} report, proof state, and local session context.`,
    metadata: {
      mode,
      date,
      reportLoadedAt,
      entryCount,
      projectCount,
      totalSeconds: report?.totalSeconds ?? 0,
      missingEvidenceEntries: evidence?.missingEvidenceEntries ?? null,
    },
  });
  const explainMissingProof = () => openAssistantIntent({
    sourceRoute: 'reports',
    contextScopes: ['today', 'week', 'project', 'task', 'infra', 'app'],
    message: `Explain missing proof for the ${mode} report around ${date}; focus on unmatched entries, legacy records, and likely next actions.`,
    metadata: {
      mode,
      date,
      missingEvidenceEntries: evidence?.missingEvidenceEntries ?? null,
      missingEvidenceSeconds: evidence?.missingEvidenceSeconds ?? null,
      legacyUnverifiedEntries: evidence?.legacyUnverifiedEntries ?? null,
    },
  });

  return (
    <div className="px-fadein">
      <PageHeader
        title="Reports"
        sub={mode}
        right={
          <CommandDock>
            <Toggle<Mode> value={mode} onChange={setMode} options={[
              { key: 'daily', label: 'daily' }, { key: 'weekly', label: 'weekly' }, { key: 'monthly', label: 'monthly' },
            ]} />
            <Input
              type={mode === 'monthly' ? 'month' : 'date'}
              value={mode === 'monthly' ? date.slice(0, 7) : date}
              onChange={e => setDate(mode === 'monthly' ? e.target.value + '-01' : e.target.value)}
            />
            <Button onClick={load} disabled={loading}>
              <IconSync s={14} /> {loading ? 'Loading...' : 'Refresh'}
            </Button>
            <Button variant="ghost" onClick={prepareDailyUpdate}>
              <IconBridge s={13} /> Prepare daily update
            </Button>
            <Button variant="ghost" onClick={explainMissingProof}>
              <IconReports s={13} /> Explain missing proof
            </Button>
          </CommandDock>
        }
      />

      {reportError && (
        <DegradedStatePanel
          title="Report refresh failed"
          message={reportError}
          tone="error"
          lastGoodAt={reportLoadedAt}
          onRetry={load}
          busy={loading}
        />
      )}

      {/* KPI stats bar */}
      {kpi && (
        <MetricRailGroup>
          <MetricRail label="today" value={`${kpiTodayH}h ${kpiTodayM}m`} tone={kpi.todaySeconds > 0 ? 'accent' : 'idle'} hint="tracked" />
          <MetricRail label="this week" value={`${kpiWeekH}h ${kpiWeekM}m`} tone={kpi.weekSeconds > 0 ? 'accent' : 'idle'} hint="tracked" />
          <MetricRail label="standup proof" value={kpi.standupCompliant ? 'ready' : 'missing'} tone={kpi.standupCompliant ? 'accent' : 'warning'} hint="daily state" />
          <MetricRail label="projects" value={Object.keys(kpi.projectBreakdown || {}).length} tone="mint" hint="active" />
        </MetricRailGroup>
      )}
      {kpiError && (
        <DegradedStatePanel
          title="KPI refresh failed"
          message={kpiError}
          tone="warning"
          lastGoodAt={kpiLoadedAt}
          onRetry={loadKpi}
        />
      )}

      {loading && (
        <InstrumentPanel label="loading report" title="Reading local work ledger">
          <Skeleton lines={4} widths={['40%', '90%', '70%', '55%']} />
        </InstrumentPanel>
      )}

      {!loading && !report && (
        <EmptyStatePanel
          icon={<IconReports s={26} />}
          title="No data for the selected range"
          message="Try a different date window or refresh the local report cache."
          action={<Button variant="ghost" onClick={load}><IconSync s={14} /> Refresh</Button>}
        />
      )}

      {!loading && report && (
        <div className="px-report-results">
          <InstrumentPanel
            label="summary"
            title="Local work report"
            note="Compiled from local tracked entries for the selected range."
            trace
          >
            <MetricRailGroup>
              <MetricRail label="total" value={fmtHM(report.totalSeconds)} tone="accent" hint={mode} />
              <MetricRail label="entries" value={entryCount} tone="mint" hint="records" />
              <MetricRail label="projects" value={projectCount} tone="mint" hint="covered" />
              <MetricRail label="evidenced" value={evidence ? fmtHM(evidence.evidencedSeconds) : 'none'} tone={evidence?.evidencedSeconds ? 'accent' : 'idle'} hint="repo proof" />
              <MetricRail label="missing proof" value={evidence ? fmtHM(evidence.missingEvidenceSeconds) : 'none'} tone={evidence?.missingEvidenceSeconds ? 'warning' : 'idle'} hint="needs review" />
              <MetricRail label="legacy" value={evidence?.legacyUnverifiedEntries ?? 'none'} tone={evidence?.legacyUnverifiedEntries ? 'warning' : 'idle'} hint="unverified" />
              {mode !== 'daily' && (
                <MetricRail label="avg / day" value={fmtHM(Math.round(report.totalSeconds / denom))} tone="idle" hint="range average" />
              )}
            </MetricRailGroup>
          </InstrumentPanel>

          {report.days && (
            <InstrumentPanel
              label="visual breakdown"
              title={`Daily distribution for the selected ${mode === 'weekly' ? 'week' : 'month'}`}
              note="The chart keeps the same scale across the range so quiet days remain visible."
            >
              <div style={{ overflowX: 'auto' }}>
                <TimeChart
                  data={report.days.map((d: any, i: number) => ({
                    label: new Date(d.date).toLocaleDateString(undefined, { weekday: 'narrow' }),
                    value: d.totalSeconds,
                    color: series[i % series.length],
                  }))}
                  maxValue={Math.max(...report.days.map((d: any) => d.totalSeconds), 28800)}
                />
              </div>
            </InstrumentPanel>
          )}

          <div className="px-report-split">
            {report.projectBreakdown && Object.keys(report.projectBreakdown).length > 0 && (
            <InstrumentPanel
              label="project breakdown"
              title="Work share by project"
              note="Sorted by highest allocation."
            >
              <Ledger>
                {Object.entries(report.projectBreakdown as Record<string, number>)
                  .sort((a, b) => b[1] - a[1])
                  .map(([pid, seconds], i) => {
                    const pct = report.totalSeconds > 0 ? ((seconds / report.totalSeconds) * 100).toFixed(1) : '0.0';
                    return (
                      <LedgerRail
                        key={pid}
                        index={String(i + 1).padStart(2, '0')}
                        marker={<span className="px-swatch" style={{ background: series[i % series.length] }} />}
                        title={projectName(pid)}
                        status={`${pct}%`}
                        statusTone="idle"
                        value={fmtHM(seconds)}
                      />
                    );
                  })}
              </Ledger>
            </InstrumentPanel>
            )}

            {report.days && (
            <InstrumentPanel
              label="daily detail"
              title="Range ledger"
              note="A scan-friendly ledger for the same report range."
            >
              <Ledger>
                {report.days.map((d: any, i: number) => (
                  <LedgerRail
                    key={d.date}
                    index={String(i + 1).padStart(2, '0')}
                    title={new Date(d.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    meta={d.date}
                    value={fmtHM(d.totalSeconds)}
                  />
                ))}
              </Ledger>
            </InstrumentPanel>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
