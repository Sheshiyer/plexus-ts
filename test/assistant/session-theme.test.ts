import { describe, expect, it } from 'vitest';
import { extractAssistantSessionThemes } from '../../src/main/assistant-context';

describe('assistant session theme extractor', () => {
  it('normalizes common session themes without reading full prompts', () => {
    expect(extractAssistantSessionThemes({
      title: 'Release review for deploy docs',
      projectName: 'Plexus',
      repoFullName: 'thoughtseed/plexus-ts',
      confidenceReasons: ['title match'],
    })).toEqual(['release', 'review', 'deploy', 'docs']);
  });

  it('detects bugfix, design, planning, assistant, and infra themes', () => {
    expect(extractAssistantSessionThemes({
      title: 'Plan UI bug fix for assistant context bridge',
      projectName: 'Native Assistant Runtime',
      repoFullName: 'thoughtseed/plexus-ts',
      confidenceReasons: ['database migration mention'],
    })).toEqual(['bugfix', 'design', 'planning', 'assistant', 'infra']);
  });
});
