// Bajtszintu regresszios teszt a self-hosted-font temara. Ugyanaz az indok,
// mint a design-token temaban (lasd design-token-byte-identity.spec.ts): a
// forras skill konyvtar nem erheto el futasidoben, ezert a lenyomatok fix
// literalok, a forrason egyszer kiszamitva, 2026-09-01.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const directory = path.dirname(fileURLToPath(import.meta.url));

const FONT_FILE_SHA256: Readonly<Record<string, string>> = {
  'jetbrains-mono-latin-400-italic.woff2': '87ddac4a62229787528cf4ac3fa58137b62a9aec364c44fc0f40470bcda9efba',
  'jetbrains-mono-latin-400-normal.woff2': '14425ba9c695763c1547f48a206b7aa60350a33ae23de09f0407877f3fcd89eb',
  'jetbrains-mono-latin-500-normal.woff2': 'cb182feeed4d798ff6961d3c79f7026279448fca0676438aaecb21f3fc39553a',
  'jetbrains-mono-latin-600-normal.woff2': '400c6bfda18d5d14acad1c15d6dcb9f8e13c015e7286317e0b9a482539bef147',
  'jetbrains-mono-latin-ext-400-italic.woff2': 'a53b6b29b1621cdf51140761869e160521fc566a4a9f312d9b92e7178d433bc7',
  'jetbrains-mono-latin-ext-400-normal.woff2': '505dfba8ecbe77e82765f36d317ed7ef4ac42719dc5f4ae68d1c483fd22d0d14',
  'jetbrains-mono-latin-ext-500-normal.woff2': '879df9319f1cbf633bee1dd489e376a9e1e8c458f4abddcfe381cb83b5e6b027',
  'jetbrains-mono-latin-ext-600-normal.woff2': '90899aac1c15552c028fd205376bb537a2a5205164fe8626efabad77d7260c20',
  'roboto-latin-300-normal.woff2': '299f10a52fe1423dd5579ff7e83db8dbea312f1e924f3e06e55839286b4d1c1d',
  'roboto-latin-400-italic.woff2': '5d0e978b6560631da2504e1612e91ee1ff959c04adae245eb320ac90cad2ba2f',
  'roboto-latin-400-normal.woff2': '425c0713a8176f92273d378599c7eac57de7fafabd4bd0ed457b70eb8f80d371',
  'roboto-latin-500-normal.woff2': '5bcc3aa180e7f26f643cd5b2621cd7c2de193d0661d913a94afd3d4881a7a34b',
  'roboto-latin-700-normal.woff2': 'b9d66d1708156f765ada51939bc24ed259dafa69eb631b36e443680fe9e15879',
  'roboto-latin-900-normal.woff2': '7523c0cc7f5c088ab663be51e111b9429a4f15681802a7e027eb658f497a26a8',
  'roboto-latin-ext-300-normal.woff2': 'ccd24ea4a6eb7d7f2ad3d48078f64ffceb623faad8b4a52943bd7569d995dbec',
  'roboto-latin-ext-400-italic.woff2': 'ad66d13b1a82df14c8937a7c547809471a3a42e67b0fc06c0aa7955f37b6ece9',
  'roboto-latin-ext-400-normal.woff2': '5725eacca97303d8bce26f76cfcaee4393295bbf93c1eb6c3e5e4f260b2da189',
  'roboto-latin-ext-500-normal.woff2': '1e597a6e3b163200475089698be3427ab1bb01553493d5b7d53694429948d8ec',
  'roboto-latin-ext-700-normal.woff2': '7673803a2d402018b1f726dded5bf2dbf2be4307039e8718f4bea654d6eca249',
  'roboto-latin-ext-900-normal.woff2': '5b432d767f3d5f8ff225506caf67bfea71da46f0219c054b43914fbefd11556f',
};

const FONTS_CSS_SHA256 = 'd059924e4a9beda75d280929a306d443f53d5da7069d3a8b32222006aad41299';

/**
 * A 20 .woff2 fajl egyuttes merete a forrasban, byte-ban (M-31, AC10).
 */
const EXPECTED_TOTAL_WOFF2_BYTES = 342_944;

describe('self-hosted-font bajtazonossag a forrassal', () => {
  it.each(Object.entries(FONT_FILE_SHA256))('%s bajtra azonos a forrassal', (fileName, expectedHash) => {
    const content = readFileSync(path.join(directory, fileName));
    expect(createHash('sha256').update(content).digest('hex')).toBe(expectedHash);
  });

  it('a fonts.css bajtra azonos a forrassal, valtozatlan fejleccel', () => {
    const content = readFileSync(path.join(directory, 'fonts.css'), 'utf8');
    expect(createHash('sha256').update(content).digest('hex')).toBe(FONTS_CSS_SHA256);
    expect(content).toContain('Vendored locally from @fontsource');
  });

  it('pontosan 20 .woff2 fajl all a mappaban, 342944 bajt osszesen', () => {
    const woff2Files = readdirSync(directory).filter((name) => name.endsWith('.woff2'));
    expect(woff2Files).toHaveLength(20);

    const totalBytes = woff2Files.reduce((sum, name) => sum + statSync(path.join(directory, name)).size, 0);
    expect(totalBytes).toBe(EXPECTED_TOTAL_WOFF2_BYTES);
  });
});
