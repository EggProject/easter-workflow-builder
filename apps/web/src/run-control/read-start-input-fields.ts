import type { StartInputField, WorkflowNodeInput } from '@easter-workflow-builder/protocol';

/**
 * A `start` csomópont bemeneti mezői a szerkesztett gráfból (SPEC-008 6.5:
 * "Az indítás bemenete a `start` csomópont `inputFields` listájából épül").
 *
 * A `WorkflowNodeInput.config` a `protocol` `NodeConfig` diszkriminált uniója
 * (T-009-13), tehát a `start` ág kiválasztása puszta típusszűkítés: nincs
 * séma hívás és nincs typeguard, amit meg kellene írni. A ciklus azért van
 * `find` helyett, mert a `find` a TALÁLAT típusát nem szűkíti a predikátum
 * alapján, a ciklus törzsében álló `if` viszont igen, `as` kényszerítés
 * nélkül.
 *
 * Üres lista jön vissza, ha a gráfban nincs `start` csomópont. Ez nem hibaág:
 * a `start` csomópont meglétét a szerver ellenőrzi (SPEC-004 4.7), és a
 * felület a szerver hibaüzenetét jeleníti meg, nem duplikálja a gráf
 * szemantikai validációt (AC12). A hívó számára az üres lista ugyanazt
 * jelenti, mint a `start` csomópont üres `inputFields` listája: modális
 * nélkül indul a futás, és a szerver dönt.
 */
export function readStartInputFields(nodes: readonly WorkflowNodeInput[]): readonly StartInputField[] {
  for (const node of nodes) {
    if (node.config.type === 'start') {
      return node.config.inputFields;
    }
  }
  return [];
}
