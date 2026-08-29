import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isRecord } from '@easter-workflow-builder/typeguards';
import type { ProviderId } from '@easter-workflow-builder/provider-capability';

/**
 * PLAN-005 T-005-29, konfigurációs invariáns regressziós tesztek: a
 * paraméterezhetőség és a token takarékosság gépi őrzése.
 *
 * Hat, egymástól független invariánst őriz a `packages/engine/src` alatti
 * TERMÉKKÓD `.ts` fájljain, a `.spec.ts` fájlok KIVÉTELÉVEL - azok
 * fixture/teszt célból jogosan tartalmazhatnak provider azonosítót,
 * `Date.now` hamisítást stb. (`.claude/CLAUDE.md` 8. szekció
 * "Lefedettség", a T-005-29 feladatleírás):
 *
 * 1. konkrét provider azonosító nem szerepel szövegként (SPEC-004 17.
 *    szekció 56. elfogadási kritérium),
 * 2. az `@anthropic-ai` szöveg nem szerepel (58. elfogadási kritérium),
 * 3. nincs `Date.now`, `setTimeout`, `randomUUID`, `process.env`,
 *    `Math.random` hivatkozás (6. elfogadási kritérium),
 * 4. a `total_cost_usd` mezőnév nem szerepel (22. elfogadási kritérium),
 * 5. a `retry-after` szöveg nem szerepel, kis/nagybetű érzéketlenül (40.
 *    elfogadási kritérium),
 * 6. a `packages/engine/package.json` nem listázza sem a
 *    `@easter-workflow-builder/provider-registry`, sem az
 *    `@anthropic-ai/claude-agent-sdk` csomagot (57. és 58. elfogadási
 *    kritérium).
 *
 * **Miért az `engine-port` témában áll, és nem egy 19. téma mappában.** A
 * SPEC-004 12. szekció (17. szekció 1. elfogadási kritériuma) a
 * `packages/engine/src` alatt PONTOSAN 18 téma mappát ír elő, tehát ez a
 * fájl nem hozhat létre újat. Az `engine-port` téma adja a kilenc
 * befecskendezett portot (`clock`, `idGenerator`, `processEnvironment`,
 * `providerDescriptorLookup`, ...), ami a fenti hat invariáns MECHANIZMUSA:
 * a motor pontosan azért nem hív `Date.now()`-t vagy `randomUUID()`-t, nem
 * olvas `process.env`-et és nem ismer konkrét provider azonosítót, mert
 * minden ilyen forrás egy porton keresztül érkezik (lásd
 * `provider-descriptor-lookup-port.ts` "Miért port, nem import"
 * bekezdését). Ez a teszt gépi bizonyíték arra, hogy ez a tervezési
 * garancia a forráskódban sem sérül. A `startup-recovery` témában álló
 * `engine-never-opens-database.spec.ts` egy KÜLÖN, kifejezetten AC-53-hoz
 * kötött invariánst őriz (nincs `openDatabase` hívás); a doksija
 * szándékosan elhatárolja magát ettől a gyűjtőteszttől, ezért az
 * `openDatabase` ellenőrzés ide NEM került át, hogy ne duplikálódjon.
 *
 * **Próbafuttatáson talált, javított hamis pozitív.** Az első lefuttatás
 * két termékkód kommentet talált, ami a `Date.now` szót MAGYARÁZATKÉNT
 * tartalmazta (mindkettő azt írta körül, hogy a motor miért NEM hívja):
 * `engine-event/write-engine-event.ts` és `node-executor/begin-step-run.ts`.
 * Mindkét komment körülírásra került (a szó szerinti `Date.now()` említés
 * helyett "natív rendszeróra hívás"), mert a szabály szerint a forrást
 * javítjuk, nem a tesztet lazítjuk (T-005-29 feladatleírás, gyökér
 * `CLAUDE.md` 7.). Kódban, aktív hivatkozásként a tiltott szövegek egyike
 * sem jogos - kizárólag e teszt saját keresési mintaként tartalmazza őket,
 * és ez a fájl `.spec.ts`, tehát a keresés önmagát nem érinti.
 */

const SRC_ROOT = path.join(import.meta.dirname, '..');

/**
 * A `packages/engine/src` alatti termékkód `.ts` fájljai, a `.spec.ts`
 * fájlok kizárásával. Szándékosan külön másolat a
 * `startup-recovery/engine-never-opens-database.spec.ts` azonos célú
 * segédjéhez képest: egy megosztott segédhez új, téma-mappához nem köthető
 * fájlt kellene nyitni a `src/` alatt, amit a "Tiltott mappanevek" szabály
 * és az "egy fájlba egy dolog" elv (`.claude/CLAUDE.md` 5. és 6. szekció)
 * sem enged - a kis, egyszer használt bejárás duplikálása olcsóbb, mint egy
 * kizárólag tesztek által használt közös modul bevezetése.
 */
