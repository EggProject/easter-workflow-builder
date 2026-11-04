import path from 'node:path';
import { isRecord, isString } from '@easter-workflow-builder/typeguards';

/**
 * A kimenő `Options` skill kiválasztása (SPEC-009 O-47): a skill könyvtár gyökere, a plugin neve és
 * a lépés kiválasztott skilljeinek könyvtárnevei.
 */
export interface PluginSkillSelection {
  readonly rootDirectory: string;
  readonly pluginName: string;
  readonly skillNames: readonly string[];
}

/**
 * A motor kimenő `Options` objektumából kiolvassa, melyik skill könyvtár mely skilljei kerülnének a
 * lépés elé. A motor nem `null` skill mezőnél pontosan egy `{ type: 'local', path }` plugint és egy
 * `<plugin>:<név>` alakú `skills` listát ad (`buildAgentStepOptions`), ahol a plugin neve a
 * manifeszt nélküli gyökér könyvtárneve (M-136 4a). Minden más alakra (például `plugins` nélkül)
 * `undefined`, és a hívó az `Options`-t változatlanul adja tovább.
 */
export function readPluginSkillSelection(options: Readonly<Record<string, unknown>>): PluginSkillSelection | undefined {
  const plugins = options['plugins'];
  const skills = options['skills'];
  if (!Array.isArray(plugins) || plugins.length !== 1 || !Array.isArray(skills)) {
    return undefined;
  }
  const plugin: unknown = plugins[0];
  if (!isRecord(plugin) || plugin['type'] !== 'local' || !isString(plugin['path'])) {
    return undefined;
  }
  const rootDirectory = plugin['path'];
  const pluginName = path.basename(rootDirectory);
  const prefix = `${pluginName}:`;
  const skillNames = skills
    .filter(isString)
    .filter((name) => name.startsWith(prefix))
    .map((name) => name.slice(prefix.length));
  return { rootDirectory, pluginName, skillNames };
}
