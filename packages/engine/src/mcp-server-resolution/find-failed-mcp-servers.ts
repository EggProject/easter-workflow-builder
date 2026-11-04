import { isRecord, isString } from '@easter-workflow-builder/typeguards';

// Az SDK `McpServerStatus.status` értékei közül ezek jelentik, hogy a szerver nem csatlakozott és nem
// is fog magától (telepített `sdk.d.ts` `McpServerStatus`); a `pending` nem ide tartozik (O-46).
const FAILED_STATUSES: ReadonlySet<string> = new Set(['failed', 'needs-auth']);

/**
 * A `system` `init` üzenet `mcp_servers` tömbjéből (`{ name, status }`, `sdk.d.ts`
 * `SDKSystemMessage`) a lépés által kiadott szerverek közül azok neve, amelyek nem csatlakoztak
 * (SPEC-009 6.4, O-46, user döntés 2026-10-28). A nem kiadott név (a CLI saját szervere) és a nem
 * várt alakú elem nem számít. Mérve: a pinelt CLI az `init` előtt bevárja a kapcsolódást, és a nem
 * létező parancsú vagy lezárt portú szerver `failed` állapottal áll a tömbben (M-139 1., 2. pont,
 * M-148); hogy az `init` minden környezetben a végleges állapotot hordozza-e, nem ellenőrzött.
 */
export function findFailedMcpServers(initMessage: unknown, outgoingNames: readonly string[]): readonly string[] {
  if (!isRecord(initMessage) || !Array.isArray(initMessage['mcp_servers'])) {
    return [];
  }
  const servers: readonly unknown[] = initMessage['mcp_servers'];
  const expected = new Set(outgoingNames);
  return servers.flatMap((server) =>
    isRecord(server) &&
    isString(server['name']) &&
    isString(server['status']) &&
    expected.has(server['name']) &&
    FAILED_STATUSES.has(server['status'])
      ? [server['name']]
      : [],
  );
}
