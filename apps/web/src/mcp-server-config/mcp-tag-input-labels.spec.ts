import { describe, expect, it } from 'vitest';
import { MCP_TAG_INPUT_LABELS } from './mcp-tag-input-labels.ts';

describe('MCP_TAG_INPUT_LABELS', () => {
  it('a bejelentések és az eltávolító gomb neve magyar, a címke nevével', () => {
    expect(MCP_TAG_INPUT_LABELS.added('--verbose')).toBe('Hozzáadva: --verbose');
    expect(MCP_TAG_INPUT_LABELS.removed('--verbose')).toBe('Eltávolítva: --verbose');
    expect(MCP_TAG_INPUT_LABELS.remove('--verbose')).toBe('Eltávolítás: --verbose');
  });
});
