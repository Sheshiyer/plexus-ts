import React, { useState } from 'react';
import { PageHeader, Panel, Button, Field, Input, Badge, StatusDot, SectionLabel } from './ui';
import { IconSync, IconPaperclip, IconBridge, IconCloud } from './Icons';

export default function BridgePanel() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [status, setStatus] = useState<Record<string, { success?: boolean; message: string; loading?: boolean }>>({});

  const run = async (key: string, fn: (m: string) => Promise<{ success: boolean; message: string; url?: string }>) => {
    setStatus(prev => ({ ...prev, [key]: { message: 'Running…', loading: true } }));
    try {
      const res = await fn(month);
      setStatus(prev => ({ ...prev, [key]: { success: res.success, message: res.message || (res.success ? 'OK' : 'Failed') } }));
    } catch (e: any) {
      setStatus(prev => ({ ...prev, [key]: { success: false, message: e.message || 'Error' } }));
    }
  };

  const actions = [
    {
      key: 'paperclip',
      label: 'Sync to Paperclip',
      icon: <IconPaperclip s={15} />,
      desc: 'Push time entries into Paperclip vault for agent visibility',
      action: () => run('paperclip', window.plexus.syncToPaperclip),
    },
    {
      key: 'multica',
      label: 'Push to MultiCA',
      icon: <IconBridge s={15} />,
      desc: 'Send monthly report across the MultiCA bridge to cofounders',
      action: () => run('multica', window.plexus.pushToMultiCA),
    },
    {
      key: 'r2',
      label: 'Archive to R2',
      icon: <IconCloud s={15} />,
      desc: 'Store monthly report in Cloudflare R2 for durable retention',
      action: () => run('r2', window.plexus.archiveToR2),
    },
  ];

  return (
    <div className="px-fadein">
      <PageHeader title="Bridge" sub="connect plexus to the thoughtseed ecosystem" />

      <Panel raised pad crosshairs>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <Field label="month">
            <Input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ width: 'auto' }} />
          </Field>
        </div>

        <div className="px-rows" style={{ marginTop: 18 }}>
          {actions.map(a => {
            const st = status[a.key];
            return (
              <div key={a.key} className="px-row" style={{ gridTemplateColumns: '15px 1fr auto' }}>
                <span style={{ color: 'var(--accent)', display: 'flex' }}>{a.icon}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="desc">{a.label}</div>
                  <div className="meta" style={{ whiteSpace: 'normal' }}>{a.desc}</div>
                  {st && (
                    <div
                      className="px-mono"
                      style={{
                        marginTop: 6, fontSize: 11, letterSpacing: '.04em',
                        color: st.success === true ? 'var(--accent)' : st.success === false ? 'var(--rose)' : 'var(--t3)',
                      }}
                    >
                      {st.message}
                    </div>
                  )}
                </div>
                <Button variant="ghost" onClick={a.action} disabled={st?.loading}>
                  <IconSync /> {st?.loading ? 'Running…' : 'Run'}
                </Button>
              </div>
            );
          })}
        </div>
      </Panel>

      <div style={{ marginTop: 26 }}>
        <SectionLabel style={{ marginBottom: 12 }}>data flow</SectionLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Badge tone="bill">Plexus</Badge>
          <StatusDot />
          <Badge tone="mint">Paperclip</Badge>
          <StatusDot />
          <Badge>MultiCA</Badge>
          <StatusDot />
          <Badge>TeamForge</Badge>
          <StatusDot />
          <Badge tone="mint">R2 Archive</Badge>
        </div>
      </div>
    </div>
  );
}
