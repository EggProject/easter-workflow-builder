// A pinelt Agent SDK betöltése a repó telepítéséből (a `tools/wire-probe` csomag függősége), és az
// izolált futtatási környezet összeállítása. A `HOME` és a `CLAUDE_CONFIG_DIR` eldobható könyvtár,
// a kulcs hamis jelölő, az `ANTHROPIC_BASE_URL` a helyi csonk.
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ITT = path.dirname(fileURLToPath(import.meta.url));
const GYOKER = path.resolve(ITT, '..', '..', '..');
const SDK_MAPPA = path.join(GYOKER, 'tools', 'wire-probe', 'node_modules', '@anthropic-ai', 'claude-agent-sdk');

export const HAMIS_KULCS = 'csonk-kulcs-nem-valodi';

export async function betoltSdk() {
  const verzio = JSON.parse(readFileSync(path.join(SDK_MAPPA, 'package.json'), 'utf8')).version;
  const sdk = await import(pathToFileURL(path.join(SDK_MAPPA, 'sdk.mjs')).href);
  return { sdk, verzio };
}

export function ujMunkakonyvtar(elotag) {
  return mkdtempSync(path.join(tmpdir(), `${elotag}-`));
}

/** A CLI teljes környezete (`Options.env`): csak a felsorolt változók. */
export function izoltKornyezet(csonkUrl, home) {
  return {
    PATH: process.env.PATH ?? '/usr/bin:/bin',
    HOME: home,
    CLAUDE_CONFIG_DIR: path.join(home, '.claude'),
    ANTHROPIC_BASE_URL: csonkUrl,
    ANTHROPIC_API_KEY: HAMIS_KULCS,
    CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1',
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    DISABLE_TELEMETRY: '1',
    DISABLE_AUTOUPDATER: '1',
  };
}
