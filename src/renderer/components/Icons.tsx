import React from 'react';

/* Inline-SVG icon set — replaces all emoji (taste-skill anti-emoji policy).
   currentColor + 1.5 stroke; size via `s` prop. No external dependency. */

interface IconProps { s?: number; className?: string; }
const base = (s: number): React.SVGProps<SVGSVGElement> => ({
  width: s, height: s, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round',
});

export const IconTimer = ({ s = 16, className }: IconProps) => (
  <svg {...base(s)} className={className}><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9 2h6" /></svg>
);
export const IconEntries = ({ s = 16, className }: IconProps) => (
  <svg {...base(s)} className={className}><path d="M8 6h12M8 12h12M8 18h12M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></svg>
);
export const IconProjects = ({ s = 16, className }: IconProps) => (
  <svg {...base(s)} className={className}><path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h6a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
);
export const IconReports = ({ s = 16, className }: IconProps) => (
  <svg {...base(s)} className={className}><path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-7" /></svg>
);
export const IconExport = ({ s = 16, className }: IconProps) => (
  <svg {...base(s)} className={className}><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 19h14" /></svg>
);
export const IconBridge = ({ s = 16, className }: IconProps) => (
  <svg {...base(s)} className={className}><path d="M9 7V3m6 4V3M7 7h10v4a5 5 0 0 1-10 0zM12 16v5" /></svg>
);
export const IconBackups = ({ s = 16, className }: IconProps) => (
  <svg {...base(s)} className={className}><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" /></svg>
);
export const IconSettings = ({ s = 16, className }: IconProps) => (
  <svg {...base(s)} className={className}><circle cx="12" cy="12" r="3" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10l2 2M19 5l-2 2M7 17l-2 2" /></svg>
);
export const IconPlay = ({ s = 14, className }: IconProps) => (
  <svg {...base(s)} className={className} fill="currentColor" stroke="none"><path d="M7 5v14l12-7z" /></svg>
);
export const IconStop = ({ s = 14, className }: IconProps) => (
  <svg {...base(s)} className={className} fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="1" /></svg>
);
export const IconPlus = ({ s = 14, className }: IconProps) => (
  <svg {...base(s)} className={className}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconClose = ({ s = 14, className }: IconProps) => (
  <svg {...base(s)} className={className}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const IconCheck = ({ s = 14, className }: IconProps) => (
  <svg {...base(s)} className={className}><path d="M4 12l5 5L20 6" /></svg>
);
export const IconSync = ({ s = 14, className }: IconProps) => (
  <svg {...base(s)} className={className}><path d="M4 9a8 8 0 0 1 14-3l2 2M20 15a8 8 0 0 1-14 3l-2-2M18 4v4h-4M6 20v-4h4" /></svg>
);
export const IconTrash = ({ s = 14, className }: IconProps) => (
  <svg {...base(s)} className={className}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
);
export const IconEdit = ({ s = 14, className }: IconProps) => (
  <svg {...base(s)} className={className}><path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" /></svg>
);
export const IconClock = ({ s = 16, className }: IconProps) => (
  <svg {...base(s)} className={className}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
export const IconPaperclip = ({ s = 16, className }: IconProps) => (
  <svg {...base(s)} className={className}><path d="M20 11.5l-8.1 8.1a5 5 0 0 1-7-7l8.1-8.1a3.3 3.3 0 0 1 4.7 4.7l-8.2 8.1a1.7 1.7 0 0 1-2.3-2.3l7.5-7.5" /></svg>
);
export const IconCloud = ({ s = 16, className }: IconProps) => (
  <svg {...base(s)} className={className}><path d="M7 18a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 9.5a3.5 3.5 0 0 1 .5 6.97" /><path d="M12 13v8m0 0l-3-3m3 3l3-3" /></svg>
);
export const IconPause = ({ s = 16, className }: IconProps) => (
  <svg {...base(s)} className={className}><path d="M9 5v14M15 5v14" /></svg>
);
export const IconScissors = ({ s = 14, className }: IconProps) => (
  <svg {...base(s)} className={className}><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M8.1 8.1L20 18M8.1 15.9L20 6M14 12h6" /></svg>
);
export const IconKeyboard = ({ s = 16, className }: IconProps) => (
  <svg {...base(s)} className={className}><rect x="2.5" y="6" width="19" height="12" rx="2" /><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" /></svg>
);
export const IconHand = ({ s = 16, className }: IconProps) => (
  <svg {...base(s)} className={className}><path d="M18 11V6.5a1.5 1.5 0 0 0-3 0V11M15 11V4.5a1.5 1.5 0 0 0-3 0V11M12 11V5.5a1.5 1.5 0 0 0-3 0V12M9 12V8.5a1.5 1.5 0 0 0-3 0V14a7 7 0 0 0 7 7h1a6 6 0 0 0 6-6v-4" /></svg>
);

export const NAV_ICONS = {
  timer: IconTimer, entries: IconEntries, projects: IconProjects, reports: IconReports,
  export: IconExport, bridge: IconBridge, backup: IconBackups, settings: IconSettings,
} as const;
