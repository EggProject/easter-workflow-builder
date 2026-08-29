import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildStreamUrl } from './build-stream-url.ts';

describe('buildStreamUrl', () => {
  it('a streamId értékből építi az URL-t', () => {
    expect(buildStreamUrl('stream-1')).toBe('/events?streamId=stream-1');
  });

  it('URL-kódolja a streamId speciális karaktereit', () => {
    expect(buildStreamUrl('stream 1&x')).toBe('/events?streamId=stream%201%26x');
  });

  it('a csomag nem exportál futás azonosítóból (runId) stream URL-t építő függvényt (20. kritérium, greppes teszt)', () => {
    const eventStreamDirectory = path.dirname(fileURLToPath(import.meta.url));
    const sourceFiles = readdirSync(eventStreamDirectory).filter(
      (fileName) => fileName.endsWith('.ts') && !fileName.endsWith('.spec.ts'),
    );
    for (const fileName of sourceFiles) {
      const content = readFileSync(path.join(eventStreamDirectory, fileName), 'utf8');
      expect(content).not.toMatch(/runId\s*:\s*string[\s\S]{0,80}Url/i);
      expect(content).not.toMatch(/function\s+\w*RunUrl\w*/i);
      expect(content).not.toMatch(/UrlFromRun/i);
    }
  });
});
