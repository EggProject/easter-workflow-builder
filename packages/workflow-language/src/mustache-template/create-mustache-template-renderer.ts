import { describeTemplateError } from './describe-template-error.ts';
import type { MustacheTemplateRenderer } from './mustache-template-renderer.ts';
import { OwnPropertyContext } from './own-property-context.ts';
import { StrictWriter } from './strict-writer.ts';

/**
 * A Mustache sablon renderelő gyártó függvénye (SPEC-010 6.). Saját `Writer`
 * példányt épít kikapcsolt gyorsítótárral (6.3), a modul szintű állapothoz
 * (a modul gyorsítótára és escape függvénye) nem nyúl, és a modul szintű
 * render és parse függvényt nem hívja (6.3, 16. szekció 63.). A `render` sem
 * `partials`, sem `config` argumentumot nem ad (6.1, M-117). Kivétel nem hagyja
 * el a függvényt: minden kimenet `Outcome` (6.2).
 */
export function createMustacheTemplateRenderer(): MustacheTemplateRenderer {
  const writer = new StrictWriter();
  return {
    compile(template) {
      try {
        writer.parse(template);
        return { kind: 'ok', value: undefined };
      } catch (error) {
        return describeTemplateError(error);
      }
    },
    render(template, context) {
      try {
        return { kind: 'ok', value: writer.render(template, new OwnPropertyContext(context)) };
      } catch (error) {
        return describeTemplateError(error);
      }
    },
  };
}
