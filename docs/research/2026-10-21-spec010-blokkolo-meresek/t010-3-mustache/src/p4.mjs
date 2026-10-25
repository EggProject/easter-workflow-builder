import Mustache from 'mustache';
Mustache.templateCache = undefined;
const cases = [
  ['Unclosed tag', 'Szia {{input.tema'],
  ['Unclosed tag, titok jellegű szöveggel', 'TITKOS-PROMPT-SZOVEG-123 {{input.tema TITKOS-UTANA-456'],
  ['Unopened section', 'eleje {{/input.elemek}} vége'],
  ['Unopened section, hosszú szöveg a záró tagban', 'x {{/ez itt egy hosszu TITKOS mondat a sablonbol 789}} y'],
  ['Unclosed section (eltérő záró)', '{{#input.elemek}}a{{/input.masik}}'],
  ['Unclosed section (eltérő záró, hosszú nyitó név)', '{{#TITKOS nyito szoveg 111}}a{{/x}}'],
  ['Unclosed section (vége, nincs záró)', '{{#input.elemek}}a'],
  ['Unclosed section (vége, hosszú nyitó név)', 'elotte {{#TITKOS nyito szoveg 222}}a'],
  ['Invalid tags (egy elem)', '{{=TITKOS-HATAROLO-333=}}'],
  ['Invalid tags (üres)', '{{==}}'],
  ['Invalid tags, hosszabb szöveg szóközök nélkül', '{{=ez_a_teljes_TITKOS_szoveg_444_idezve_lesz=}}'],
  ['Érvényes: három szóval (split 2) - NEM hiba', '{{=a b c=}}'],
];
for (const [label, t] of cases) {
  try {
    Mustache.parse(t);
    console.log(`${label}: NINCS KIVÉTEL`);
  } catch (e) {
    console.log(
      `${label}\n  sablon : ${JSON.stringify(t)}\n  osztály: ${e.constructor.name}\n  üzenet : ${JSON.stringify(e.message)}`,
    );
  }
}