function collectProductionSourceFiles(directory: string): readonly string[] {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectProductionSourceFiles(fullPath));
      continue;
    }
    if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

const PRODUCTION_SOURCE_FILES = collectProductionSourceFiles(SRC_ROOT);

/**
 * A megadott fájlok közül azok, amiknek a tartalma megbukik az ellenőrzőn.
 */
function findOffenders(files: readonly string[], hasForbiddenText: (content: string) => boolean): readonly string[] {
  return files.filter((file) => hasForbiddenText(fs.readFileSync(file, 'utf8')));
}

/**
 * A csomag saját `package.json` fájljának `dependencies` vagy
 * `devDependencies` mezője listázza-e a megadott csomagnevet. A repóban ma
 * sehol nem használt `peerDependencies`/`optionalDependencies` mezőt ezért
 * szándékosan nem vizsgálja (nincs mit védeni, ami nem létezik a
 * workspace-ben - "Simplicity First", gyökér `CLAUDE.md` 2.).
 */
function hasPackageJsonDependency(packageName: string): boolean {
  const text = fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8');
  const parsed: unknown = JSON.parse(text);
  if (!isRecord(parsed)) {
    return false;
  }
  const dependencyFields = [parsed['dependencies'], parsed['devDependencies']];
  return dependencyFields.some((field) => isRecord(field) && Object.hasOwn(field, packageName));
}

describe('packages/engine/src konfigurációs invariánsai (PLAN-005 T-005-29)', () => {
  it('van legalább egy vizsgált termékkód fájl', () => {
    expect(PRODUCTION_SOURCE_FILES.length).toBeGreaterThan(0);
  });

  describe('nincs konkrét provider azonosító szövegként (SPEC-004 56. elfogadási kritérium)', () => {
    /**
     * `Record<ProviderId, true>`: ha a `provider-id.ts` unió egy harmadik
     * providerrel bővül, a fordító hiányzó kulcs miatt típushibát ad, tehát
     * ez a lista nem szakadhat el tippelve a tényleges `ProviderId`
     * uniótól (`packages/provider-capability/src/provider-id/provider-id.ts`
     * a forrás, ugyanaz a minta, mint az `isEngineErrorKind` guard
     * `ENGINE_ERROR_KIND_KEYS` rekordja, `packages/engine/CLAUDE.md`
     * "Szabályok").
     */
    const KNOWN_PROVIDER_IDS: Record<ProviderId, true> = {
      minimax: true,
      'claude-subscription': true,
    };

    for (const providerId of Object.keys(KNOWN_PROVIDER_IDS)) {
      it(`nem szerepel a(z) '${providerId}' azonosító`, () => {
        const offenders = findOffenders(PRODUCTION_SOURCE_FILES, (content) => content.includes(providerId));
        expect(offenders).toStrictEqual([]);
      });
    }
  });

  it("nincs '@anthropic-ai' szöveg (SPEC-004 58. elfogadási kritérium)", () => {
    const offenders = findOffenders(PRODUCTION_SOURCE_FILES, (content) => content.includes('@anthropic-ai'));
    expect(offenders).toStrictEqual([]);
  });

  describe('nincs valós idő / véletlen / process env hivatkozás (SPEC-004 6. elfogadási kritérium)', () => {
    const FORBIDDEN_RUNTIME_REFERENCES = ['Date.now', 'setTimeout', 'randomUUID', 'process.env', 'Math.random'];

    for (const forbidden of FORBIDDEN_RUNTIME_REFERENCES) {
      it(`nem szerepel a(z) '${forbidden}' hivatkozás`, () => {
        const offenders = findOffenders(PRODUCTION_SOURCE_FILES, (content) => content.includes(forbidden));
        expect(offenders).toStrictEqual([]);
      });
    }
  });

  it("nincs 'total_cost_usd' mezőnév (SPEC-004 22. elfogadási kritérium)", () => {
    const offenders = findOffenders(PRODUCTION_SOURCE_FILES, (content) => content.includes('total_cost_usd'));
    expect(offenders).toStrictEqual([]);
  });

  it("nincs 'retry-after' szöveg, kis/nagybetű érzéketlenül (SPEC-004 40. elfogadási kritérium)", () => {
    const offenders = findOffenders(PRODUCTION_SOURCE_FILES, (content) =>
      content.toLowerCase().includes('retry-after'),
    );
    expect(offenders).toStrictEqual([]);
  });

  it("a package.json NEM listázza a '@easter-workflow-builder/provider-registry' csomagot (SPEC-004 57. elfogadási kritérium)", () => {
    expect(hasPackageJsonDependency('@easter-workflow-builder/provider-registry')).toBe(false);
  });

  it("a package.json NEM listázza az Agent SDK ('@anthropic-ai/claude-agent-sdk') csomagot (SPEC-004 58. elfogadási kritérium)", () => {
    expect(hasPackageJsonDependency('@anthropic-ai/claude-agent-sdk')).toBe(false);
  });
});
