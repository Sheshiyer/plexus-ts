import type { TimeEntry, MultiCAMessage } from '../shared/types.js';

/**
 * Push a monthly time report to the MultiCA bridge.
 * Sends a structured message to the upstream MultiCA API.
 */
export async function pushToMultiCA(
  apiUrl: string,
  token: string,
  memberId: string,
  entries: TimeEntry[],
  month: string
): Promise<{ success: boolean; message: string }> {
  try {
    const payload: MultiCAMessage = {
      type: 'time_report',
      memberId,
      payload: {
        month,
        entryCount: entries.length,
        totalSeconds: entries.reduce((s, e) => s + e.durationSeconds, 0),
        projectBreakdown: entries.reduce((acc, e) => {
          acc[e.projectId] = (acc[e.projectId] || 0) + e.durationSeconds;
          return acc;
        }, {} as Record<string, number>),
      },
      timestamp: new Date().toISOString(),
    };

    const res = await fetch(`${apiUrl}/bridge/upstream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`MultiCA responded ${res.status}: ${text}`);
    }

    return { success: true, message: `Pushed ${entries.length} entries to MultiCA` };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
