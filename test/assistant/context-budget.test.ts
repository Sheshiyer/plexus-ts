import { describe, expect, it } from 'vitest';
import { limitAssistantItems, limitAssistantText } from '../../src/main/assistant-context';

describe('assistant context budgeter', () => {
  it('limits items deterministically and reports dropped counts', () => {
    const result = limitAssistantItems([1, 2, 3, 4], 2);

    expect(result.items).toEqual([1, 2]);
    expect(result.budget).toEqual({ limit: 2, totalItems: 4, droppedItems: 2 });
  });

  it('limits text deterministically and reports omitted characters', () => {
    const result = limitAssistantText('abcdef', 3);

    expect(result).toEqual({
      text: 'abc',
      maxChars: 3,
      originalChars: 6,
      truncated: true,
      omittedChars: 3,
    });
  });
});
