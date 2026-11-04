/**
 * A `start` node bemeneti mezőjének értéktípusa: hat értékű zárt felsorolás
 * (SPEC-016 5.1). A GitHub Actions kézi indításának kulcsszavait követi, ahol
 * van megfelelő; a szöveg neve `text`, mert a commitolt v1 pillanatkép
 * fixtúra is ezt hordozza. Az `isStartInputValueKind` guard szűkíti, minden
 * úton (írás, olvasás, futás indítás), visszafelé kompatibilitási ág nélkül
 * (SPEC-016 5.2, O-2).
 */
export type StartInputValueKind = 'text' | 'number' | 'boolean' | 'choice' | 'list' | 'json';
