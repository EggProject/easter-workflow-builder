// Regressziós teszt: az `apps/web` unit teszt környezetében a globális
// `fetch` le van zárva, tehát unit teszt nem szólíthat meg hálózatot.
//
// Megvalósítás fájl nélküli téma (`.claude/CLAUDE.md` 5. szekció, SPEC-002
// 6.2 5. pont): a mappa neve annak a dolognak a neve, amit őriz. Ugyanaz a
// minta, mint a `vite-istanbul-include-invariant` és az
// `e2e-coverage-threshold` téma.
//
// A védett hiba (PR #11, CI run 33933773721, `Test` job): a `main.spec.ts`
// importálta a `main.tsx`-et - tehát meghívta a `mountApp`-ot -, de nem
// cserélte le a globális `fetch`-et. A `mountApp` a valódi
// `browserFetchFunction` portot adja tovább, és a React gyökeret nem adja
// vissza, tehát a teszt nem tudja leszerelni: a `WorkflowListScreen`
// effektje ténylegesen kiment a hálózatra, és a késve megérkező DNS hiba
// (`ENOTFOUND api.example.test`) React állapotfrissítést váltott ki már
// leszerelt happy-dom környezetben. A CI-ban ez `ReferenceError: window is
// not defined` alakú, a futást megbuktató kezeletlen hibaként jelent meg,
// helyben viszont zöld volt: a különbség kizárólag a DNS válaszidő, tehát a
// hiba nem determinisztikus, és pusztán a tesztek lefuttatásával nem
// fogható meg. A lezárás determinisztikussá teszi a hibaosztályt; ez a
// teszt azt őrzi, hogy a lezárás a helyén marad.
import { describe, expect, it } from 'vitest';

describe('unit teszt hálózati elszigetelés', () => {
  it('a globalThis.fetch lezárt: hívása elutasít, hálózati művelet nem indul', async () => {
    await expect(fetch('https://api.example.test/api/workflows')).rejects.toThrow(
      'Unit teszt nem szólíthat meg hálózatot',
    );
  });
});
