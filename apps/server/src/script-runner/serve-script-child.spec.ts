/* eslint-disable unicorn/no-null -- a korlát mezők üres értéke a `null` (SPEC-014 5.3), a küldés visszahívása hibátlanul `null`-t kap (Node `process.send`) */
import type { ScriptRunResult } from '@easter-workflow-builder/engine';
import { describe, expect, it } from 'vitest';
import type { SandboxRunRequest } from './sandbox-run-request.ts';
import { serveScriptChild, type ScriptChildChannel } from './serve-script-child.ts';

interface FakeEmitter {
  readonly listeners: Map<string, (message?: unknown) => void>;
  emit(event: string, message?: unknown): void;
}

interface FakeChannel {
  readonly channel: ScriptChildChannel;
  readonly emitter: FakeEmitter;
  readonly sent: ScriptRunResult[];
  readonly exited: Promise<number>;
}

function fakeChannel(hasSend = true): FakeChannel {
  const listeners = new Map<string, (message?: unknown) => void>();
  const emitter: FakeEmitter = {
    listeners,
    emit(event, message) {
      const listener = listeners.get(event);
      listeners.delete(event);
      listener?.(message);
    },
  };
  const sent: ScriptRunResult[] = [];
  const exit = Promise.withResolvers<number>();
  const channel: ScriptChildChannel = {
    send: hasSend
      ? (message, callback) => {
          sent.push(message);
          callback(null);
          return true;
        }
      : undefined,
    once(event: string, listener: (message: unknown) => void) {
      listeners.set(event, listener);
      return channel;
    },
    exit(code) {
      exit.resolve(code);
    },
  };
  return { channel, emitter, sent, exited: exit.promise };
}

const REQUEST: SandboxRunRequest = {
  source: 'return input.a + 1;',
  contextJson: '{"input":{"a":1}}',
  root: process.cwd(),
  timeoutMs: 5000,
  deadlineMs: Date.now() + 5000,
  memoryLimitMb: 64,
  fetchResponseLimitMb: null,
  fileReadLimitMb: null,
};

describe('serveScriptChild', () => {
  it('a kérést lefuttatja, a választ visszaküldi, és a küldés után 0 kóddal kilép', async () => {
    const fake = fakeChannel();
    serveScriptChild(fake.channel);
    fake.emitter.emit('message', REQUEST);
    await expect(fake.exited).resolves.toBe(0);
    expect(fake.sent).toStrictEqual([{ kind: 'succeeded', output: 2 }]);
  });

  it('a nem a kérés alakú üzenetre script_evaluation_failed a válasz', async () => {
    const fake = fakeChannel();
    serveScriptChild(fake.channel);
    fake.emitter.emit('message', { source: 1 });
    await expect(fake.exited).resolves.toBe(0);
    expect(fake.sent).toStrictEqual([
      {
        kind: 'failed',
        errorKind: 'script_evaluation_failed',
        message: 'a szkript folyamata nem a várt alakú kérést kapta',
      },
    ]);
  });

  it('a csatorna lezárásakor 0 kóddal kilép', async () => {
    const fake = fakeChannel();
    serveScriptChild(fake.channel);
    fake.emitter.emit('disconnect');
    await expect(fake.exited).resolves.toBe(0);
  });

  it('IPC csatorna nélkül (nincs send) azonnal 1 kóddal kilép, és üzenetre nem vár', async () => {
    const fake = fakeChannel(false);
    serveScriptChild(fake.channel);
    await expect(fake.exited).resolves.toBe(1);
    expect(fake.emitter.listeners.has('message')).toBe(false);
  });
});
