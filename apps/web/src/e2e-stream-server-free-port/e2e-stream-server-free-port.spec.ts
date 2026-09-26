// Regressziós teszt, megvalósítás fájl nélkül (SPEC-002 6.2 5. pont, ugyanaz a minta, mint a
// `playwright-worker-limit` és az `e2e-coverage-threshold` téma): az e2e valódi `node:http` SSE
// teszt szerverei az operációs rendszer által kiosztott SZABAD porton figyeljenek, ne fix porton.
//
// A védett hiba (`1c7dd13`, `docs/research/2026-09-23-transcript-panel-meresek.md` 19. szekció
// (D)): a szerverek korábban mind a `STREAM_ORIGIN` 4174-es portjára kötődtek, és
// `--repeat-each 3` mellett három workerrel `EADDRINUSE` jött. A CI egy workeren fut, ahol a fix
// port is zöld (független ellenőrzés: 89/89), tehát a visszaállítást egyetlen futó teszt sem
// fogná meg; ez a teszt a `test` kapun igen.
//
// Unit teszt nem nyithat hálózatot (`unit-test-network-isolation`), ezért a vizsgálat a forrás
// szövegén fut, az `apps/web/e2e` és az `apps/web/measurement` minden `.ts` fájlján:
//   1. a `listen` szó pontosan EGYSZER áll bennük, a `run-view-stream.ts` `listenOnLoopback`
//      függvényében, tehát más fájl nem indíthat szervert a közös út megkerülésével;
//   2. a `listenOnLoopback` port paraméterének alapértéke `0` (a Node doksi szerint ekkor az
//      operációs rendszer oszt ki szabad portot), és a `listen` hívás ezt a paramétert kapja;
//   3. a `listenOnLoopback` egyetlen hívása sem ad át portként szám, szöveg vagy origin literált;
//   4. minden `port` nevű függvény paraméter alapértéke `0`.
// A korlát kimondva: egy nevesített konstansban álló szám, amit egy helper paramétereként adnak
// tovább, egyik szabályon sem akad fenn; a teszt a visszaállítást és a véletlen fix portot zárja
// ki, a szándékos megkerülést nem.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

interface SourceFile {
  readonly relativePath: string;
  readonly content: string;
}

const directory = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(directory, '..', '..');
const SCANNED_DIRECTORIES = ['e2e', 'measurement'] as const;
const SHARED_SERVER_FILE = path.join('e2e', 'run-view-stream.ts');
const LISTEN_SIGNATURE = 'export async function listenOnLoopback(server: NetServer, port = 0): Promise<number> {';
const LISTEN_CALL = 'server.listen(port, LOOPBACK_HOST, () => {';
const CALL_PREFIX = 'listenOnLoopback(';
const FORBIDDEN_IN_PORT_ARGUMENT = ['ORIGIN', 'URL', 'env', "'", '"', '`'] as const;

function collectTypeScriptFiles(relativeDirectory: string): readonly string[] {
  return readdirSync(path.join(webRoot, relativeDirectory), { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      return collectTypeScriptFiles(relativePath);
    }
    return entry.name.endsWith('.ts') ? [relativePath] : [];
  });
}

function readScannedFiles(): readonly SourceFile[] {
  return SCANNED_DIRECTORIES.flatMap((relativeDirectory) => collectTypeScriptFiles(relativeDirectory)).map(
    (relativePath) => ({ relativePath, content: readFileSync(path.join(webRoot, relativePath), 'utf8') }),
  );
}

/**
 * A `listenOnLoopback(` hívások argumentum listája az első záró zárójelig. A
 * függvény deklarációja nem hívás, kimarad. Egy beágyazott hívás (például
 * `Number(new URL(...).port)`) a belső zárójelnél ér véget, de a szövege így is
 * tartalmazza, ami a tiltott elemeket elárulja.
 */
function listenOnLoopbackArguments(content: string): readonly string[] {
  const found: string[] = [];
  let index = content.indexOf(CALL_PREFIX);
  while (index !== -1) {
    const start = index + CALL_PREFIX.length;
    if (!content.slice(0, index).endsWith('function ')) {
      found.push(content.slice(start, content.indexOf(')', start)));
    }
    index = content.indexOf(CALL_PREFIX, start);
  }
  return found;
}

describe('e2e SSE teszt szerver szabad port invariáns', () => {
  const files = readScannedFiles();

  it('a vizsgált mappákban van TypeScript fájl, és köztük a közös szerver fixtúra', () => {
    expect(files.map((file) => file.relativePath)).toContain(SHARED_SERVER_FILE);
  });

  it('a listen szó pontosan egyszer áll, a közös fixtúra listenOnLoopback függvényében', () => {
    const occurrences = files.flatMap((file) =>
      file.content
        .matchAll(/\blisten\b/g)
        .map(() => file.relativePath)
        .toArray(),
    );
    expect(occurrences).toEqual([SHARED_SERVER_FILE]);
  });

  it('a listenOnLoopback port paraméterének alapértéke 0, és a listen hívás ezt a paramétert kapja', () => {
    const shared = files.find((file) => file.relativePath === SHARED_SERVER_FILE)?.content ?? '';
    expect(shared).toContain(LISTEN_SIGNATURE);
    expect(shared).toContain(LISTEN_CALL);
  });

  it('a listenOnLoopback egyetlen hívása sem ad át portként szám, szöveg vagy origin literált', () => {
    const offenders = files.flatMap((file) =>
      listenOnLoopbackArguments(file.content)
        .filter(
          (argumentList) =>
            /\d/.test(argumentList) || FORBIDDEN_IN_PORT_ARGUMENT.some((token) => argumentList.includes(token)),
        )
        .map((argumentList) => `${file.relativePath}: listenOnLoopback(${argumentList})`),
    );
    expect(offenders).toEqual([]);
  });

  it('minden port nevű függvény paraméter alapértéke 0', () => {
    const defaults = files.flatMap((file) =>
      file.content
        .matchAll(/[(,]\s*port(?::\s*number)? = ([^,)\n]*)/g)
        .map((match) => ({ file: file.relativePath, value: match[1] }))
        .toArray(),
    );
    expect(defaults.length).toBeGreaterThan(0);
    expect(defaults.filter((entry) => entry.value !== '0')).toEqual([]);
  });
});
