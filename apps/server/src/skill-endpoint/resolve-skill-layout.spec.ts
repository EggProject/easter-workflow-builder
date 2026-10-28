import { describe, expect, it } from 'vitest';
import type { PlannedZipEntry } from './planned-zip-entry.ts';
import { resolveSkillLayout } from './resolve-skill-layout.ts';

const file = (entryPath: string): PlannedZipEntry => ({ path: entryPath, kind: 'file' });
const directory = (entryPath: string): PlannedZipEntry => ({ path: entryPath, kind: 'directory' });

describe('resolveSkillLayout', () => {
  it('a gyökérben álló SKILL.md mellett az előtag üres', () => {
    expect(resolveSkillLayout([file('SKILL.md'), directory('scripts'), file('scripts/a.sh')])).toStrictEqual({
      kind: 'ok',
      value: '',
    });
  });

  it('egyetlen legfelső mappa (könyvtár bejegyzéssel vagy anélkül) a lecsípendő előtag', () => {
    expect(resolveSkillLayout([directory('pdf'), file('pdf/SKILL.md'), file('pdf/ref/a.md')])).toStrictEqual({
      kind: 'ok',
      value: 'pdf/',
    });
    expect(resolveSkillLayout([file('pdf/SKILL.md')])).toStrictEqual({ kind: 'ok', value: 'pdf/' });
  });

  it.each([
    ['üres csomag', []],
    ['két legfelső mappa', [file('a/SKILL.md'), file('b/x.md')]],
    ['egyetlen gyökér fájl, ami nem SKILL.md', [file('readme.md')]],
    ['mappa és mellette gyökér fájl', [file('a/SKILL.md'), file('a')]],
  ])('%s: a gyökérben nincs SKILL.md és nem egy mappa van', (_label, entries) => {
    const outcome = resolveSkillLayout(entries);
    expect(outcome.kind === 'error' && outcome.message).toMatch(/\(skill_archive_layout_invalid\)\.$/u);
  });

  it('egyetlen mappa SKILL.md nélkül: hiányzó SKILL.md', () => {
    const outcome = resolveSkillLayout([directory('pdf'), file('pdf/readme.md'), file('pdf/sub/SKILL.md')]);
    expect(outcome.kind === 'error' && outcome.message).toMatch(/\(skill_manifest_missing\)\.$/u);
  });

  it('két SKILL.md a skill gyökerében: többszörös példány, mindkét elrendezésben', () => {
    const root = resolveSkillLayout([file('SKILL.md'), file('SKILL.md')]);
    const folder = resolveSkillLayout([file('pdf/SKILL.md'), file('pdf/SKILL.md')]);
    expect(root.kind === 'error' && root.message).toMatch(/2 SKILL\.md áll \(skill_manifest_duplicate\)\.$/u);
    expect(folder.kind === 'error' && folder.message).toMatch(/\(skill_manifest_duplicate\)\.$/u);
  });
});
