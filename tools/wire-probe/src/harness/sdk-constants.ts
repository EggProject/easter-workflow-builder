/**
 * A telepített @anthropic-ai/claude-agent-sdk@0.3.245 típusdefiníciójából
 * (node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts) kiolvasott, tényleges
 * enumok. SPEC-000 4. szekció: "Tippelni tilos, a kiolvasott értékek a
 * meta.json-ba kerülnek." -- ezért minden érték mellett a forrás sorszáma.
 *
 * A konstansokat szándékosan az SDK saját exportált típusaira (`EffortLevel`,
 * `ThinkingAdaptive`, `ThinkingDisabled`, `PermissionMode`) annotáljuk, hogy a
 * literál mezők típuskényszerítés (`as`) nélkül, kontextuson keresztül
 * szűküljenek a helyes literálra.
 */
import type { EffortLevel, PermissionMode, ThinkingAdaptive, ThinkingDisabled } from '@anthropic-ai/claude-agent-sdk';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(moduleDir, '..', '..');

/** Options.effort enum, sdk.d.ts:576 (`EffortLevel`) és sdk.d.ts:1711 (`Options.effort`). */
export const EFFORT_LOWEST: EffortLevel = 'low';
export const EFFORT_HIGHEST: EffortLevel = 'max';

/**
 * Options.thinking (`ThinkingConfig`), sdk.d.ts:8106-8132. Három alak van:
 * `{ type: 'adaptive', display? }`, `{ type: 'enabled', budgetTokens?, display? }`,
 * `{ type: 'disabled' }`. A M-05/M-06 esetek csak az adaptive/disabled alakot
 * használják.
 */
export const THINKING_ADAPTIVE: ThinkingAdaptive = { type: 'adaptive' };
export const THINKING_DISABLED: ThinkingDisabled = { type: 'disabled' };

/**
 * Options.permissionMode, sdk.d.ts:2196. A promptot nem nyitó, de a toolt
 * ténylegesen ENGEDÉLYEZŐ mód: 'dontAsk' nem kérdez, de meg is TAGADJA az elő
 * nem jóváhagyott toolokat, tehát az M-03, M-09, M-10, M-17 esetekben, ahol
 * egy in-process toolnak tényleg le kell futnia, a 'bypassPermissions' a
 * helyes választás -- ehhez az SDK megköveteli az
 * `allowDangerouslySkipPermissions: true` együttes beállítást (sdk.d.ts:1795-1798).
 */
export const NON_PROMPTING_TOOL_ALLOWING_PERMISSION_MODE: PermissionMode = 'bypassPermissions';

/**
 * FONTOS, ellenőrzött hiánycikk: a telepített SDK Options típusában NINCS
 * közvetlen "max kimenő token" mező (nincs `maxOutputTokens`, `max_tokens` a
 * query() Options-ban). A talált, output-limitáláshoz köthető mezők:
 * - `maxTurns` (kör-korlát, ezt használja a SPEC-000 közös alapbeállítása),
 * - `maxBudgetUsd` (USD alapú, kliens oldali leállás, sdk.d.ts:1727-1730),
 * - `taskBudget` (alpha, TOKEN alapú, de `output_config.task_budget` mezőt és
 *   `task-budgets-2026-03-13` beta headert küld ki a dróton, sdk.d.ts:1731-1739)
 *   -- ez éppen azt az `output_config` mezőt szennyezné be minden kérésbe, aminek
 *   a MEGJELENÉSÉT a Q3 méri (SPEC-000 3. szekció), ezért a mérési harness
 *   nem használja alapértelmezésként.
 * A tényleges költségvédelem ezért `maxTurns` (SPEC-000 szerint 1) plusz a
 * runner.ts saját, AbortController-alapú falóra-időkorlátja (WIRE_PROBE_TIMEOUT_MS).
 */

/** A telepített SDK pontos verziója a saját package.json-jából, találgatás nélkül. */
export function readInstalledSdkVersion(): string {
  const pkgPath = join(packageRoot, 'node_modules', '@anthropic-ai', 'claude-agent-sdk', 'package.json');
  const raw = readFileSync(pkgPath, 'utf8');
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed === 'object' && parsed !== null && 'version' in parsed) {
    const { version } = parsed;
    if (typeof version === 'string') {
      return version;
    }
  }
  throw new Error(`Nem sikerült kiolvasni az SDK verzióját innen: ${pkgPath}`);
}
