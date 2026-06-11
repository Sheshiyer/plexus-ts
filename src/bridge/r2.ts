import type { TimeEntry } from '../shared/types.js';

/**
 * Archive a monthly time report to Cloudflare R2 (S3-compatible).
 */
export async function archiveToR2(
  endpoint: string,
  bucket: string,
  accessKeyId: string,
  secretAccessKey: string,
  memberId: string,
  entries: TimeEntry[],
  month: string
): Promise<{ success: boolean; message: string; url?: string }> {
  try {
    const key = `time-reports/${memberId}/${month}.json`;

    const body = JSON.stringify({
      memberId,
      month,
      generatedAt: new Date().toISOString(),
      entries,
      summary: {
        totalSeconds: entries.reduce((s, e) => s + e.durationSeconds, 0),
        billableSeconds: entries.filter(e => e.billable).reduce((s, e) => s + e.durationSeconds, 0),
        entryCount: entries.length,
      },
    }, null, 2);

    // Construct S3-compatible PUT
    const url = `${endpoint}/${bucket}/${key}`;
    const date = new Date().toUTCString();

    // Note: Real S3 signing is complex; for production use aws4fetch or similar.
    // This is a stub-compatible implementation.
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-amz-date': date,
        Authorization: `AWS ${accessKeyId}:SIGNATURE_PLACEHOLDER`,
      },
      body,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`R2 responded ${res.status}: ${text}`);
    }

    return { success: true, message: `Archived to ${key}`, url };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
