import { describe, expect, it } from 'vitest';
import { readPluginSkillSelection } from './read-plugin-skill-selection.ts';

describe('readPluginSkillSelection', () => {
  it('a motor alakjából a gyökeret, a plugin nevet és a puszta neveket adja', () => {
    expect(
      readPluginSkillSelection({
        plugins: [{ type: 'local', path: '/adat/sajat-konyvtar' }],
        skills: ['sajat-konyvtar:alfa', 'sajat-konyvtar:beta'],
      }),
    ).toStrictEqual({
      rootDirectory: '/adat/sajat-konyvtar',
      pluginName: 'sajat-konyvtar',
      skillNames: ['alfa', 'beta'],
    });
  });

  it('az üres skills lista üres kiválasztás', () => {
    expect(
      readPluginSkillSelection({ plugins: [{ type: 'local', path: '/adat/sajat-konyvtar' }], skills: [] }),
    ).toStrictEqual({
      rootDirectory: '/adat/sajat-konyvtar',
      pluginName: 'sajat-konyvtar',
      skillNames: [],
    });
  });

  it('a más előtagú és a nem szöveg elemet kihagyja', () => {
    expect(
      readPluginSkillSelection({
        plugins: [{ type: 'local', path: '/adat/sajat-konyvtar' }],
        skills: ['masik:x', 7, 'sajat-konyvtar:a'],
      })?.skillNames,
    ).toStrictEqual(['a']);
  });

  it.each([
    ['plugins nélkül', { skills: ['sajat-konyvtar:a'] }],
    ['skills nélkül', { plugins: [{ type: 'local', path: '/adat/sajat-konyvtar' }] }],
    [
      'két plugin',
      {
        plugins: [
          { type: 'local', path: '/a' },
          { type: 'local', path: '/b' },
        ],
        skills: [],
      },
    ],
    ['nem rekord plugin', { plugins: ['/a'], skills: [] }],
    ['nem local plugin', { plugins: [{ type: 'remote', path: '/a' }], skills: [] }],
    ['nem szöveg útvonal', { plugins: [{ type: 'local', path: 7 }], skills: [] }],
  ])('%s: undefined', (_label, options) => {
    expect(readPluginSkillSelection(options)).toBeUndefined();
  });
});
