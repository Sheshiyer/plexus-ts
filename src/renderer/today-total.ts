import type { TimeEntry, TimerState } from '../shared/types.js';

function wholeSeconds(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function completedTodaySeconds(entries: readonly TimeEntry[], timerState: TimerState): number {
  return entries.reduce((total, entry) => {
    if (timerState.running && entry.id === timerState.entryId) return total;
    return total + wholeSeconds(entry.durationSeconds);
  }, 0);
}

export function displayedTodaySeconds(completedSeconds: number, timerState: TimerState): number {
  const activeSeconds = timerState.running ? wholeSeconds(timerState.activeSeconds) : 0;
  return wholeSeconds(completedSeconds) + activeSeconds;
}
