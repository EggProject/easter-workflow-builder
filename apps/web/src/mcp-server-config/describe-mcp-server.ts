import type { McpServerDefinition } from '@easter-workflow-builder/protocol';
import { readEnvironmentBinding } from './read-environment-binding.ts';

/**
 * Egy központi MCP szerver sorának két leíró sora a Beállítások kártyán
 * (SPEC-009 6.2): a típus és a `command` az `args` listával, illetve az
 * `url`; majd a deklarált változók az alapértelmezett hozzárendelésükkel,
 * illetve az `Authorization` fejlécet adó szerver oldali változó neve.
 * Kizárólag neveket ír ki, értéket soha.
 */
export function describeMcpServer(definition: McpServerDefinition): readonly [string, string] {
  switch (definition.type) {
    case 'stdio': {
      const bindings = definition.envNames.map((declaredName) => {
        const serverName = readEnvironmentBinding(definition.envBindings, declaredName);
        return serverName === '' ? declaredName : `${declaredName} ← ${serverName}`;
      });
      return [
        ['stdio:', definition.command, ...definition.args].join(' '),
        bindings.length === 0 ? 'Nincs deklarált környezeti változó.' : `Változók: ${bindings.join(', ')}`,
      ];
    }
    case 'sse':
    case 'http': {
      return [
        `${definition.type}: ${definition.url}`,
        definition.authEnvName === null
          ? 'Nincs Authorization fejléc.'
          : `Authorization fejléc: a(z) ${definition.authEnvName} változó értéke.`,
      ];
    }
  }
}
