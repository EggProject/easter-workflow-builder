/**
 * **Fordítási idejű teszt**, nem futásidejű állítás. Az `ExecutableNodeConfig`
 * garanciája típusszintű (SPEC-004 4.7), ezért a regressziót csak a fordító
 * tudja elkapni: a `@ts-expect-error` direktíva akkor **bukik**, ha a
 * megjelölt sor mégis lefordul ("Unused '@ts-expect-error' directive"), tehát
 * a `bun run typecheck` kapu pirosra vált abban a pillanatban, amikor a
 * `script` ágak visszakerülnek az unióba.
 *
 * Ez az egyetlen `.spec.ts` a repóban egy típus-only fájl mellett. A
 * konvenció szerint típus-only fájlhoz nem készül teszt (SPEC-002 6.3), de itt
 * pontosan a típus a viselkedés, amit őrizni kell; az itt álló `expect`
 * hívások csak azt mutatják meg, hogy a fordító által elutasított érték
 * futásidőben létező, valódi `script` config.
 */
import { describe, expect, it } from 'vitest';
import type { JoinScriptNodeConfig, NodeConfig, ScriptNodeConfig } from '@easter-workflow-builder/db';
import type { ExecutableNodeConfig } from './executable-node-config.ts';

// A bizonyíték hordozója: a paramétere pontosan az a szűkített unió, amit a
// `validateRun` sikeres ága ad vissza, és amit a végrehajtó diszpécser kap
// majd (`node-executor` téma, T-005-20).
function acceptsExecutableNodeConfig(config: ExecutableNodeConfig): string {
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

describe('ExecutableNodeConfig', () => {
  it('a ScriptNodeConfig ágat a fordító elutasítja', () => {
    // @ts-expect-error a `ScriptNodeConfig` ágat az `Exclude` kiveszi az unióból (SPEC-004 4.7)
    const rejected: ExecutableNodeConfig = SCRIPT_CONFIG;

    expect(rejected.type).toBe('script');
  });

  it('a JoinScriptNodeConfig ágat a fordító elutasítja', () => {
    // @ts-expect-error a `join` node `script` módját is kiveszi az `Exclude` (SPEC-004 4.7)
    const rejected: ExecutableNodeConfig = JOIN_SCRIPT_CONFIG;

    expect(rejected.type).toBe('join');
    expect(JOIN_SCRIPT_CONFIG.mode).toBe('script');
  });

  it('a script node configja a végrehajtható configot váró függvénynek sem adható át', () => {
    // @ts-expect-error ugyanaz a szűkítés paraméter pozícióban is véd
    expect(acceptsExecutableNodeConfig(SCRIPT_CONFIG)).toBe('script');
  });

  it('a végrehajtható ágak átmennek, és az unió a NodeConfig része marad', () => {
    const start: ExecutableNodeConfig = { type: 'start', inputFields: [], onUnhandledError: 'fail_run' };
    const widened: NodeConfig = start;

    expect(acceptsExecutableNodeConfig(start)).toBe('start');
    expect(widened.type).toBe('start');
  });
});
