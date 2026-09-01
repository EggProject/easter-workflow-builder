import { describe, expect, it } from 'vitest';
import { joinAriaTokenList } from './join-aria-token-list.ts';

describe('joinAriaTokenList', () => {
  it('érték nélkül undefined értéket ad', () => {
    expect(joinAriaTokenList()).toBeUndefined();
  });

  it('csupa undefined elemre undefined értéket ad', () => {
    expect(joinAriaTokenList(undefined, undefined)).toBeUndefined();
  });

  it('üres és csak szóközből álló sztringre undefined értéket ad', () => {
    expect(joinAriaTokenList('', ' '.repeat(3))).toBeUndefined();
  });

  it('egyetlen azonosítót változatlanul ad vissza', () => {
    expect(joinAriaTokenList('sugo')).toBe('sugo');
  });

  it('két azonosítót szóközzel fűz össze, a megadás sorrendjében', () => {
    expect(joinAriaTokenList('sugo', 'nev-error')).toBe('sugo nev-error');
  });

  it('a több azonosítót tartalmazó értéket felbontja', () => {
    expect(joinAriaTokenList('egy ketto', 'harom')).toBe('egy ketto harom');
  });

  it('a duplikátumot eldobja, az első előfordulás helyén tartva', () => {
    expect(joinAriaTokenList('nev-error sugo', 'nev-error')).toBe('nev-error sugo');
  });

  it('a felesleges szóközöket normalizálja', () => {
    expect(joinAriaTokenList('  egy   ketto  ', undefined)).toBe('egy ketto');
  });
});
