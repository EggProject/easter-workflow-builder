/**
 * **Fordítási idejű teszt**, nem futásidejű állítás. A `WellFormedNodeConfig`
 * garanciája típusszintű (SPEC-008 O-33, SPEC-004 4.7): a választatlan `join`
 * ágat (`mode: null`) kiveszi az unióból, tehát a `join` módjain futó kimerítő
 * `switch` szerkezetben nem keletkezik sosem futó `case null`. A
 * `@ts-expect-error` direktíva akkor **bukik**, ha a megjelölt sor mégis
 * lefordul ("Unused '@ts-expect-error' directive"), tehát a `bun run typecheck`
 * kapu pirosra vált, amikor a választatlan ág visszakerül az unióba.
 *
 * A két `script` jellegű ág a SPEC-014 5.8 óta végrehajtható, tehát az unió
 * része (research `2026-11-04-szkript-csomopont.md` 7.1); a teszt ezt is rögzíti.
 *
 * Ez az egyetlen `.spec.ts` a repóban egy típus-only fájl mellett. A konvenció
 * szerint típus-only fájlhoz nem készül teszt (SPEC-002 6.3), de itt pontosan a
 * típus a viselkedés, amit őrizni kell.
 */
import { describe, expect, it } from 'vitest';
import type {
  JoinScriptNodeConfig,
  JoinUnselectedNodeConfig,
  NodeConfig,
  ScriptNodeConfig,
} from '@easter-workflow-builder/db';
import type { WellFormedNodeConfig } from './well-formed-node-config.ts';

// A bizonyíték hordozója: a paramétere pontosan az a szűkített unió, amit a
// `validateRun` sikeres ága ad vissza, és amit a végrehajtó diszpécser kap.
function acceptsWellFormedNodeConfig(config: WellFormedNodeConfig): string {
  return config.type;
}

const SCRIPT_CONFIG: ScriptNodeConfig = {
  type: 'script',
  source: 'items.length',
  runtime: 'expression',
  onUnhandledError: 'fail_run',
};

const JOIN_SCRIPT_CONFIG: JoinScriptNodeConfig = {
  type: 'join',
  mode: 'script',
  settings: { source: 'inputs.length', runtime: 'expression' },
  onUnhandledError: 'fail_run',
};

// eslint-disable-next-line unicorn/no-null -- a választatlan join `mode` mezője a tárolt alakban ténylegesen `null` (SPEC-008 O-33).
const JOIN_UNSELECTED_CONFIG: JoinUnselectedNodeConfig = { type: 'join', mode: null, onUnhandledError: 'fail_run' };

describe('WellFormedNodeConfig', () => {
  it('a választatlan join ágat (mode: null) a fordító elutasítja', () => {
    // @ts-expect-error a `WellFormedNodeConfig` a `mode: null` ágat kivette (SPEC-008 O-33)
    const rejected: WellFormedNodeConfig = JOIN_UNSELECTED_CONFIG;

    expect(rejected.type).toBe('join');
    expect(JOIN_UNSELECTED_CONFIG.mode).toBeNull();
  });

  it('a választatlan join ág paraméter pozícióban sem adható át', () => {
    // @ts-expect-error ugyanaz a szűkítés paraméter pozícióban is véd
    expect(acceptsWellFormedNodeConfig(JOIN_UNSELECTED_CONFIG)).toBe('join');
  });

  it('a script node és a join script módja az unió része (SPEC-014 5.8)', () => {
    expect(acceptsWellFormedNodeConfig(SCRIPT_CONFIG)).toBe('script');
    expect(acceptsWellFormedNodeConfig(JOIN_SCRIPT_CONFIG)).toBe('join');
  });

  it('az unió a NodeConfig része marad', () => {
    const start: WellFormedNodeConfig = { type: 'start', inputFields: [], onUnhandledError: 'fail_run' };
    const widened: NodeConfig = start;

    expect(acceptsWellFormedNodeConfig(start)).toBe('start');
    expect(widened.type).toBe('start');
  });
});
