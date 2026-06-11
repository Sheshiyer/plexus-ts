import express from 'express';
import cors from 'cors';
import { randomBytes } from 'node:crypto';
import { listProjects, listEntries, getRunningEntry, getSetting, setSetting } from '../db/database.js';

const app = express();
const PORT = 31339;

let server: ReturnType<typeof app.listen> | null = null;

export async function startApiServer() {
  // Stable bearer token: reused across restarts so agent integrations keep working.
  let token = await getSetting('apiToken');
  if (!token) {
    token = randomBytes(24).toString('hex');
    await setSetting('apiToken', token);
  }

  app.use(cors({ origin: /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/ }));
  app.use(express.json());

  app.use((req, res, next) => {
    if (req.path === '/api/health') return next();
    if (req.headers.authorization === `Bearer ${token}`) return next();
    res.status(401).json({ error: 'unauthorized' });
  });

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'plexus-api', version: '0.1.0' });
  });

  // Current timer state
  app.get('/api/timer', async (_req, res) => {
    const running = await getRunningEntry();
    if (!running) {
      res.json({ running: false });
      return;
    }
    const elapsed = Math.floor((Date.now() - new Date(running.startTime).getTime()) / 1000);
    res.json({
      running: true,
      entryId: running.id,
      projectId: running.projectId,
      description: running.description,
      startTime: running.startTime,
      elapsedSeconds: elapsed,
    });
  });

  // List projects
  app.get('/api/projects', async (_req, res) => {
    const projects = await listProjects();
    res.json(projects);
  });

  // List entries
  app.get('/api/entries', async (req, res) => {
    const from = (req.query.from as string) || '1970-01-01T00:00:00.000Z';
    const to = (req.query.to as string) || '2099-12-31T23:59:59.999Z';
    const entries = await listEntries(from, to);
    res.json(entries);
  });

  // Daily report
  app.get('/api/reports/daily/:date', async (req, res) => {
    const date = req.params.date;
    const from = `${date}T00:00:00.000Z`;
    const to = `${date}T23:59:59.999Z`;
    const entries = await listEntries(from, to);
    const total = entries.reduce((s, e) => s + e.durationSeconds, 0);
    res.json({ date, entries, totalSeconds: total });
  });

  // Weekly report
  app.get('/api/reports/weekly/:weekStart', async (req, res) => {
    const weekStart = req.params.weekStart;
    const start = new Date(weekStart);
    const days: any[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const ds = d.toISOString().slice(0, 10);
      const entries = await listEntries(`${ds}T00:00:00.000Z`, `${ds}T23:59:59.999Z`);
      days.push({
        date: ds,
        entries,
        totalSeconds: entries.reduce((s, e) => s + e.durationSeconds, 0),
      });
    }
    const total = days.reduce((s, d) => s + d.totalSeconds, 0);
    res.json({ weekStart, days, totalSeconds: total });
  });

  // Monthly report
  app.get('/api/reports/monthly/:month', async (req, res) => {
    const month = req.params.month;
    const allEntries = await listEntries(`${month}-01T00:00:00.000Z`, `${month}-31T23:59:59.999Z`);
    const projBreakdown: Record<string, number> = {};
    for (const e of allEntries) {
      projBreakdown[e.projectId] = (projBreakdown[e.projectId] || 0) + e.durationSeconds;
    }
    const total = allEntries.reduce((s, e) => s + e.durationSeconds, 0);
    res.json({ month, totalSeconds: total, projectBreakdown: projBreakdown, entryCount: allEntries.length });
  });

  server = app.listen(PORT, '127.0.0.1', () => {
    console.log(`Plexus API listening on http://127.0.0.1:${PORT}`);
    console.log(`Plexus API token: ${token}`);
  });
}

export function stopApiServer() {
  if (server) {
    server.close();
    server = null;
  }
}
