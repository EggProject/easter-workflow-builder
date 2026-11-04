/**
 * A gazda oldali olvasási plafon bájtban (SPEC-014 5.4 "Olvasási plafon"): a
 * csomópont mezője (`fetchResponseLimitMb` vagy `fileReadLimitMb`), `null`
 * esetén az alapérték, de legfeljebb a lépés memória korlátja, mert annál
 * hosszabb tartalom a sandboxba amúgy sem férne be (research
 * `2026-11-04-szkript-csomopont.md` 10.1 F4). 1 MB = 1024 * 1024 bájt.
 */
export function resolveReadLimitBytes(limitMb: number | null, defaultMb: number, memoryLimitMb: number): number {
  return Math.min(limitMb ?? defaultMb, memoryLimitMb) * 2 ** 20;
}
