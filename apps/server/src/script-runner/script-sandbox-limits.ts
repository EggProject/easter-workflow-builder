/**
 * A JavaScript szkript sandbox rögzített korlátai (SPEC-014 5.4).
 *
 * - `maxStackSizeBytes`: a `setMaxStackSize` értéke, user döntés 2026-11-04
 *   ("Közepes, kb. 740 szint"), research `2026-11-04-szkript-csomopont.md` Q-6.
 * - `defaultTimeoutMs`: a `timeoutMs` `null` értékének feloldása (SPEC-014 5.4
 *   "Időkorlát").
 * - `moduleMemoryCeilingMb`: a pinelt modul deklarált import maximuma, 32768 lap
 *   (research Q-9); e fölötti `maximum`-mal a modul nem példányosítható.
 * - `wasmPageBytes`, `initialPages`: a WebAssembly lap mérete és a modul
 *   deklarált kezdő mérete (research Q-9: 256 lap alatt `LinkError`).
 * - `defaultFetchResponseLimitMb`, `defaultFileReadLimitMb`: a gazda oldali
 *   olvasási plafon `null` értékének feloldása MB-ban (user döntés 2026-11-04,
 *   "Igen, iparági alapértékkel", SPEC-014 5.4 "Olvasási plafon"): a Google Apps
 *   Script `UrlFetchApp` dokumentált válasz méret korlátja, "URL Fetch response
 *   size 50 MB / call" (<https://developers.google.com/apps-script/guides/services/quotas>),
 *   a forrás és a megerősítések a research `2026-11-04-szkript-csomopont.md` 11.
 *   szekciójában; a fájl olvasásé ugyanott.
 */
export const SCRIPT_SANDBOX_LIMITS = {
  maxStackSizeBytes: 131_072,
  defaultTimeoutMs: 60_000,
  moduleMemoryCeilingMb: 2048,
  wasmPageBytes: 65_536,
  initialPages: 256,
  defaultFetchResponseLimitMb: 50,
  defaultFileReadLimitMb: 50,
} as const;
