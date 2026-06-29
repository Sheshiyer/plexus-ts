export interface AdminEmployeeModeContext {
  identityId: string;
  displayName: string;
  email: string;
  role: 'employee' | 'admin';
  startedAt: string;
}

const STORAGE_KEY = 'plexus.adminEmployeeModeContext';

export function readAdminEmployeeModeContext(): AdminEmployeeModeContext | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AdminEmployeeModeContext>;
    if (!parsed.identityId || !parsed.displayName || !parsed.email) return null;
    if (parsed.role !== 'employee' && parsed.role !== 'admin') return null;
    return {
      identityId: parsed.identityId,
      displayName: parsed.displayName,
      email: parsed.email,
      role: parsed.role,
      startedAt: parsed.startedAt || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function writeAdminEmployeeModeContext(value: AdminEmployeeModeContext): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function clearAdminEmployeeModeContext(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
