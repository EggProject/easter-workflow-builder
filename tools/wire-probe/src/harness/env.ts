/** A MINIMAX_API_KEY betöltése: elsőként process.env-ből, másodikként a repo gyökér .env fájljából. */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = dirname(fileURLToPath(import.meta.url));
// src/harness -> src -> tools/wire-probe -> tools -> repo gyökér
const repoRoot = join(moduleDir, '..', '..', '..', '..');

export function loadMinimaxApiKey(): string {
  const fromEnv = process.env.MINIMAX_API_KEY;
  if (fromEnv !== undefined && fromEnv.length > 0) {
    return fromEnv;
  }
  const envFilePath = join(repoRoot, '.env');
  let content: string;
  try {
    content = readFileSync(envFilePath, 'utf8');
  } catch {
    throw new Error(`MINIMAX_API_KEY nincs a process.env-ben, és a ${envFilePath} sem olvasható.`);
  }
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('MINIMAX_API_KEY=')) {
      const value = trimmed.slice('MINIMAX_API_KEY='.length).trim();
      if (value.length > 0) {
        return value;
      }
    }
  }
  throw new Error(`MINIMAX_API_KEY nem található sem a process.env-ben, sem a ${envFilePath} fájlban.`);
}
