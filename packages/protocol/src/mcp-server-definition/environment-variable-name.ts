import { z } from 'zod';

// A POSIX "Name" alak (XBD 3.235: aláhúzás, szám és betű a hordozható karakterkészletből, az első jel
// nem szám), ami a shellben változónévként adható meg; a kisbetűs nevek az alkalmazásoké (XBD 8.1),
// ezért nem tiltjuk őket. Megerősítés: GNU Bash kézikönyv, "Definitions", name. A `\w` `i` jelző
// nélkül ASCII `[A-Za-z0-9_]` (a spec teszt az ékezetes nevet elutasítja).
// https://pubs.opengroup.org/onlinepubs/9699919799/basedefs/V1_chap03.html#tag_03_235
// https://pubs.opengroup.org/onlinepubs/9799919799/basedefs/V1_chap08.html
// https://www.gnu.org/software/bash/manual/html_node/Definitions.html
const ENVIRONMENT_VARIABLE_NAME_PATTERN = /^[A-Za-z_]\w*$/u;

/**
 * Egy környezeti változó NEVE (SPEC-009 6.1 "A nevek szabálya"): a központi
 * MCP definíció deklarált és szerver oldali nevei ezen a sémán mennek át.
 * Értéket soha nem hordoz.
 */
export const EnvironmentVariableNameSchema = z.string().regex(ENVIRONMENT_VARIABLE_NAME_PATTERN);

export type EnvironmentVariableName = z.infer<typeof EnvironmentVariableNameSchema>;
