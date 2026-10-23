import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import AssistantGrowthRequest from '../../src/renderer/components/AssistantGrowthRequest';

describe('Clio employee growth request card', () => {
  it('shows queued status without implying completed execution', () => {
    const html = renderToStaticMarkup(<AssistantGrowthRequest request={{ id: 'request1', status: 'queued', objective: 'Draft launch brief' }} refreshing={false} onRefresh={() => {}} />);
    expect(html).toContain('request1'); expect(html).toContain('queued'); expect(html).toContain('Refresh status'); expect(html).not.toContain('completed');
  });
  it('renders completed evidence as escaped bounded text', () => {
    const html = renderToStaticMarkup(<AssistantGrowthRequest request={{ id: 'request1', status: 'completed', result: { summary: '<script>bad()</script>', artifactRefs: ['agent-outputs/brief.md'] } }} refreshing={true} onRefresh={() => {}} />);
    expect(html).toContain('completed'); expect(html).toContain('agent-outputs/brief.md'); expect(html).not.toContain('<script>'); expect(html).toContain('disabled');
  });
});
