import { describe, expect, it } from 'vitest';
import type { BranchContext } from '../branch-scope/branch-scope.ts';
import { buildScopedKey } from './build-scoped-key.ts';

const ROOT: BranchContext = [];
const FAN_OUT_ZERO: BranchContext = [{ kind: 'fan_out', stepRunId: 'sr-f', itemIndex: 0 }];
const FAN_OUT_ONE: BranchContext = [{ kind: 'fan_out', stepRunId: 'sr-f', itemIndex: 1 }];
const LOOP_ZERO: BranchContext = [{ kind: 'loop', stepRunId: 'sr-l', iteration: 0 }];

describe('buildScopedKey', () => {
  it('ugyanaz az azonosító és kontextus mindig ugyanazt a kulcsot adja', () => {
    expect(buildScopedKey('e1', FAN_OUT_ZERO)).toBe(buildScopedKey('e1', FAN_OUT_ZERO));
  });

  it('a gyökér kontextus és a nyitott hatókör két különböző kulcs', () => {
    expect(buildScopedKey('e1', ROOT)).not.toBe(buildScopedKey('e1', FAN_OUT_ZERO));
  });

  it('a fan_out elem sorszáma elválasztja a kulcsokat', () => {
    expect(buildScopedKey('e1', FAN_OUT_ZERO)).not.toBe(buildScopedKey('e1', FAN_OUT_ONE));
  });

  it('az azonos sorszámú fan_out és loop keret nem mosódik össze', () => {
    expect(buildScopedKey('e1', FAN_OUT_ZERO)).not.toBe(buildScopedKey('e1', LOOP_ZERO));
  });

  it('a hatókört nyitó lépés futásának azonosítója elválasztja a kereteket', () => {
    const masikFanOut: BranchContext = [{ kind: 'fan_out', stepRunId: 'sr-masik', itemIndex: 0 }];

    expect(buildScopedKey('e1', FAN_OUT_ZERO)).not.toBe(buildScopedKey('e1', masikFanOut));
  });

  it('a keretek sorrendje számít', () => {
    const kivulFanOut: BranchContext = [...FAN_OUT_ZERO, ...LOOP_ZERO];
    const kivulLoop: BranchContext = [...LOOP_ZERO, ...FAN_OUT_ZERO];

    expect(buildScopedKey('e1', kivulFanOut)).not.toBe(buildScopedKey('e1', kivulLoop));
  });

  it('két különböző azonosító azonos kontextusban két kulcs', () => {
    expect(buildScopedKey('e1', ROOT)).not.toBe(buildScopedKey('e2', ROOT));
  });

  it('az azonosítóban álló elválasztó jellegű karakter nem mos össze két kulcsot', () => {
    expect(buildScopedKey('a","b', ROOT)).not.toBe(buildScopedKey('a', ROOT) + buildScopedKey('b', ROOT));
  });
});
