import { describe, expect, it, vi } from 'vitest';

const { fork } = vi.hoisted(() => ({ fork: vi.fn(() => 'gyerek') }));
vi.mock('node:child_process', () => ({ fork }));

describe('spawnScriptChild', () => {
  it('a belépési pontot indítja, a szülő kapcsolói és környezete nélkül, csak IPC csatornával', async () => {
    const { spawnScriptChild } = await import('./spawn-script-child.ts');
    const previous = process.env['TZ'];
    process.env['TZ'] = 'Asia/Tokyo';
    try {
      expect(spawnScriptChild()).toBe('gyerek');
    } finally {
      if (previous === undefined) {
        Reflect.deleteProperty(process.env, 'TZ');
      } else {
        process.env['TZ'] = previous;
      }
    }
    expect(fork).toHaveBeenCalledWith(new URL('script-child-entry.ts', new URL(import.meta.url)), [], {
      env: { TZ: 'Asia/Tokyo' },
      execArgv: [],
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      serialization: 'json',
    });
  });
});
