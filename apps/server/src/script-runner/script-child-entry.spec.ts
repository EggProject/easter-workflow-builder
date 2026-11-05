import process from 'node:process';
import { describe, expect, it, vi } from 'vitest';

const { serveScriptChild } = vi.hoisted(() => ({ serveScriptChild: vi.fn() }));
vi.mock('./serve-script-child.ts', () => ({ serveScriptChild }));

describe('a szkript folyamat belépési pontja', () => {
  it('egyetlen hívással a folyamat saját process objektumát adja a csatorna kiszolgálónak', async () => {
    await import('./script-child-entry.ts');
    expect(serveScriptChild).toHaveBeenCalledTimes(1);
    expect(serveScriptChild).toHaveBeenCalledWith(process);
  });
});
