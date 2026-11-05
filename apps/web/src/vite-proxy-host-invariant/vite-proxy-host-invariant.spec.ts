// Regressziós teszt, megvalósítás fájl nélkül (SPEC-002 6.2 5. pont, a
// `vite-istanbul-include-invariant` téma mintájára): a `vite.config.ts` `/api`
// proxy szabálya sztring alakú maradjon. A telepített Vite a sztring alakú
// szabályt `{ target, changeOrigin: true }` objektummá alakítja, és a
// `changeOrigin` a `Host` fejlécet a cél címére írja
// (`docs/research/2026-11-05-host-origin-ellenorzes.md` 3.2). Egy
// `changeOrigin` nélküli objektum alakban a `Host` a Vite címe maradna, és a
// szerver kérés forrás ellenőrzése (SPEC-017 5.2) minden REST kérést 403
// válasszal utasítana el.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const directory = path.dirname(fileURLToPath(import.meta.url));

describe('Vite /api proxy Host invariáns', () => {
  it('a proxy szabály a sztring alakú célt kapja, nem objektumot', () => {
    const content = readFileSync(path.join(directory, '..', '..', 'vite.config.ts'), 'utf8');
    expect(content).toContain('[API_BASE_PATH]: proxyTarget,');
    expect(content).not.toContain('changeOrigin');
  });
});
