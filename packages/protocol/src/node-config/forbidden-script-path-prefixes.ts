/**
 * A JavaScript szkript fájl hozzáférése elől elzárt két könyvtár (user döntés
 * 2026-11-04, "/proc és /dev tiltva", SPEC-014 5.4 "Fájl"): a `cwd` mező és a
 * szkript minden fájl útvonala sem állhat alattuk, és ide feloldódó útvonal sem
 * fogadható el. Ok: a `/proc/self/environ` a szerver folyamat indulási környezeti
 * változóit adta (research `2026-11-04-szkript-csomopont.md` 10.3), a `/dev` alatt
 * végtelen eszközfájlok állnak (`/dev/zero`, 10.1 F4).
 *
 * A mentési séma lexikálisan (`isForbiddenScriptCwd`), az `apps/server` futtatója
 * az `fs.realpath` alakon is ezt a listát használja; a kettő ugyanazt a konstanst
 * olvassa, tehát nincs duplikátum.
 */
export const FORBIDDEN_SCRIPT_PATH_PREFIXES = ['/proc', '/dev'] as const;
