// Minimális MCP szerver logika (JSON-RPC 2.0), a stdio és a http csonk közös válaszadója: `initialize`,
// `tools/list` egyetlen `ping` eszközzel, `tools/call`; az értesítésre nincs válasz, más metódusra
// `-32601`. A `@modelcontextprotocol/sdk` nincs a repó egyetlen csomagjának függőségei között sem.
export function valaszol(uzenet, szerverNev) {
  if (uzenet.id === undefined) return undefined;
  const ok = (result) => ({ jsonrpc: '2.0', id: uzenet.id, result });
  switch (uzenet.method) {
    case 'initialize':
      return ok({
        protocolVersion: uzenet.params?.protocolVersion ?? '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: szerverNev, version: '0.0.1' },
      });
    case 'tools/list':
      return ok({
        tools: [{ name: 'ping', description: 'Mérő eszköz.', inputSchema: { type: 'object', properties: {} } }],
      });
    case 'tools/call':
      return ok({ content: [{ type: 'text', text: `pong ${szerverNev}` }] });
    case 'ping':
      return ok({});
    default:
      return { jsonrpc: '2.0', id: uzenet.id, error: { code: -32601, message: 'Method not found' } };
  }
}
