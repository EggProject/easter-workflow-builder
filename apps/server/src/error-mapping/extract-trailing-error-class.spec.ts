import { describe, expect, it } from 'vitest';
import { extractTrailingErrorClass } from './extract-trailing-error-class.ts';

describe('extractTrailingErrorClass', () => {
  it('a záró zárójelben álló hibaosztályt adja, a záró pont előtt', () => {
    expect(extractTrailingErrorClass('A gráf kört tartalmaz (graph_cycle_detected).')).toBe('graph_cycle_detected');
  });

  it('záró pont nélkül is felismeri', () => {
    expect(extractTrailingErrorClass('hiba (foreign_key_violation)')).toBe('foreign_key_violation');
  });

  it('zárójel nélküli üzenetre undefined', () => {
    expect(extractTrailingErrorClass('nincs zárójeles hibaosztály')).toBeUndefined();
  });

  it('az üzenet eleji "A(z)" zárójelet nem veszi hibaosztálynak', () => {
    expect(extractTrailingErrorClass('A(z) "x" workflow nem található (not_found).')).toBe('not_found');
  });

  it('a szabad szövegben álló nevet nem ismeri fel, csak a záró zárójelet', () => {
    expect(extractTrailingErrorClass('a not_found szó itt szabad szövegben áll (egyeb_hiba).')).toBe('egyeb_hiba');
  });
});
