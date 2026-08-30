import { describe, expect, it } from 'vitest';
import type { DestinationStream } from 'pino';
import { createServerLogger } from './create-server-logger.ts';

interface MemorySink extends DestinationStream {
  readonly lines: () => readonly Record<string, unknown>[];
  readonly raw: () => string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function createMemorySink(): MemorySink {
  const chunks: string[] = [];
  return {
    write(message: string): void {
      chunks.push(message);
    },
    lines(): readonly Record<string, unknown>[] {
      return chunks
        .join('')
        .split('\n')
        .filter((line) => line.length > 0)
        .map((line) => {
          const parsed: unknown = JSON.parse(line);
          if (!isRecord(parsed)) {
            throw new Error('a pino sor nem objektum alakú JSON');
          }
          return parsed;
        });
    },
    raw(): string {
      return chunks.join('');
    },
  };
}

describe('createServerLogger', () => {
  it('a befecskendezett nyelőre írja a naplósort, fájl és worker szál nélkül', () => {
    const sink = createMemorySink();
    const logger = createServerLogger({ secretValues: [] }, sink);

    logger.info('szia');

    const [entry] = sink.lines();
    expect(entry?.['msg']).toBe('szia');
  });

  it('szint megadása nélkül a pino dokumentált info alapértéke érvényesül: a debug sor nem megy ki', () => {
    const sink = createMemorySink();
    const logger = createServerLogger({ secretValues: [] }, sink);

    logger.debug('nem kellene megjelennie');

    expect(sink.lines()).toHaveLength(0);
  });

  it('explicit debug szinttel a debug sor is kimegy', () => {
    const sink = createMemorySink();
    const logger = createServerLogger({ level: 'debug', secretValues: [] }, sink);

    logger.debug('debug sor');

    const [entry] = sink.lines();
    expect(entry?.['msg']).toBe('debug sor');
  });

  it('az authorization mezőt a redact opció maszkolja', () => {
    const sink = createMemorySink();
    const logger = createServerLogger({ secretValues: [] }, sink);

    logger.info({ authorization: 'Bearer sk-titok' }, 'kérés fejléc');

    const [entry] = sink.lines();
    expect(entry?.['authorization']).toBe('[Redacted]');
  });

  it('a hibaüzenet szövegébe ágyazott titkot az érték szintű törlő maszkolja', () => {
    const sink = createMemorySink();
    const logger = createServerLogger({ secretValues: ['sk-nagyon-titkos'] }, sink);

    logger.error('kapcsolódási hiba: sk-nagyon-titkos érvénytelen kulcs');

    expect(sink.raw()).not.toContain('sk-nagyon-titkos');
    const [entry] = sink.lines();
    expect(entry?.['msg']).toBe('kapcsolódási hiba: [Redacted] érvénytelen kulcs');
  });

  it('a gyermek logger a szülő kontextusát és a titok maszkolást is örökli', () => {
    const sink = createMemorySink();
    const logger = createServerLogger({ secretValues: ['sk-gyermek-titok'] }, sink);
    const child = logger.child({ requestId: 'req-1' });

    child.info('sk-gyermek-titok szerepel itt');

    const [entry] = sink.lines();
    expect(entry?.['requestId']).toBe('req-1');
    expect(entry?.['msg']).toBe('[Redacted] szerepel itt');
  });
});
