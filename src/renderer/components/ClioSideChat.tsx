import React from 'react';
import type { Project, TodaySnapshot } from '../../shared/types';
import { Button } from './ui';
import { IconChevronRight, IconClose, IconBridge } from './Icons';
import AssistantPanel from './AssistantPanel';
import { StatusChip } from './PlexusUI';

interface Props {
  open: boolean;
  projects: Project[];
  todaySnapshot?: TodaySnapshot | null;
  onClose: () => void;
  onOpenWorkbench: () => void;
}

export default function ClioSideChat({ open, projects, todaySnapshot, onClose, onOpenWorkbench }: Props) {
  return (
    <aside className={`px-clio-sidechat${open ? ' open' : ''}`} aria-label="Clio assistant side chat" aria-hidden={!open}>
      {open && (
        <>
          <div className="px-clio-sidechat-head">
            <div className="px-clio-sidechat-title">
              <span className="px-clio-sidechat-mark"><IconBridge s={14} /></span>
              <div>
                <strong>Clio</strong>
                <span>side chat</span>
              </div>
            </div>
            <div className="px-clio-sidechat-actions">
              <StatusChip tone="accent">app-wide</StatusChip>
              <Button variant="ghost" onClick={onOpenWorkbench} title="Open Clio workbench">
                <IconChevronRight s={13} /> Workbench
              </Button>
              <Button variant="ghost" onClick={onClose} title="Close Clio side chat" aria-label="Close Clio side chat">
                <IconClose s={13} />
              </Button>
            </div>
          </div>
          <div className="px-clio-sidechat-body">
            <AssistantPanel projects={projects} surface="sidechat" todaySnapshot={todaySnapshot} />
          </div>
        </>
      )}
    </aside>
  );
}
