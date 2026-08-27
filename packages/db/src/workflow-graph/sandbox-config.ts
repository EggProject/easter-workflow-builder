/**
 * Az `Options.sandbox` tárolt alakja. A mezőlista a research 1. szekció
 * "`sandbox`" bekezdéséből származik, egyetlen mező sincs hozzátéve.
 *
 * **Öt mező típusa nyitott.** A research a mezők NEVÉT sorolja fel, a
 * pontos alakjukat nem. Ahol a hivatalos sandbox dokumentáció egyértelműen
 * mutatja a típust, ott az szerepel: a `failIfUnavailable` és az
 * `autoAllowBashIfSandboxed` logikai kapcsoló ("set it to `false`", "defaults
 * to `true`"), az `excludedCommands` parancslista ("add the command to
 * `excludedCommands`"), forrás: https://code.claude.com/docs/en/sandboxing. Az
 * `enabled` és az `enableWeakerNestedSandbox` a nevéből következően logikai.
 *
 * A maradék öt mező (`allowUnsandboxedCommands`, `network`, `filesystem`,
 * `ignoreViolations`, `ripgrep`) `unknown` és opcionális: a `network` és a
 * `filesystem` a dokumentáció szerint összetett objektum (allowlist, deny
 * szabályok, `disabled` kapcsoló), a másik háromnál a lista és a logikai alak
 * között nem lehet a forrásokból dönteni. Tippelni tilos, ezért ezeket a
 * typeguard sem szűkíti; a pontos alakjuk lezárása külön mérést vagy hivatalos
 * SDK típusforrást igényel.
 */
export interface SandboxConfig {
  readonly enabled: boolean;
  readonly failIfUnavailable: boolean;
  readonly autoAllowBashIfSandboxed: boolean;
  readonly excludedCommands: readonly string[];
  readonly enableWeakerNestedSandbox: boolean;
  readonly allowUnsandboxedCommands?: unknown;
  readonly network?: unknown;
  readonly filesystem?: unknown;
  readonly ignoreViolations?: unknown;
  readonly ripgrep?: unknown;
}
