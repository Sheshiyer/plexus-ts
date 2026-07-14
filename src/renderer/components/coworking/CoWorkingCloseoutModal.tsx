import React from 'react';
import { IconPaperclip } from '../Icons';
import { Button, Field, Input, Modal, Textarea } from '../ui';

export interface CoWorkingCloseoutModalProps {
  roomName: string;
  title: string;
  notes: string;
  decisions: string;
  actions: string;
  sendToPaperclip: boolean;
  busy: boolean;
  error: string | null;
  onTitleChange(value: string): void;
  onNotesChange(value: string): void;
  onDecisionsChange(value: string): void;
  onActionsChange(value: string): void;
  onSendToPaperclipChange(value: boolean): void;
  onClose(): void;
  onSave(): void;
}

export function CoWorkingCloseoutModal({
  roomName,
  title,
  notes,
  decisions,
  actions,
  sendToPaperclip,
  busy,
  error,
  onTitleChange,
  onNotesChange,
  onDecisionsChange,
  onActionsChange,
  onSendToPaperclipChange,
  onClose,
  onSave,
}: CoWorkingCloseoutModalProps) {
  return (
    <Modal title={`Closeout - ${roomName}`} onClose={onClose} width={560}>
      <div className="px-closeout-form">
        <Field label="Title">
          <Input value={title} onChange={(event) => onTitleChange(event.target.value)} disabled={busy} />
        </Field>
        <Field label="Notes">
          <Textarea value={notes} onChange={(event) => onNotesChange(event.target.value)} disabled={busy} />
        </Field>
        <Field label="Decisions - one per line">
          <Textarea value={decisions} onChange={(event) => onDecisionsChange(event.target.value)} disabled={busy} />
        </Field>
        <Field label="Action items - one per line">
          <Textarea value={actions} onChange={(event) => onActionsChange(event.target.value)} disabled={busy} />
        </Field>
        <label className="px-closeout-check">
          <input
            type="checkbox"
            checked={sendToPaperclip}
            onChange={(event) => onSendToPaperclipChange(event.target.checked)}
            disabled={busy}
          />
          <span>Paperclip handoff</span>
        </label>
        {error && <div className="px-coworking-error" role="alert">{error}</div>}
        <div className="px-closeout-actions">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>CANCEL</Button>
          <Button type="button" onClick={onSave} disabled={busy}>
            <IconPaperclip s={14} /> {busy ? 'SAVING' : 'SAVE CLOSEOUT'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
