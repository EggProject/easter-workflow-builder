/**
 * A pillanatkép lenyomata (SPEC-003 5.6, 9.4 szekció): a kanonikus szöveg
 * `sha256` értéke, 64 karakteres kisbetűs hexadecimális szövegként (F-24).
 * Névleges (brand) típus, tehát nyers `string` nem értékelhető rá; szűkíteni
 * az `isGraphSnapshotHash` guard tud.
 */
export type GraphSnapshotHash = string & { readonly graphSnapshotHashBrand: true };
