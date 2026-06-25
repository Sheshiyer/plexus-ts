interface ProfileAvatarPreset {
  id: string;
  label: string;
  bg: string;
  panel: string;
  line: string;
  accent: string;
}

const DEFAULT_PROFILE_AVATARS: ProfileAvatarPreset[] = [
  { id: 'lattice', label: 'Lattice', bg: '#052f31', panel: '#123f39', line: '#d6fff6', accent: '#e0ff4f' },
  { id: 'relay', label: 'Relay', bg: '#081f2a', panel: '#15384a', line: '#9fd9d1', accent: '#d7ff6b' },
  { id: 'field', label: 'Field', bg: '#122b24', panel: '#284331', line: '#d8fff1', accent: '#cfff4e' },
  { id: 'orbit', label: 'Orbit', bg: '#0a2528', panel: '#173c3d', line: '#bbeee7', accent: '#ecff77' },
  { id: 'signal', label: 'Signal', bg: '#09262b', panel: '#1c393f', line: '#d6fff6', accent: '#bfff5f' },
];

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

export function profileInitialsFromName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'PX';
}

function renderAvatarSvg(preset: ProfileAvatarPreset, initials: string, seed: string): string {
  const phase = hashString(`${preset.id}:${seed}`) % 72;
  const safeInitials = escapeXml(initials.slice(0, 3));
  const safeLabel = escapeXml(`${preset.label} avatar`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-label="${safeLabel}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${preset.panel}"/>
      <stop offset=".58" stop-color="${preset.bg}"/>
      <stop offset="1" stop-color="${preset.accent}" stop-opacity=".38"/>
    </linearGradient>
    <pattern id="grid" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(-28 ${phase} ${phase})">
      <path d="M18 0H0v18" fill="none" stroke="${preset.line}" stroke-opacity=".10" stroke-width="1"/>
      <path d="M0 9h18M9 0v18" fill="none" stroke="${preset.accent}" stroke-opacity=".07" stroke-width="1"/>
    </pattern>
    <filter id="soft"><feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000" flood-opacity=".28"/></filter>
  </defs>
  <rect width="256" height="256" fill="url(#g)"/>
  <rect width="256" height="256" fill="url(#grid)"/>
  <path d="M24 52C54 22 93 18 132 34c39 16 67 1 100-13v214H24Z" fill="${preset.line}" opacity=".06"/>
  <path d="M31 203c52-45 94-45 143 0 19 18 37 24 57 21" fill="none" stroke="${preset.accent}" stroke-opacity=".24" stroke-width="2"/>
  <rect x="43" y="43" width="170" height="170" fill="none" stroke="${preset.accent}" stroke-opacity=".70" stroke-width="1.5"/>
  <circle cx="${68 + (phase % 28)}" cy="72" r="3" fill="${preset.accent}" opacity=".72"/>
  <circle cx="${180 - (phase % 22)}" cy="188" r="2.5" fill="${preset.line}" opacity=".58"/>
  <text x="128" y="146" text-anchor="middle" filter="url(#soft)" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="58" letter-spacing="8" fill="${preset.line}">${safeInitials}</text>
</svg>`;
}

export function getProfileAvatarPresets(name: string, handle?: string) {
  const seed = `${name}:${handle ?? ''}`;
  const initials = profileInitialsFromName(name || handle || 'PX');
  return DEFAULT_PROFILE_AVATARS.map((preset) => ({
    id: preset.id,
    label: preset.label,
    url: `data:image/svg+xml,${encodeURIComponent(renderAvatarSvg(preset, initials, seed))}`,
  }));
}

export function getDefaultProfileAvatarUrl(name: string, handle?: string): string {
  const presets = getProfileAvatarPresets(name, handle);
  return presets[hashString(`${name}:${handle ?? ''}`) % presets.length].url;
}
