import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function source(file: string): string {
  return readFileSync(path.resolve(process.cwd(), file), 'utf8');
}

describe('Member workspace flow contract', () => {
  it('keeps one selected project across the shell, Projects, and Today', () => {
    const app = source('src/renderer/App.tsx');
    const projects = source('src/renderer/components/ProjectManager.tsx');
    const timer = source('src/renderer/components/Timer.tsx');

    expect(app).toContain("'plexus:focused-project'");
    expect(app).toContain('onFocusedProjectChange={focusProject}');
    expect(app).toContain('onOpenToday={(projectId) =>');
    expect(app).toContain('className="px-workspace-trail"');
    expect(projects).toContain('Open in Today');
    expect(projects).toContain('onFocusedProjectChange?.(project.id)');
    expect(timer).toContain('focusedProjectId');
    expect(timer).toContain('onFocusedProjectChange?.(projectId)');
  });

  it('uses bounded list-detail workspaces instead of repeating every project and record action in rows', () => {
    const projects = source('src/renderer/components/ProjectManager.tsx');
    const records = source('src/renderer/components/TimeEntryList.tsx');
    const theme = source('src/renderer/theme.css');

    expect(projects).toContain('px-projects-workspace');
    expect(projects).toContain('px-projects-inspector');
    expect(projects).toContain('{repoReady(inspectedProject) && onOpenToday && (');
    expect(records).toContain('px-records-workspace');
    expect(records).toContain('px-records-inspector');
    expect(records).toContain('record detail');
    expect(theme).toContain('.px-projects-workspace,.px-records-workspace{display:grid');
    expect(theme).toContain('.pxds-ledger-rail.is-selected');
    expect(theme).toContain('@container px-main (max-width:1120px)');
  });

  it('keeps the selected-project indicator separate from Clio scope or a permission grant', () => {
    const sideChat = source('src/renderer/components/ClioSideChat.tsx');

    expect(sideChat).toContain('selectedProjectName');
    expect(sideChat).toContain('is selected in this workspace');
    expect(sideChat).not.toContain('project scope granted');
  });

  it('keeps the browser fixture focused on the implemented member work path', () => {
    const fixture = source('scripts/capture-assistant-screenshot-matrix.mjs');

    expect(fixture).toContain('PLEXUS_CAPTURE_MEMBER_WORKSPACE_ONLY');
    expect(fixture).toContain('projects-list-detail-1536.png');
    expect(fixture).toContain('project-to-today-1536.png');
    expect(fixture).toContain('work-records-list-detail-1536.png');
    expect(fixture).toContain('work-records-inspector-sidechat-1040.png');
    expect(fixture).toContain('verified project to Today handoff');
  });
});
