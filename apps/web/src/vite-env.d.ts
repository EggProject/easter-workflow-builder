// Az `import.meta.env` típusbővítése (SPEC-007 12.2). Típus only fájl: sem
// `import`, sem `export` sor nem állhat benne, mert egy modul fájlban a
// `interface ImportMeta` deklaráció nem globális, tehát nem olvadna össze a
// TypeScript beépített `ImportMeta` deklarációjával.
//
// A Vite a `VITE_` előtagú változókat teszi elérhetővé a kliens kódnak az
// `import.meta.env` objektumon; a típusokat a `vite/client.d.ts` adná, a
// bővítés dokumentált helye viszont egy saját `.d.ts` fájl.
// Forrás: https://vite.dev/guide/env-and-mode (SPEC-007 M-11).
//
// Nevesített kulcsokat szándékosan nem sorolunk fel: a kötelező változók
// neve a `frontend-config` téma konstansaiban áll, egyetlen helyen, és egy
// itteni második felsorolás elcsúszhatna attól. Az index szignatúra
// ugyanazt a szerződést írja le, amit a Vite garantál: minden env változó
// vagy sztring, vagy hiányzik.

type ImportMetaEnv = Readonly<Record<string, string | undefined>>;

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
