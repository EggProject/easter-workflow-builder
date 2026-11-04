// A VALÓDI PRÓBA SKILL ÉS MCP MÓDJÁNAK STDIO MCP SZERVERE (SPEC-009 T-012-12a): soronkénti JSON-RPC 2.0,
// `initialize`, `tools/list` egyetlen `ping` eszközzel, `tools/call`; az értesítésre nincs válasz, más
// metódusra `-32601`. A `docs/research/2026-10-28-spec-009-blokkolo-meresek/mcp-jsonrpc.mjs` csonk
// mintája; a `@modelcontextprotocol/sdk` nincs a repó függőségei között. Környezetet nem olvas és nem ír.
import process from 'node:process';
import readline from 'node:readline';
import { isRecord } from '@easter-workflow-builder/typeguards';

function answer(message: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> | undefined {
  const id = message['id'];
  if (id === undefined) {
    return undefined;
  }
  const ok = (result: unknown): Readonly<Record<string, unknown>> => ({ jsonrpc: '2.0', id, result });
  const parameters = message['params'];
  switch (message['method']) {
    case 'initialize': {
      return ok({
        protocolVersion: isRecord(parameters) ? parameters['protocolVersion'] : undefined,
        capabilities: { tools: {} },
        serverInfo: { name: 'proba-mcp', version: '0.0.1' },
      });
    }
    case 'tools/list': {
      return ok({
        tools: [{ name: 'ping', description: 'Próba eszköz.', inputSchema: { type: 'object', properties: {} } }],
      });
    }
    case 'tools/call': {
      return ok({ content: [{ type: 'text', text: 'pong' }] });
    }
    case 'ping': {
      return ok({});
    }
    default: {
      return { jsonrpc: '2.0', id, error: { code: -32_601, message: 'Method not found' } };
    }
  }
}

const lines = readline.createInterface({ input: process.stdin });
lines.on('line', (line) => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return;
  }
  const reply = isRecord(parsed) ? answer(parsed) : undefined;
  if (reply !== undefined) {
    process.stdout.write(`${JSON.stringify(reply)}\n`);
  }
});
