/**
A MiniMax kulcs betöltése (SPEC-012 O-20 (b), SPEC-013 4.7): a kulcs az ANTHROPIC_AUTH_TOKEN vagy az ANTHROPIC_API_KEY néven
állhat, ha mindkettő áll, az ANTHROPIC_AUTH_TOKEN nyer. Egy néven belül a process.env nyer a repo gyökér .env fájlja fölött,
ahogy a szerver `node --env-file-if-exists=.env` betöltésénél is. Az üres érték hiányzónak számít, ahogy a szerver
`resolveRequiredEnvironmentValue` feloldásánál is (SPEC-013 4.3, 4.7).
*/
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MINIMAX_KEY_NAMES } from './minimax-key-names.ts';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
// src/harness -> src -> tools/wire-probe -> tools -> repo gyökér
const repoRoot = path.join(moduleDirectory, '..', '..', '..', '..');

function readEnvironmentFile(environmentFilePath: string): ReadonlyMap<string, string> {
  const values = new Map<string, string>();
  let content: string;
  try {
    content = readFileSync(environmentFilePath, 'utf8');
  } catch {
    return values;
  }
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    for (const name of MINIMAX_KEY_NAMES) {
      if (trimmed.startsWith(`${name}=`) && !values.has(name)) {
        values.set(name, trimmed.slice(name.length + 1).trim());
      }
    }
  }
  return values;
}

export function loadMinimaxApiKey(): string {
  const environmentFilePath = path.join(repoRoot, '.env');
  const fromFile = readEnvironmentFile(environmentFilePath);
  for (const name of MINIMAX_KEY_NAMES) {
    const fromEnvironment = process.env[name];
    const value = fromEnvironment !== undefined && fromEnvironment.length > 0 ? fromEnvironment : fromFile.get(name);
    if (value !== undefined && value.length > 0) {
      return value;
    }
  }
  throw new Error(
    `${MINIMAX_KEY_NAMES.join(' vagy ')} nem található sem a process.env-ben, sem a ${environmentFilePath} fájlban.`,
  );
}
