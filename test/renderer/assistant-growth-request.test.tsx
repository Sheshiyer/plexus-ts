import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import AssistantGrowthRequest from '../../src/renderer/components/AssistantGrowthRequest';
const render = (request: Record<string, unknown>, refreshing = false) => renderToStaticMarkup(<AssistantGrowthRequest request={request} refreshing={refreshing} onRefresh={() => {}} />);
describe('Clio employee growth request card', () => {
  it('shows accepted progress without implying completed execution', () => {
    const html = render({ id: 'request1', status: 'queued', role: 'synthesist' });
    expect(html).toContain('class="px-growth-request"'); expect(html).not.toContain('px-assistant-action-result');
    expect(html).toContain('Waiting for Hermes'); expect(html).toContain('Synthesist'); expect(html).toContain('Refresh status'); expect(html).not.toContain('Draft ready');
  });
  it('renders the actual API draft schema as escaped complete content and permitted sources', () => {
    const content = '<script>bad()</script>\n' + 'Draft paragraph. '.repeat(1100);
    const html = render({ id: 'request1', status: 'draft_ready', result: { schema: 'thoughtseed.growth.result.v1', content, approvalState: 'draft', externalAction: 'none', sources: [{ path: '20-operations/growth/README.md', digest: 'sha256:secret-detail' }, { path: 'javascript:bad()', digest: 'bad' }] } }, true);
    expect(html).toContain('Draft ready for review'); expect(html).toContain('Growth operating model'); expect(html).not.toContain('<script>'); expect(html).not.toContain('secret-detail'); expect(html).not.toContain('javascript:'); expect(html).toContain('disabled'); expect(html.match(/Draft paragraph\./g)).toHaveLength(1100);
  });
  it('gives useful retry and terminal failure guidance', () => {
    expect(render({ id: '1', status: 'retrying' })).toContain('retry this request automatically');
    expect(render({ id: '1', status: 'failed' })).toContain('fresh handoff for confirmation');
    expect(render({ id: '1', status: 'draft_ready', result: null })).toContain('could not be displayed');
  });
});
