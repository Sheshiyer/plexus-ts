import { randomUUID } from 'node:crypto';
import { getProject, getRunningEntry, insertEntry, updateEntry } from '../db/database.js';
import type { Project, TimeEntry, TimerState } from '../shared/types.js';
import { hasVerifiedGitHubRepository } from '../shared/github-repository-authority.js';

const MIN_TARGET_SECONDS = 5 * 60;
const MAX_TARGET_SECONDS = 24 * 60 * 60;

export function normalizeTargetSeconds(targetSeconds?: number) {
  if (!targetSeconds || !Number.isFinite(targetSeconds)) return undefined;
  return Math.max(MIN_TARGET_SECONDS, Math.min(MAX_TARGET_SECONDS, Math.round(targetSeconds)));
}

export function calculateActiveSeconds(entry: TimeEntry, at = new Date()) {
  const startedAt = new Date(entry.startTime).getTime();
  const now = at.getTime();
  const savedPausedSeconds = entry.pausedSeconds ?? 0;
  const activePauseSeconds = entry.pausedAt
    ? Math.max(0, Math.floor((now - new Date(entry.pausedAt).getTime()) / 1000))
    : 0;

  return Math.max(0, Math.floor((now - startedAt) / 1000) - savedPausedSeconds - activePauseSeconds);
}

export function timerStateFromEntry(entry: TimeEntry | null, at = new Date()): TimerState {
  if (!entry) return { running: false };

  return {
    running: true,
    paused: Boolean(entry.pausedAt),
    entryId: entry.id,
    startTime: entry.startTime,
    projectId: entry.projectId,
    description: entry.description,
    activeSeconds: calculateActiveSeconds(entry, at),
    targetSeconds: entry.targetSeconds,
    pausedAt: entry.pausedAt ?? undefined,
    pausedSeconds: entry.pausedSeconds ?? 0,
  };
}

function hasVerifiedRepo(project: Project | null): boolean {
  return hasVerifiedGitHubRepository(project);
}

async function requireVerifiedRepoProject(projectId: string): Promise<Project> {
  const project = await getProject(projectId);
  if (!project) throw new Error('Project not found in the local workspace cache. Sync projects before starting work.');
  if (!hasVerifiedRepo(project)) {
    const name = project.name || `Project ${projectId.slice(0, 8)}`;
    throw new Error(`${name} needs a verified GitHub repo before Plexus can create a work record.`);
  }
  return project;
}

export async function startTimerEntry(input: {
  projectId: string;
  description: string;
  targetSeconds?: number;
  now?: Date;
}): Promise<TimeEntry> {
  const description = input.description.trim();
  if (!input.projectId) throw new Error('Timer start requires a project id.');
  if (!description) throw new Error('Timer start requires a description.');
  const running = await getRunningEntry();
  if (running) throw new Error('Stop the current timer before starting another focus session.');
  const project = await requireVerifiedRepoProject(input.projectId);
  const entry: TimeEntry = {
    id: randomUUID(),
    projectId: input.projectId,
    description,
    startTime: (input.now ?? new Date()).toISOString(),
    durationSeconds: 0,
    targetSeconds: normalizeTargetSeconds(input.targetSeconds),
    pausedSeconds: 0,
    tags: [],
    source: 'timer',
    githubRepoUrl: project.githubRepoUrl,
    githubRepoFullName: project.githubRepoFullName,
    evidenceStatus: 'pending',
    evidenceCheckedAt: null,
    githubActivityIds: [],
  };
  await insertEntry(entry);
  return entry;
}

export async function getTimerState(at = new Date()) {
  return timerStateFromEntry(await getRunningEntry(), at);
}

export async function pauseRunningEntry(at = new Date()) {
  const running = await getRunningEntry();
  if (!running) return { running: false } satisfies TimerState;
  if (running.pausedAt) return timerStateFromEntry(running, at);

  const activeSeconds = calculateActiveSeconds(running, at);
  const pausedAt = at.toISOString();
  await updateEntry(running.id, {
    pausedAt,
    durationSeconds: activeSeconds,
  });

  return timerStateFromEntry({ ...running, pausedAt, durationSeconds: activeSeconds }, at);
}

export async function resumeRunningEntry(at = new Date()) {
  const running = await getRunningEntry();
  if (!running) return { running: false } satisfies TimerState;
  if (!running.pausedAt) return timerStateFromEntry(running, at);

  const pauseStartedAt = new Date(running.pausedAt).getTime();
  const pauseDeltaSeconds = Math.max(0, Math.floor((at.getTime() - pauseStartedAt) / 1000));
  const pausedSeconds = (running.pausedSeconds ?? 0) + pauseDeltaSeconds;
  await updateEntry(running.id, {
    pausedAt: null,
    pausedSeconds,
  });

  return timerStateFromEntry({ ...running, pausedAt: null, pausedSeconds }, at);
}

export async function stopRunningEntry(at = new Date()) {
  const running = await getRunningEntry();
  if (!running) return null;

  const durationSeconds = calculateActiveSeconds(running, at);
  const endTime = at.toISOString();
  await updateEntry(running.id, {
    endTime,
    durationSeconds,
    pausedAt: null,
  });

  return {
    ...running,
    endTime,
    durationSeconds,
    pausedAt: null,
  };
}
