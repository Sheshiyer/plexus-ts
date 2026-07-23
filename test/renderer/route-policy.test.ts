import { describe, expect, it } from 'vitest';
import { authorizeRouteTarget } from '../../src/renderer/routePolicy';

describe('renderer route policy', () => {
  it('keeps an admin route available to founders', () => {
    expect(authorizeRouteTarget({ tab: 'admin', adminSection: 'reports' }, 'admin')).toEqual({
      tab: 'admin',
      adminSection: 'reports',
    });
  });

  it('returns employees to Today when an admin route is requested', () => {
    expect(authorizeRouteTarget({ tab: 'admin', adminSection: 'reports' }, 'employee')).toEqual({
      tab: 'timer',
      adminSection: undefined,
    });
  });

  it('does not rewrite member-safe routes', () => {
    expect(authorizeRouteTarget({ tab: 'entries' }, 'employee')).toEqual({ tab: 'entries' });
  });
});
