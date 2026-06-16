import React, { useState, useEffect, useCallback } from 'react';
import TimeChart, { CHART_SERIES } from './TimeChart';
import type { Project, MemberKpiSummary } from '../../shared/types';
import { PageHeader, Panel, Button, Input, Toggle, Skeleton, EmptyState, SectionLabel, StatCard, fmtHM } from './ui';
import { IconReports, IconSync } from './Icons';

interface Props { projects: Project[]; }
type Mode = 'daily' | 'weekly' | 'monthly';

export default function Reports({ projects }: Props) {
  const [mode, setMode] = useState<Mode>('weekly');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [kpi, setKpi] = useState<MemberKpiSummary | null>(null);

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
        r = await window.plexus.reportWeekly(monday.toISOString().slice(0, 10));
      } else {
        r = await window.plexus.reportMonthly(date.slice(0, 7));
      }
      setReport(r);
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
  const denom = report ? Math.max(1, typeof dayCount === 'number' ? dayCount : 1) : 1;

  const kpiTodayH = kpi ? Math.floor(kpi.todaySeconds / 3600) : 0;
  const kpiTodayM = kpi ? Math.floor((kpi.todaySeconds % 3600) / 60) : 0;
  const kpiWeekH = kpi ? Math.floor(kpi.weekSeconds / 3600) : 0;
  const kpiWeekM = kpi ? Math.floor((kpi.weekSeconds % 3600) / 60) : 0;

  return (
    <div className="px-fadein">
      <PageHeader
        title="Reports"
        sub={mode}
        right={
          <div className="px-report-toolbar">
            <Toggle<Mode> value={mode} onChange={setMode} options={[
              { key: 'daily', label: 'daily' }, { key: 'weekly', label: 'weekly' }, { key: 'monthly', label: 'monthly' },
            ]} />
            <Input
              type={mode === 'monthly' ? 'month' : 'date'}
              value={mode === 'monthly' ? date.slice(0, 7) : date}
              onChange={e => setDate(mode === 'monthly' ? e.target.value + '-01' : e.target.value)}
            />
            <Button onClick={load} disabled={loading}>
              <IconSync s={14} /> {loading ? 'Loading…' : 'Refresh'}
            </Button>
          </div>
        }
      />

      {/* KPI stats bar */}
      {kpi && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
          <StatCard label="today" value={`${kpiTodayH}h ${kpiTodayM}m`} accent={kpi.todaySeconds > 0} />
          <StatCard label="this week" value={`${kpiWeekH}h ${kpiWeekM}m`} accent={kpi.weekSeconds > 0} />
          <StatCard label="standup" value={kpi.standupCompliant ? 'compliant' : 'missing'} />
          <StatCard label="projects" value={Object.keys(kpi.projectBreakdown || {}).length} />
        </div>
      )}
      {kpiError && !kpi && (
        <div className="px-mono" style={{ fontSize: 11, color: 'var(--rose)', marginBottom: 18 }}>{kpiError}</div>
      )}

      {loading && <Panel pad><Skeleton lines={4} widths={['40%', '90%', '70%', '55%']} /></Panel>}

      {!loading && !report && (
        <EmptyState icon={<IconReports s={26} />}>
          No data for the selected range. Try a different date or press <span className="k">Refresh</span>.
        </EmptyState>
      )}

      {!loading && report && (
        <div className="px-report-results">
          <Panel raised pad crosshairs className="px-composed-panel">
            <div className="px-section-head">
              <div>
                <SectionLabel>summary</SectionLabel>
                <div className="px-section-note">Compiled from local tracked entries for the selected range.</div>
              </div>
            </div>
            <div className="px-specs">
              <div className="px-spec acc"><span className="l">total</span><span className="v">{fmtHM(report.totalSeconds)}</span></div>
              <div className="px-spec"><span className="l">entries</span><span className="v">{entryCount}</span></div>
              <div className="px-spec"><span className="l">projects</span><span className="v">{projectCount}</span></div>
              {mode !== 'daily' && (
                <div className="px-spec"><span className="l">avg / day</span><span className="v">{fmtHM(Math.round(report.totalSeconds / denom))}</span></div>
              )}
            </div>
          </Panel>

          {report.days && (
            <Panel raised pad crosshairs className="px-composed-panel">
              <div className="px-section-head">
                <div>
                  <SectionLabel>visual breakdown</SectionLabel>
                  <div className="px-section-note">Daily distribution for the selected {mode === 'weekly' ? 'week' : 'month'}.</div>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <TimeChart
                  data={report.days.map((d: any, i: number) => ({
                    label: new Date(d.date).toLocaleDateString(undefined, { weekday: 'narrow' }),
                    value: d.totalSeconds,
                    color: CHART_SERIES[i % CHART_SERIES.length],
                  }))}
                  maxValue={Math.max(...report.days.map((d: any) => d.totalSeconds), 28800)}
                />
              </div>
            </Panel>
          )}

          <div className="px-report-split">
            {report.projectBreakdown && Object.keys(report.projectBreakdown).length > 0 && (
            <Panel raised pad crosshairs className="px-composed-panel">
              <div className="px-section-head">
                <div>
                  <SectionLabel>project breakdown</SectionLabel>
                  <div className="px-section-note">Time share by project, sorted by highest allocation.</div>
                </div>
              </div>
              <div className="px-rows">
                {Object.entries(report.projectBreakdown as Record<string, number>)
                  .sort((a, b) => b[1] - a[1])
                  .map(([pid, seconds], i) => {
                    const pct = report.totalSeconds > 0 ? ((seconds / report.totalSeconds) * 100).toFixed(1) : '0.0';
                    return (
                      <div key={pid} className="px-row" style={{ gridTemplateColumns: '26px 11px 1fr 64px auto' }}>
                        <span className="idx">{String(i + 1).padStart(2, '0')}</span>
                        <span className="px-swatch" style={{ background: CHART_SERIES[i % CHART_SERIES.length] }} />
                        <span className="desc">{projectName(pid)}</span>
                        <span className="dur" style={{ color: 'var(--t3)' }}>{pct}%</span>
                        <span className="dur">{fmtHM(seconds)}</span>
                      </div>
                    );
                  })}
              </div>
            </Panel>
            )}

            {report.days && (
            <Panel raised pad crosshairs className="px-composed-panel">
              <div className="px-section-head">
                <div>
                  <SectionLabel>daily detail</SectionLabel>
                  <div className="px-section-note">A scan-friendly ledger for the same range.</div>
                </div>
              </div>
              <div className="px-rows">
                {report.days.map((d: any, i: number) => (
                  <div key={d.date} className="px-row" style={{ gridTemplateColumns: '26px 1fr auto' }}>
                    <span className="idx">{String(i + 1).padStart(2, '0')}</span>
                    <span className="desc">{new Date(d.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                    <span className="dur">{fmtHM(d.totalSeconds)}</span>
                  </div>
                ))}
              </div>
            </Panel>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
