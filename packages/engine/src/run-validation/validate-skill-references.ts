import type { Outcome } from '@easter-workflow-builder/core';
import type { AgentStepConfig } from '@easter-workflow-builder/db';
import { parseAgentDefinition } from '../agent-definition/parse-agent-definition.ts';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';
import { agentStepConfigOf } from './agent-step-config-of.ts';
import type { ExecutableNodeConfig } from './executable-node-config.ts';

/**
 * Egy tárolt `skills` mező első, a skill könyvtárban nem álló neve. A `null`
 * (nincs beállítva) és az `'all'` (minden feltöltött skill) állapotnak nincs
 * hiányzó eleme; az `undefined` az érvénytelen alakú agent definíció, amit a
 * `validateMcpServerReferences` utasít el (`resolveOutgoingAgents`).
 */
function firstMissingSkill(
  skills: AgentStepConfig['skills'] | undefined,
  available: ReadonlySet<string>,
): string | undefined {
  if (typeof skills !== 'object' || skills === null) {
    return undefined;
  }
  return skills.find((name) => !available.has(name));
}

function skillNotFound(subject: string, missing: string): Outcome<void> {
  return {
    kind: 'error',
    message: formatEngineErrorMessage(
      'skill_not_found',
      `${subject} a(z) "${missing}" skillre hivatkozik, ami nincs a skill könyvtárban`,
    ),
  };
}

/**
 * A futás indítási ellenőrzése a lépések és az agent definícióik `skills`
 * listájára (SPEC-009 5.1, 5.2, O-13 (b)): a lista minden puszta neve a skill
 * könyvtárban áll, különben `skill_not_found` hiba, a csomópont (és az agent
 * definíció) és a hiányzó skill nevével.
 *
 * Az ellenőrzés kell, mert az SDK a nem létező, de érvényes alakú névre nem ad
 * indítási hibát: a lépés `skills` listáján a hívás csak futás közben "Unknown
 * skill" (M-136 5a), az agent definíció listáján a nem létező és az
 * érvénytelen alakú név is csendben kimarad (M-147 A6, A7;
 * `docs/research/2026-10-28-spec-009-blokkolo-meresek.md` 2. és 5. szekció).
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
    const agentStep = agentStepConfigOf(config);
    if (agentStep === undefined) {
      continue;
    }
    const stepMissing = firstMissingSkill(agentStep.skills, available);
    if (stepMissing !== undefined) {
      return skillNotFound(`A(z) ${nodeId} csomópont`, stepMissing);
    }
    for (const [agentName, definition] of Object.entries(agentStep.agents)) {
      const agentMissing = firstMissingSkill(parseAgentDefinition(definition)?.skills, available);
      if (agentMissing !== undefined) {
        return skillNotFound(`A(z) ${nodeId} csomópont "${agentName}" agent definíciója`, agentMissing);
      }
    }
  }
  return { kind: 'ok', value: undefined };
}
