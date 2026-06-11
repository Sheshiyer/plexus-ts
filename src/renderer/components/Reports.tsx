import React, { useState } from 'react';
import type { Project } from '../../shared/types';

interface Props {
  projects: Project[];
}

export default function Reports({ projects }: Props) {
  const [mode, setMode] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      if (mode === 'daily') {
        const r = await window.plexus.reportDaily(date);
        setReport(r);
      } else if (mode === 'weekly') {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        const r = await window.plexus.reportWeekly(monday.toISOString().slice(0, 10));
        setReport(r);
      } else {
        const month = date.slice(0, 7);
        const r = await window.plexus.reportMonthly(month);
        setReport(r);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const projectName = (id: string) => projects.find(p => p.id === id)?.name || id.slice(0, 8);

  return (
    <div>
      <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24 }}>Reports</h2>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <div style={{ display: 'flex', background: '#161920', borderRadius: 8, overflow: 'hidden', border: '1px solid #252a33' }}>
          {(['daily', 'weekly', 'monthly'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: '8px 16px',
                border: 'none',
                background: mode === m ? '#1f6feb' : 'transparent',
                color: mode === m ? '#fff' : '#8b949e',
                fontWeight: 600,
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {m}
            </button>
          ))}
        </div>
        <input
          type={mode === 'monthly' ? 'month' : 'date'}
          value={mode === 'monthly' ? date.slice(0, 7) : date}
          onChange={e => setDate(mode === 'monthly' ? e.target.value + '-01' : e.target.value)}
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            border: '1px solid #30363d',
            background: '#0f1115',
            color: '#c9d1d9',
            fontSize: 14,
          }}
        />
        <button onClick={load} disabled={loading} style={{
          padding: '10px 20px',
          borderRadius: 8,
          border: 'none',
          background: '#1f6feb',
          color: '#fff',
          fontWeight: 600,
          cursor: 'pointer',
          opacity: loading ? 0.6 : 1,
        }}>
          {loading ? 'Loading...' : 'Generate'}
        </button>
      </div>

      {report && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div style={{ background: '#161920', borderRadius: 12, padding: 20, border: '1px solid #252a33' }}>
              <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 8 }}>Total Time</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#58a6ff' }}>{formatTime(report.totalSeconds)}</div>
            </div>
            <div style={{ background: '#161920', borderRadius: 12, padding: 20, border: '1px solid #252a33' }}>
              <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 8 }}>Billable</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#3fb950' }}>{formatTime(report.billableSeconds)}</div>
            </div>
            <div style={{ background: '#161920', borderRadius: 12, padding: 20, border: '1px solid #252a33' }}>
              <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 8 }}>Non-Billable</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#f85149' }}>{formatTime(report.totalSeconds - report.billableSeconds)}</div>
            </div>
          </div>

          {/* Project Breakdown */}
          {report.projectBreakdown && Object.keys(report.projectBreakdown).length > 0 && (
            <div style={{ background: '#161920', borderRadius: 12, padding: 20, border: '1px solid #252a33' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Project Breakdown</h3>
              {Object.entries(report.projectBreakdown as Record<string, number>).map(([pid, seconds]) => (
                <div key={pid} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #252a33' }}>
                  <span>{projectName(pid)}</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{formatTime(seconds)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Daily / Weekly Detail */}
          {report.days && (
            <div style={{ background: '#161920', borderRadius: 12, padding: 20, border: '1px solid #252a33' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Daily Breakdown</h3>
              {report.days.map((d: any) => (
                <div key={d.date} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #252a33' }}>
                  <span>{new Date(d.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{formatTime(d.totalSeconds)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
