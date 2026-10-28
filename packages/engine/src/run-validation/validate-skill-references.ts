import type { AgentStepConfig } from '@easter-workflow-builder/db';
import type { Outcome } from '@easter-workflow-builder/core';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';
import type { ExecutableNodeConfig } from './executable-node-config.ts';

// A node agent lépés alobjektuma, vagy `undefined`, ha a node nem futtat agent
// lépést: az `agent_step` maga, a `join` `ai_synthesis` módja a `settings`
// mezőjében (SPEC-004 5. szekció táblázatának 2. és 5. sora).
function agentStepConfigOf(config: ExecutableNodeConfig): AgentStepConfig | undefined {
  if (config.type === 'agent_step') {
    return config;
  }
  if (config.type === 'join' && config.mode === 'ai_synthesis') {
    return config.settings;
  }
  return undefined;
}

/**
 * A futás indítási ellenőrzése a lépések `skills` listájára (SPEC-009 5.1,
 * O-13 (b)): a lista minden puszta neve a skill könyvtárban áll, különben
 * `skill_not_found` hiba, a csomópont és a hiányzó skill nevével.
 *
 * A `null` (nincs beállítva) és az `'all'` (minden feltöltött skill) állapotnak
 * nincs hiányzó eleme, ezért csak a lista ág ellenőrzött. Az ellenőrzés kell,
 * mert az SDK a nem létező, de érvényes alakú névre nem ad indítási hibát, a
 * hívás csak futás közben "Unknown skill" (M-136 5a,
 * `docs/research/2026-10-28-spec-009-blokkolo-meresek.md` 2. szekció 8. pont).
 *
 * A SPEC-004 4.8 3. lépésében fut, a `validateRun` után, tehát egyetlen
 * adatbázis sort sem ír; az első hibánál megáll, ugyanazzal az indokkal, mint
 * a `validateRun`.
 */
export function validateSkillReferences(
  configsById: ReadonlyMap<string, ExecutableNodeConfig>,
  availableSkillNames: readonly string[],
): Outcome<void> {
  const available = new Set(availableSkillNames);
  for (const [nodeId, config] of configsById) {
    const skills = agentStepConfigOf(config)?.skills;
    if (typeof skills !== 'object' || skills === null) {
      continue;
    }
    const missing = skills.find((name) => !available.has(name));
    if (missing !== undefined) {
      return {
        kind: 'error',
        message: formatEngineErrorMessage(
          'skill_not_found',
          `A(z) ${nodeId} csomópont a(z) "${missing}" skillre hivatkozik, ami nincs a skill könyvtárban`,
        ),
      };
    }
  }
  return { kind: 'ok', value: undefined };
}
