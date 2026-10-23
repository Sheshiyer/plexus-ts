import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import AssistantActionConfirmModal from '../../src/renderer/components/AssistantActionConfirmModal';
it('explains the complete growth objective and source boundaries without internal authority', () => {
  const html = renderToStaticMarkup(<AssistantActionConfirmModal intent={{ id: '1', toolId: 'org.handoff', title: 'Prepare a brief', safety: 'confirm_required', payload: { objective: 'A'.repeat(200), role: 'synthesist', requestId: 'request1', contextRefs: ['20-operations/growth/README.md'], _growthAuthority: 'private-internal' } }} onClose={() => {}} onResult={() => {}} />);
  expect(html).toContain('A'.repeat(200)); expect(html).toContain('Responsible role'); expect(html).toContain('Synthesist'); expect(html).toContain('Growth operating model'); expect(html).toContain('does not authorize publishing'); expect(html).not.toContain('private-internal'); expect(html).not.toContain('org.handoff');
});
