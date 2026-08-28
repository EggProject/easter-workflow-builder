import type { AgentStepConfig } from '@easter-workflow-builder/db';
import type { ThinkingMode } from '@easter-workflow-builder/provider-capability';
import type { StopHookMatcher } from './stop-hook-matcher.ts';

/**
 * A kimenő Agent SDK `Options` objektum **típusos** alakja, amit a motor
 * ténylegesen összeállít (SPEC-004 3.3: "A szűkítést a motor ... témája végzi,
 * típusosan; a port maga nem duplikálja az SDK `Options` típusát").
 *
 * **Miért `type` és nem `interface`.** Az `AgentQueryRequest.options` mező
 * típusa `Readonly<Record<string, unknown>>`; egy `interface` alakú objektum
 * arra nem hozzárendelhető, mert nincs implicit index szignatúrája, egy
 * objektum literál típusalias viszont igen. Így az adapter felé nem kell `as`
 * kényszerítés (`.claude/CLAUDE.md` 5.).
 *
 * **Minden mező forrása az F-2 tény**, tehát a research 1. szekciójában
 * névvel felsorolt `Options` mező; kitalált mező nincs. A típusok több
 * helyen indexelt hozzáféréssel jönnek a tárolt `AgentStepConfig` alakból
 * (`systemPrompt`, `skills`, `sandbox`, `agents`), mert a motor ezeket
 * változatlanul adja tovább, tehát a két alaknak együtt kell mozognia.
 *
 * **Az opcionális mezők a "nincs kiküldve" esetet jelentik**, nem az
 * `undefined` értéket: az `exactOptionalPropertyTypes` mellett a hiányzó mező
 * és az `undefined` érték nem ugyanaz, és a motor a hiányzó mezőt küldi
 * (SPEC-004 11.2, "a motor vagy elhagyja a mezőt").
 *
 * **A `persistSession` szándékosan `true` literál típusú**: a motor minden
 * lépésnél explicit `true` értéket ad (SPEC-004 6.3, 32. elfogadási
 * kritérium), tehát a hamis érték típusszinten sem állítható be. A
 * `sessionStore` opciót a motor nem használja (F-14).
 */
/* eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- itt szándékosan objektum literál típusalias áll, nem `interface`: az `AgentQueryRequest.options` mező típusa `Readonly<Record<string, unknown>>`, amire egy `interface` alakú objektum nem hozzárendelhető (nincs implicit index szignatúrája, mert az interfész később kiterjeszthető), egy típusalias viszont igen. Interfésszel az adapter felé `as` kényszerítés kellene, ami tiltott (`.claude/CLAUDE.md` 5.) */
export type AgentStepOptions = {
  readonly model: string;
  readonly allowedTools: readonly string[];
  readonly disallowedTools: readonly string[];
  readonly additionalDirectories: readonly string[];
  readonly agents: AgentStepConfig['agents'];
  readonly env: Readonly<Record<string, string>>;
  readonly includePartialMessages: boolean;
  readonly persistSession: true;
  readonly thinking?: ThinkingMode;
  readonly effort?: string;
  readonly permissionMode?: string;
  readonly maxTurns?: number;
  readonly maxBudgetUsd?: number;
  readonly systemPrompt?: NonNullable<AgentStepConfig['systemPrompt']>;
  readonly skills?: NonNullable<AgentStepConfig['skills']>;
  readonly cwd?: string;
  readonly sandbox?: NonNullable<AgentStepConfig['sandbox']>;
  readonly resume?: string;
  readonly forkSession?: boolean;
  readonly outputFormat?: { readonly type: 'json_schema'; readonly schema: unknown };
  readonly hooks?: { readonly Stop: readonly StopHookMatcher[] };
};
