import { describe, expect, it } from 'vitest';
import { createNoopEventPublisher } from './create-noop-event-publisher.ts';

describe('createNoopEventPublisher', () => {
  it('a publish hívás nem dob és nem ad vissza semmit', () => {
    const publisher = createNoopEventPublisher();
    expect(() => {
      publisher.publish({ kind: 'run_started' });
    }).not.toThrow();
  });
});
