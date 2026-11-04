import { isRecord, isString, isStringArray, isStringRecord } from '@easter-workflow-builder/typeguards';
import { buildStdioLaunch } from './build-stdio-launch.ts';

// A motor kimenő stdio alakja (`OutgoingMcpServer` stdio ága, SPEC-009 6.4): a `type` mindig
// `'stdio'`, az `env` kulcsai a definíció deklarált nevei.
function wrapServer(server: unknown): unknown {
  if (!isRecord(server) || server['type'] !== 'stdio') {
    return server;
  }
  const { command, args, env } = server;
  if (!isString(command) || !isStringArray(args) || !isStringRecord(env)) {
    return server;
  }
  return { ...server, ...buildStdioLaunch(command, args, Object.keys(env)) };
}

/**
 * Egy `mcpServers` rekord minden stdio elemét az indító programon át futtatja (O-45): a gyerek csak a
 * szerver `env` mezőjének neveit, a `PATH` és a `HOME` változót kapja. A nem stdio elem és a nem
 * rekord érték változatlan. Az eredmény `Object.fromEntries` hívással épül, mert a szerver név
 * `__proto__` is lehet (a `resolveMcpServers` mintája).
 */
export function wrapStdioServers(servers: unknown): unknown {
  if (!isRecord(servers)) {
    return servers;
  }
  return Object.fromEntries(Object.entries(servers).map(([name, server]) => [name, wrapServer(server)]));
}
