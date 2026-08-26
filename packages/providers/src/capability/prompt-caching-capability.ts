import type { Fact } from '../evidence/fact.ts';
import type { PromptCacheMode } from './prompt-cache-mode.ts';

export interface PromptCachingCapability {
  readonly mode: Fact<PromptCacheMode>;
  readonly explicitBreakpointLimit: Fact<number>;
  readonly ttlSeconds: Fact<number>;
  readonly minimumInputTokens: Fact<number>;
  /**
  A válasz `usage` objektumában megfigyelt cache mezők nevei.
  */
  readonly usageFields: Fact<readonly string[]>;
  /**
  Az env változó, amivel a kliens oldali cache jelölés kikapcsolható.
  */
  readonly disableEnvVar: Fact<string | null>;
  /**
   * Kimegy-e a dróton a hívó fél által kézzel, egy content blokkra rakott
   * `cache_control` jelölés akkor is, ha a `disableEnvVar` be van állítva.
   * Ha igen, a kapcsoló csak az SDK saját, automatikus töréspontjait veszi le,
   * tehát a prompt cache egy része a hívó fél kezében marad.
   */
  readonly callerBreakpointSurvivesDisable: Fact<boolean>;
}
