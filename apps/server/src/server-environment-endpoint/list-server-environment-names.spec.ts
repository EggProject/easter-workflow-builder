import { describe, expect, it } from 'vitest';
import { ServerEnvironmentNameListSchema } from '@easter-workflow-builder/protocol';
import { createListServerEnvironmentNamesHandler } from './list-server-environment-names.ts';

const context = { parameters: {}, query: new URLSearchParams(), body: undefined };

describe('createListServerEnvironmentNamesHandler', () => {
  it('a környezet név alakú neveit UTF-16 sorrendben adja, értéket nem (O-32)', async () => {
    const handler = createListServerEnvironmentNamesHandler({
      readAll: () => ({
        PATH: '/usr/bin',
        GITHUB_TOKEN_CEG: 'titkos-ertek-ceg',
        github_token_sajat: 'titkos-ertek-sajat',
        _UNDERSCORE: 'x',
        'ProgramFiles(x86)': 'program-files',
        '=C:': 'meghajto',
      }),
    });

    const result = await handler(context);

    expect(result).toStrictEqual({
      kind: 'ok',
      value: { status: 200, body: ['GITHUB_TOKEN_CEG', 'PATH', '_UNDERSCORE', 'github_token_sajat'] },
    });
    expect(JSON.stringify(result)).not.toContain('titkos-ertek');
    const body = result.kind === 'ok' ? result.value.body : undefined;
    expect(ServerEnvironmentNameListSchema.safeParse(body).success).toBe(true);
  });

  it('üres környezetre üres listát ad', async () => {
    const result = await createListServerEnvironmentNamesHandler({ readAll: () => ({}) })(context);

    expect(result).toStrictEqual({ kind: 'ok', value: { status: 200, body: [] } });
  });
});
