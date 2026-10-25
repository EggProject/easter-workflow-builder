import Mustache from 'mustache';
import { baseRunContext, renderSpecPath, renderStrictPath, renderStock } from './lib.mjs';
const originalEscape = Mustache.escape;
const ctx = baseRunContext({ input: { s: '&<>"\'/`=' } });
const out = {};
for (const t of ['{{input.s}}', '{{{input.s}}}', '{{& input.s}}']) {
  out[t] = {
    specPath: renderSpecPath(t, ctx),
    strictPath: renderStrictPath(t, ctx),
    stockConfigEscape: renderStock(t, ctx),
  };
}
out.globalEscapeSameRef = Mustache.escape === originalEscape;
out.globalEscapeStillHtml = Mustache.escape('&<>"\'/`=');
out.defaultRenderWithoutConfig = Mustache.render('{{s}}', { s: '&<>"\'/`=' });
console.log(JSON.stringify(out, null, 2));
