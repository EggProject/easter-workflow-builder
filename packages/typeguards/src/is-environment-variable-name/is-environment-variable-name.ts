import { isString } from '../is-string/is-string.ts';

// A POSIX "Name" alak (XBD 3.235: aláhúzás, szám és betű a hordozható karakterkészletből, az első
// jel nem szám); megerősítés: GNU Bash kézikönyv, "Definitions", name. Ugyanez a szabály áll a
// `protocol` `EnvironmentVariableNameSchema` Zod sémájában (SPEC-009 6.1); ez a guard a Zod
// nélküli csomagoké (a motor az agent definíciók hivatkozásait ezzel ellenőrzi).
// https://pubs.opengroup.org/onlinepubs/9699919799/basedefs/V1_chap03.html#tag_03_235
// https://www.gnu.org/software/bash/manual/html_node/Definitions.html
const ENVIRONMENT_VARIABLE_NAME_PATTERN = /^[A-Za-z_]\w*$/u;

/**
 * Typeguard egy környezeti változó NEVÉRE (POSIX név alak, SPEC-009 6.1).
 */
export function isEnvironmentVariableName(value: unknown): value is string {
  return isString(value) && ENVIRONMENT_VARIABLE_NAME_PATTERN.test(value);
}
