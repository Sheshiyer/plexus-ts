import React, { useState } from 'react';
import TimeChart, { CHART_SERIES } from './TimeChart';
import type { Project } from '../../shared/types';
import { PageHeader, Panel, Button, Input, Toggle, Skeleton, EmptyState, SectionLabel, fmtHM } from './ui';
import { IconReports } from './Icons';

interface Props { projects: Project[]; }
type Mode = 'daily' | 'weekly' | 'monthly';

export default function Reports({ projects }: Props) {
  const [mode, setMode] = useState<Mode>('weekly');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      if (mode === 'daily') {
        setReport(await window.plexus.reportDaily(date));
      } else if (mode === 'weekly') {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        setReport(await window.plexus.reportWeekly(monday.toISOString().slice(0, 10)));
      } else {
        setReport(await window.plexus.reportMonthly(date.slice(0, 7)));
      }
    } finally {
      setLoading(false);
    }
  };

  const projectName = (id: string) => projects.find(p => p.id === id)?.name || id.slice(0, 8);
  const span = report ? (report.entryCount ?? report.days?.length ?? '—') : '—';
  const denom = report ? Math.max(1, report.days?.length ?? report.entryCount ?? 1) : 1;

  return (
    <div className="px-fadein">
      <PageHeader
        title="Reports"
        sub={mode}
        right={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Toggle<Mode> value={mode} onChange={setMode} options={[
              { key: 'daily', label: 'daily' }, { key: 'weekly', label: 'weekly' }, { key: 'monthly', label: 'monthly' },
            ]} />
            <Input
              type={mode === 'monthly' ? 'month' : 'date'}
              value={mode === 'monthly' ? date.slice(0, 7) : date}
              onChange={e => setDate(mode === 'monthly' ? e.target.value + '-01' : e.target.value)}
              style={{ width: 'auto' }}
            />
            <Button onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Generate'}</Button>
          </div>
        }
      />

      {loading && <Panel pad><Skeleton lines={4} widths={['40%', '90%', '70%', '55%']} /></Panel>}

      {!loading && !report && (
        <EmptyState icon={<IconReports s={26} />}>
          Select a range and press <span className="k">Generate</span> to compile a report.
        </EmptyState>
      )}

      {!loading && report && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
          <div className="px-specs" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="px-spec acc"><span className="l">total</span><span className="v">{fmtHM(report.totalSeconds)}</span></div>
            <div className="px-spec"><span className="l">{report.entryCount != null ? 'entries' : 'days'}</span><span className="v">{span}</span></div>
            <div className="px-spec"><span className="l">{report.days ? 'avg / day' : 'avg / entry'}</span><span className="v">{fmtHM(Math.round(report.totalSeconds / denom))}</span></div>
          </div>

          {report.days && (
            <Panel pad crosshairs>
              <SectionLabel style={{ marginBottom: 6 }}>visual breakdown</SectionLabel>
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

          {report.projectBreakdown && Object.keys(report.projectBreakdown).length > 0 && (
            <div>
              <SectionLabel style={{ marginBottom: 8 }}>project breakdown</SectionLabel>
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
            </div>
          )}

          {report.days && (
            <div>
              <SectionLabel style={{ marginBottom: 8 }}>daily detail</SectionLabel>
              <div className="px-rows">
                {report.days.map((d: any, i: number) => (
                  <div key={d.date} className="px-row" style={{ gridTemplateColumns: '26px 1fr auto' }}>
                    <span className="idx">{String(i + 1).padStart(2, '0')}</span>
                    <span className="desc">{new Date(d.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                    <span className="dur">{fmtHM(d.totalSeconds)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
