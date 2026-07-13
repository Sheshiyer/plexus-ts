import type { PlexusRole } from '../shared/types';

type RouteLike = {
  tab: string;
  adminSection?: unknown;
};

export function authorizeRouteTarget<T extends RouteLike>(target: T, role: PlexusRole | undefined): T {
  if (role !== 'employee' || target.tab !== 'admin') return target;
  return { ...target, tab: 'timer', adminSection: undefined } as T;
}
