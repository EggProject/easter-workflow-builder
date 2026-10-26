/**
A MiniMax kulcs betöltése (az ANTHROPIC_AUTH_TOKEN néven, SPEC-012 O-20 (b)): elsőként process.env-ből, másodikként a repo gyökér .env fájljából.
*/
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
// src/harness -> src -> tools/wire-probe -> tools -> repo gyökér
const repoRoot = path.join(moduleDirectory, '..', '..', '..', '..');

export function loadMinimaxApiKey(): string {
  const fromEnvironment = process.env['ANTHROPIC_AUTH_TOKEN'];
  if (fromEnvironment !== undefined && fromEnvironment.length > 0) {
    return fromEnvironment;
  }
  const environmentFilePath = path.join(repoRoot, '.env');
  let content: string;
  try {
    content = readFileSync(environmentFilePath, 'utf8');
  } catch {
    throw new Error(`ANTHROPIC_AUTH_TOKEN nincs a process.env-ben, és a ${environmentFilePath} sem olvasható.`);
  }
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('ANTHROPIC_AUTH_TOKEN=')) {
      const value = trimmed.slice('ANTHROPIC_AUTH_TOKEN='.length).trim();
      if (value.length > 0) {
        return value;
      }
    }
  }
  throw new Error(`ANTHROPIC_AUTH_TOKEN nem található sem a process.env-ben, sem a ${environmentFilePath} fájlban.`);
}
