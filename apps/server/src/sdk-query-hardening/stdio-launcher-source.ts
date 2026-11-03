/**
 * A stdio MCP szerver indító programjának forrása (SPEC-009 6.4, O-45, user döntés 2026-10-28): a
 * CLI a stdio szervert a saját teljes környezetével indítja, és erre írja rá a szerver `env` mezőjét
 * (M-139 3. pont); a gyerek így a provider kulcsát és a szerver környezetének minden változóját is
 * megkapná. Az indító a `node -e` alatt fut (`buildStdioLaunch`), az első argumentuma a megengedett
 * nevek JSON tömbje, utána a valódi parancs és argumentumai; a parancsot csak a megengedett nevekkel,
 * a `PATH` és a `HOME` változóval indítja, a szabványos csatornákat változatlanul átadja (`inherit`),
 * a leállító jelzéseket továbbítja, és a gyerek kilépési kódjával lép ki.
 *
 * Szöveg, mert külön folyamatban fut; a viselkedését a `build-stdio-launch.spec.ts` valódi
 * folyamatindítással ellenőrzi. Az értékek nem argumentumként, hanem a szerver `env` mezőjén át
 * érkeznek, tehát a parancssorban csak nevek látszanak (O-52).
 */
export const STDIO_LAUNCHER_SOURCE = String.raw`
const { spawn } = require('node:child_process');
const [allowedNames, command, ...args] = process.argv.slice(1);
const allowed = new Set(['PATH', 'HOME', ...JSON.parse(allowedNames)]);
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => allowed.has(name)));
const child = spawn(command, args, { stdio: 'inherit', env });
for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) {
  process.on(signal, () => child.kill(signal));
}
child.on('error', (error) => {
  process.stderr.write(String(error) + '\n');
  process.exit(127);
});
child.on('exit', (code) => process.exit(code ?? 1));
`;
