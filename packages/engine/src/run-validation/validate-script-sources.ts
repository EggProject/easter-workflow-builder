import type { Outcome } from '@easter-workflow-builder/core';
import type { ScriptConfig } from '@easter-workflow-builder/db';
import type { ScriptRunnerPort } from '../engine-port/script-runner-port.ts';
import type { WellFormedNodeConfig } from './well-formed-node-config.ts';

/**
 * Egy fordítandó JavaScript forrás: a csomópont, a `config`-on belüli,
 * ponttal összefűzött mező útvonala és a szöveg.
 */
interface JavaScriptSource {
  readonly nodeId: string;
  readonly field: string;
  readonly source: string;
}

function javaScriptSourceOf(nodeId: string, script: ScriptConfig, field: string): readonly JavaScriptSource[] {
  return script.runtime === 'javascript' ? [{ nodeId, field, source: script.source }] : [];
}

// A `script` node `source` mezője és a `join` `script` módjának
// `settings.source` mezője, ha a `runtime` JavaScript; a CEL ágat a
// `validateLanguageFields` fordítja.
function javaScriptSourcesOf(nodeId: string, config: WellFormedNodeConfig): readonly JavaScriptSource[] {
  if (config.type === 'script') {
    return javaScriptSourceOf(nodeId, config, 'source');
  }
  if (config.type === 'join' && config.mode === 'script') {
    return javaScriptSourceOf(nodeId, config.settings, 'settings.source');
  }
  return [];
}

/**
 * A futás indítási ellenőrzése a JavaScript szkript forrásokra (SPEC-014 5.7,
 * 5.8): minden JavaScript `source` lefordítható a `scriptRunner.compile`
 * hívással, futtatás nélkül, különben `script_compile_failed` hiba (a REST
 * válaszban 422, a meglévő motor validációs úton). A fordítás saját, eldobott
 * modulon fut, ezért aszinkron (research `2026-11-04-szkript-csomopont.md` 7.3);
 * a források egymás után fordulnak, és az első hibánál megáll, ugyanazzal az
 * indokkal, mint a `validateRun`.
 *
 * A port hibaüzenete a SPEC-014 szerint teljes mondat, a végén a zárójeles
 * hibaosztállyal (`script-runner-port.ts`); a motor a csomópontot és a mezőt
 * nevezi meg előtte, a forrás szövegét nem idézi (SPEC-010 9.5 mintája).
 * Adatbázist nem ír.
 */
export async function validateScriptSources(
  configsById: ReadonlyMap<string, WellFormedNodeConfig>,
  scriptRunner: Pick<ScriptRunnerPort, 'compile'>,
): Promise<Outcome<void>> {
  const sources = [...configsById].flatMap(([nodeId, config]) => javaScriptSourcesOf(nodeId, config));
  for (const { nodeId, field, source } of sources) {
    const compiled = await scriptRunner.compile(source);
    if (compiled.kind === 'error') {
      return {
        kind: 'error',
        message: `A(z) ${nodeId} csomópont ${field} mezője nem fordítható le. ${compiled.message}`,
      };
    }
  }
  return { kind: 'ok', value: undefined };
}
