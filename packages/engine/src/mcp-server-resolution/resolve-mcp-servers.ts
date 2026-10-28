import type {
  AgentStepConfig,
  McpServerDefinition,
  McpServerDefinitionRecord,
  McpServerReference,
} from '@easter-workflow-builder/db';
import type { ProcessEnvironmentPort } from '../engine-port/process-environment-port.ts';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';
import type { OutgoingMcpServer } from './outgoing-mcp-server.ts';

/**
 * A `resolveMcpServers` eredménye. A hibaág a hibaosztályt külön mezőben is
 * hordozza, mert a két hívó más úton jelzi: a futás indítási ellenőrzése az
 * üzenetet adja tovább, a lépés futtatása a hibaosztállyal zárja a lépést.
 */
export type McpServerResolution =
  | { readonly kind: 'ok'; readonly value: Readonly<Record<string, OutgoingMcpServer>> }
  | {
      readonly kind: 'error';
      readonly errorKind: 'mcp_server_not_found' | 'missing_mcp_server_env';
      readonly message: string;
    };

type McpServerResolutionError = Extract<McpServerResolution, { readonly kind: 'error' }>;

/**
 * Egy rekord saját bejegyzése. A kulcsok env változó nevek, és a POSIX név
 * alak (`constructor`, `__proto__`) az `Object.prototype` neveit is
 * megengedi, ezért a sima indexelés egy örökölt tulajdonságot adna vissza.
 */
function ownEntry(record: Readonly<Record<string, string>>, key: string): string | undefined {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

function missingEnvironment(
  subject: string,
  serverName: string,
  target: string,
  environmentName: string,
): McpServerResolutionError {
  return {
    kind: 'error',
    errorKind: 'missing_mcp_server_env',
    message: formatEngineErrorMessage(
      'missing_mcp_server_env',
      `${subject} "${serverName}" MCP szerverének ${target} rendelt "${environmentName}" szerver oldali env változó nincs beállítva`,
    ),
  };
}

/**
 * Egy hivatkozott szerver kimenő alakja (SPEC-009 6.4 táblázat). A szerver
 * oldali név feloldása deklarált változónként: (1) a lépés felülírása, (2) a
 * központi definíció alapértelmezett hozzárendelése, (3) a deklarált név
 * maga; a `sse` és a `http` ágon a lépés `authEnvName` mezője, ha nem `null`,
 * különben a központié. Az `Authorization` fejléc a változó teljes értéke,
 * előtag nélkül (6.4), `null` név mellett fejléc nélkül.
 */
function resolveServer(
  subject: string,
  serverName: string,
  definition: McpServerDefinition,
  reference: McpServerReference,
  processEnvironment: ProcessEnvironmentPort,
): McpServerResolutionError | { readonly kind: 'ok'; readonly value: OutgoingMcpServer } {
  if (definition.type === 'stdio') {
    const environmentEntries: (readonly [string, string])[] = [];
    for (const declaredName of definition.envNames) {
      const environmentName =
        ownEntry(reference.envBindings, declaredName) ?? ownEntry(definition.envBindings, declaredName) ?? declaredName;
      const value = processEnvironment.read(environmentName);
      if (value === null) {
        return missingEnvironment(subject, serverName, `"${declaredName}" változójához`, environmentName);
      }
      environmentEntries.push([declaredName, value]);
    }
    return {
      kind: 'ok',
      value: {
        type: 'stdio',
        command: definition.command,
        args: definition.args,
        env: Object.fromEntries(environmentEntries),
      },
    };
  }

  const environmentName = reference.authEnvName ?? definition.authEnvName;
  if (environmentName === null) {
    return { kind: 'ok', value: { type: definition.type, url: definition.url } };
  }
  const value = processEnvironment.read(environmentName);
  if (value === null) {
    return missingEnvironment(subject, serverName, 'Authorization fejlécéhez', environmentName);
  }
  return { kind: 'ok', value: { type: definition.type, url: definition.url, headers: { Authorization: value } } };
}

/**
 * A lépés `mcpServerReferences` mezőjének (SPEC-009 6.2, O-42 (b)) feloldása
 * a kimenő `mcpServers` opcióra, a központi definíciókból és a
 * `processEnvironment` portból (6.3, 6.4).
 *
 * - A mező hiánya és az üres rekord ugyanaz: üres eredmény.
 * - A központi listában nem álló névre `mcp_server_not_found` (O-43 (a): a
 *   hivatkozott definíció törölhető, a futás megnevezett hibával bukik).
 * - A porton `null`-t adó feloldott szerver oldali névre
 *   `missing_mcp_server_env` (O-18), a szerver, a deklarált hely és a
 *   szerver oldali név megnevezésével; az érték sosem kerül az üzenetbe.
 *
 * A `subject` az üzenet alanya: a lépésnél `A(z) <csomópont> csomópont`, az
 * agent definíciónál a csomópont és az agent neve (`resolveOutgoingAgents`).
 * Az agent definíció ugyanezt az alakú hivatkozás mezőt hordozza (SPEC-009
 * 6.2, M-147).
 *
 * A régi `mcpServers` mező nem bemenet: a motor nem képezi le (6.2). Az
 * eredmény objektum `Object.fromEntries` hívással épül, mert a név szabály a
 * `__proto__` nevet is engedi, egy értékadás pedig azt prototípusként
 * állítaná be, nem kulcsként.
 */
export function resolveMcpServers(
  subject: string,
  references: AgentStepConfig['mcpServerReferences'],
  definitions: readonly McpServerDefinitionRecord[],
  processEnvironment: ProcessEnvironmentPort,
): McpServerResolution {
  const definitionsByName = new Map(definitions.map((record) => [record.name, record.definition]));
  const servers: (readonly [string, OutgoingMcpServer])[] = [];
  const entries = references === undefined ? [] : Object.entries(references);
  for (const [serverName, reference] of entries) {
    const definition = definitionsByName.get(serverName);
    if (definition === undefined) {
      return {
        kind: 'error',
        errorKind: 'mcp_server_not_found',
        message: formatEngineErrorMessage(
          'mcp_server_not_found',
          `${subject} a(z) "${serverName}" MCP szerverre hivatkozik, ami nincs a központi MCP szerver listában`,
        ),
      };
    }
    const server = resolveServer(subject, serverName, definition, reference, processEnvironment);
    if (server.kind === 'error') {
      return server;
    }
    servers.push([serverName, server.value]);
  }
  return { kind: 'ok', value: Object.fromEntries(servers) };
}
