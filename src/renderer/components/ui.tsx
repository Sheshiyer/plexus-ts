import React from 'react';
import { IconClose } from './Icons';

/* Plexus primitives — consume theme.css (px-* classes). Cambium brand. */

export function Crosshairs() {
  return (<>
    <span className="px-cross tl" /><span className="px-cross tr" />
    <span className="px-cross bl" /><span className="px-cross br" />
  </>);
}

export function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div className="px-lbl" style={style}>{children}</div>;
}

export function Caption({ children }: { children: React.ReactNode }) {
  return <div className="px-caption">{children}</div>;
}

export function PageHeader({ title, sub, right }: { title: string; sub?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="px-page-h">
      <div className="px-page-copy"><h2>{title}</h2>{sub && <div className="sub px-lbl">{sub}</div>}</div>
      {right && <div className="px-page-right">{right}</div>}
    </div>
  );
}

export function Panel({ children, raised, pad, crosshairs, className = '', style }:
  { children: React.ReactNode; raised?: boolean; pad?: boolean; crosshairs?: boolean; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`px-panel${raised ? ' raised' : ''}${pad ? ' pad' : ''} ${className}`} style={style}>
      {crosshairs && <Crosshairs />}
      {children}
    </div>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'accent' | 'ghost' | 'stop' };
export function Button({ variant = 'accent', className = '', children, ...rest }: BtnProps) {
  const v = variant === 'accent' ? '' : ` ${variant}`;
  return <button className={`px-btn${v} ${className}`} {...rest}>{children}</button>;
}

export function Field({ label, error, children, className = '' }:
  { label?: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`px-field${error ? ' invalid' : ''} ${className}`}>
      {label && <label>{label}</label>}
      {children}
      {error && <div className="err">{error}</div>}
    </div>
  );
}

export const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) =>
  <input {...p} className={`px-input ${p.className || ''}`} />;
export const Select = (p: React.SelectHTMLAttributes<HTMLSelectElement>) =>
  <select {...p} className={`px-select ${p.className || ''}`} />;
export const Textarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) =>
  <textarea {...p} className={`px-textarea ${p.className || ''}`} />;

export function Badge({ tone, children }: { tone?: 'bill' | 'mint' | 'rose'; children: React.ReactNode }) {
  return <span className={`px-badge${tone ? ' ' + tone : ''}`}>{children}</span>;
}

export function StatusDot({ active, children }: { active?: boolean; children?: React.ReactNode }) {
  return <span className="px-statusdot"><span className={`px-dot${active ? '' : ' idle'}`} />{children}</span>;
}

export function Swatch({ color }: { color: string }) {
  return <span className="px-swatch" style={{ background: color }} />;
}

export function StatCard({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return <div className={`px-stat${accent ? ' acc' : ''}`}><div className="px-lbl">{label}</div><div className="v">{value}</div></div>;
}

export function Skeleton({ lines = 3, widths }: { lines?: number; widths?: string[] }) {
  return <div>{Array.from({ length: lines }).map((_, i) =>
    <div key={i} className="px-sk" style={{ width: widths?.[i] ?? `${60 + ((i * 37) % 35)}%` }} />)}</div>;
}

export function EmptyState({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return <div className="px-empty">{icon}{children}</div>;
}

export function Toggle<T extends string>({ value, options, onChange }:
  { value: T; options: { key: T; label: string }[]; onChange: (k: T) => void }) {
  return (
    <div className="px-toggle">
      {options.map(o => (
        <button key={o.key} className={value === o.key ? 'on' : ''} onClick={() => onChange(o.key)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Modal({ title, onClose, children, width }:
  { title?: string; onClose?: () => void; children: React.ReactNode; width?: number }) {
  return (
    <div className="px-backdrop" onClick={onClose}>
      <div
        className="px-modal pad"
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Dialog'}
        style={width ? { maxWidth: width } : undefined}
        onClick={e => e.stopPropagation()}
      >
        <Crosshairs />
        {(title || onClose) && (
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
            {title && <h3>{title}</h3>}
            {onClose && <button className="px-btn ghost" style={{ padding: 7 }} onClick={onClose} aria-label="Close"><IconClose /></button>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/* shared duration formatter (kept here so every screen renders time identically) */
export function fmtHMS(seconds: number): string {
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
export function fmtHM(seconds: number): string {
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

/* YYYY-MM-DD in the user's local timezone. Replaces the
 * `toISOString().slice(0, 10)` anti-pattern which converts to UTC first and
 * silently rolls back a day for users east of UTC during the early morning. */
export function localDateString(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
