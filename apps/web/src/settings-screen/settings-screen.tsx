import type { FetchFunction } from '@easter-workflow-builder/core';
import { useMemo, type ReactElement } from 'react';
import { createProviderConnectionTester } from '../provider-select/create-provider-connection-tester.ts';
import { SkillLibrarySettingsCard } from '../skill-upload/SkillLibrarySettingsCard.tsx';
import { useSkillLibrary } from '../skill-upload/use-skill-library.ts';
import { ConcurrencyLimitsSettingsCard } from './ConcurrencyLimitsSettingsCard.tsx';
import { EditorSettingsCard } from './EditorSettingsCard.tsx';
import { ProviderSettingsCard } from './ProviderSettingsCard.tsx';
import { RunLogSettingsCard } from './RunLogSettingsCard.tsx';
import { useConcurrencyLimits } from './use-concurrency-limits.ts';
import { useProviderList } from './use-provider-list.ts';
import { useSettingsRecord } from './use-settings-record.ts';
import './settings-screen.css';

export interface SettingsScreenProperties {
  readonly apiOrigin: string;
  readonly fetchFunction: FetchFunction;
}

/**
 * A Beállítások képernyő (SPEC-008 5.11, O-32; SPEC-009 3.1, O-8): kártyák
 * egymás alatt egy oldalon, oldalsó navigáció nélkül, a teljes szélességen.
 * Kártya a kártyában nincs (`.claude/CLAUDE.md` 11. szekció). A SPEC-009 3.1
 * sorrendje: Provider, Párhuzamossági korlát, Futás napló, Skill könyvtár, MCP
 * szerverek, gráf szerkesztő; az MCP szerverek kártya (még nem megvalósult) a
 * saját lépésében kerül a sorba, a helyén.
 *
 * A képernyő tölti a kártyák adatát, hogy a kérések ne a megjelenítésben
 * éljenek: a provider listát (`GET /api/providers`, a Provider és a
 * Párhuzamossági korlát kártya közös), a beállítás rekordot (`GET`/`PUT
 * /api/settings`) és a providerenkénti korlátokat (`GET
 * /api/settings/concurrency-limits`, soronként `PUT`/`DELETE`) és a skill
 * könyvtárat (`GET /api/skills`, `PUT`/`DELETE /api/skills/:name`). A
 * "Kapcsolat teszt" hívása a provider választóé (SPEC-009 3.2).
 */
export function SettingsScreen(properties: Readonly<SettingsScreenProperties>): ReactElement {
  const { apiOrigin, fetchFunction } = properties;
  const providersState = useProviderList(apiOrigin, fetchFunction);
  const { state: settingsState, save: saveSettings } = useSettingsRecord(apiOrigin, fetchFunction);
  const concurrencyLimits = useConcurrencyLimits(apiOrigin, fetchFunction);
  const skillLibrary = useSkillLibrary(apiOrigin, fetchFunction);
  const testConnection = useMemo(
    () => createProviderConnectionTester(apiOrigin, fetchFunction),
    [apiOrigin, fetchFunction],
  );

  return (
    <div className="settings-screen">
      <ProviderSettingsCard
        providersState={providersState}
        settingsState={settingsState}
        saveSettings={saveSettings}
        testConnection={testConnection}
      />
      <ConcurrencyLimitsSettingsCard
        providersState={providersState}
        limitsState={concurrencyLimits.state}
        saveLimit={concurrencyLimits.saveLimit}
        clearLimit={concurrencyLimits.clearLimit}
      />
      <RunLogSettingsCard settingsState={settingsState} saveSettings={saveSettings} />
      <SkillLibrarySettingsCard
        skillsState={skillLibrary.state}
        uploadSkill={skillLibrary.uploadSkill}
        deleteSkill={skillLibrary.deleteSkill}
      />
      <EditorSettingsCard />
    </div>
  );
}
