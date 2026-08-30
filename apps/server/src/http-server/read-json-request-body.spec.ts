import { describe, expect, it } from 'vitest';
import { readJsonRequestBody } from './read-json-request-body.ts';

function asyncIterableOf(chunks: readonly unknown[]): AsyncIterable<unknown> {
  return {
    [Symbol.asyncIterator]() {
      let index = 0;
      return {
        next(): Promise<IteratorResult<unknown>> {
          if (index < chunks.length) {
            const value = chunks[index];
            index += 1;
            return Promise.resolve({ done: false, value });
          }
          return Promise.resolve({ done: true, value: undefined });
        },
      };
    },
  };
}

describe('readJsonRequestBody', () => {
  it('üres törzsre undefined értéket ad sikerként', async () => {
    const outcome = await readJsonRequestBody(asyncIterableOf([]));
    expect(outcome).toStrictEqual({ kind: 'ok', value: undefined });
  });

  it('csak whitespace törzsre is undefined értéket ad', async () => {
    const outcome = await readJsonRequestBody(asyncIterableOf([Buffer.from('   \n  ')]));
    expect(outcome).toStrictEqual({ kind: 'ok', value: undefined });
  });

  it('érvényes JSON törzset objektumként ad vissza, több darabra bontva is', async () => {
    const outcome = await readJsonRequestBody(asyncIterableOf([Buffer.from('{"name":'), Buffer.from('"teszt"}')]));
    expect(outcome).toStrictEqual({ kind: 'ok', value: { name: 'teszt' } });
  });

  it('nem Buffer darabot figyelmen kívül hagy', async () => {
    const outcome = await readJsonRequestBody(asyncIterableOf(['nem buffer', Buffer.from('{"a":1}')]));
    expect(outcome).toStrictEqual({ kind: 'ok', value: { a: 1 } });
  });

  it('rosszul formázott JSON-ra invalid_request hibaosztályú hibát ad, a nyers törzs nélkül', async () => {
    const outcome = await readJsonRequestBody(asyncIterableOf([Buffer.from('{nem json')]));
    expect(outcome.kind).toBe('error');
    expect(outcome.kind === 'error' && outcome.message).toContain('(invalid_request)');
    expect(outcome.kind === 'error' && outcome.message).not.toContain('nem json');
  });
});
