import { describeError } from '@easter-workflow-builder/core';
import { MissingTemplateNameError } from './missing-template-name-error.ts';

/**
 * Az üzenet végi szám: a `parseTemplate` pozíciót hordozó hibái ` at <szám>`
 * végűek (research `2026-10-21-spec010-blokkolo-meresek.md` 3. szekció (4)).
 */
function positionOf(message: string): string {
  return message.slice(message.lastIndexOf(' ') + 1);
}

/**
 * A `parseTemplate` négy hibája sima `Error`, csak az üzenet előtagja
 * különbözteti meg őket (M-115, research 3. szekció (4)). A leírás saját magyar
 * mondat a pozícióval; a szakasz név és az `Invalid tags` utáni szöveg a sablon
 * darabja, ezért nem kerül át (SPEC-010 9.5, O-9).
 */
const PARSE_ERROR_SENTENCES = [
  {
    prefix: 'Unclosed tag at ',
    describe: (message: string) => `le nem zárt tag a sablonban (pozíció: ${positionOf(message)})`,
  },
  {
    prefix: 'Unopened section "',
    describe: (message: string) => `meg nem nyitott szakasz lezárása a sablonban (pozíció: ${positionOf(message)})`,
  },
  {
    prefix: 'Unclosed section "',
    describe: (message: string) => `le nem zárt szakasz a sablonban (pozíció: ${positionOf(message)})`,
  },
  {
    prefix: 'Invalid tags: ',
    describe: () => 'érvénytelen határoló csere a sablonban',
  },
] as const satisfies readonly { readonly prefix: string; readonly describe: (message: string) => string }[];

/**
 * A sablon fordításának vagy renderelésének kivétele saját magyar leírásra
 * képezve (SPEC-010 6.2, 9.5). A könyvtár üzenete nem kerül ki; a hiányzó név
 * hibája a kért nevet idézi (6.7). A hibaosztály nevét nem a csomag, hanem a
 * hívó teszi hozzá (6.2).
 */
export function describeTemplateError(error: unknown): string {
  if (error instanceof MissingTemplateNameError) {
    return error.message;
  }
  const message = describeError(error);
  const sentence = PARSE_ERROR_SENTENCES.find((candidate) => message.startsWith(candidate.prefix));
  return sentence === undefined ? 'a sablon nem renderelhető' : sentence.describe(message);
}
