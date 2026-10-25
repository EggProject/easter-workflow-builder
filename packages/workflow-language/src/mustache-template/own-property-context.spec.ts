import { describe, expect, it } from 'vitest';
import { OwnPropertyContext } from './own-property-context.ts';

// A `unicorn/no-null` miatt a JSON `null` értéket elemzés adja.
const jsonNull: unknown = JSON.parse('null');

describe('OwnPropertyContext', () => {
  const root = new OwnPropertyContext({ input: { tema: 'a', semmi: jsonNull }, kozos: 'gyoker' });

  it('a pontozott nevet saját adat tulajdonságon át oldja fel', () => {
    expect(root.lookup('input.tema')).toBe('a');
    expect(root.lookup('input.semmi')).toBeNull();
  });

  it('a hiányzó név undefined', () => {
    expect(root.lookup('input.nincs')).toBeUndefined();
    expect(root.lookup('toString')).toBeUndefined();
  });

  it('a push ugyanezt az osztályt adja, és a szülő kontextus bejárható', () => {
    const child = root.push({ sajat: 'gyerek' });
    expect(child).toBeInstanceOf(OwnPropertyContext);
    expect(child.lookup('sajat')).toBe('gyerek');
    expect(child.lookup('kozos')).toBe('gyoker');
    expect(child.lookup('input.tema')).toBe('a');
    expect(child.lookup('constructor')).toBeUndefined();
  });

  it('a . név a saját nézet, szülő bejárás nélkül', () => {
    expect(root.push('elem').lookup('.')).toBe('elem');
    expect(root.push(undefined).lookup('.')).toBeUndefined();
  });

  it('a függvény nézetet a . név sem adja ki', () => {
    expect(root.push(() => 'x').lookup('.')).toBeUndefined();
  });
});
