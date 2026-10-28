// Stdio MCP csonk. Indításkor a kapott környezet NEVEIT (és a `PATH`, `HOME`, a jelölő változók
// értékét, amik nem titkok) a `process.argv[2]` fájlba írja, utána soronkénti JSON-RPC-t szolgál ki. A
// `process.argv[3]` (elhagyható, M-147) a válaszban visszaadott szerver név; alapból `stdio-csonk`.
import { writeFileSync } from 'node:fs';
import readline from 'node:readline';
import { valaszol } from './mcp-jsonrpc.mjs';

const ERTEKKEL = ['PATH', 'HOME', 'DEKLARALT_VALTOZO', 'EASTER_PROBE_SECRET', 'CLAUDE_CONFIG_DIR'];
writeFileSync(
  process.argv[2],
  JSON.stringify({
    nevek: Object.keys(process.env).sort(),
    ertekek: Object.fromEntries(ERTEKKEL.filter((n) => process.env[n] !== undefined).map((n) => [n, process.env[n]])),
  }),
);

const sorok = readline.createInterface({ input: process.stdin });
sorok.on('line', (sor) => {
  let uzenet;
  try {
    uzenet = JSON.parse(sor);
  } catch {
    return;
  }
  const valasz = valaszol(uzenet, process.argv[3] ?? 'stdio-csonk');
  if (valasz !== undefined) process.stdout.write(`${JSON.stringify(valasz)}\n`);
});
