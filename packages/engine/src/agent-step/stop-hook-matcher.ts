/**
 * Egy `Stop` hook bejegyzés a kimenő `Options.hooks` objektumban
 * (SPEC-004 11.3 táblázat 2. sora, F-4, F-5).
 *
 * **Az alak forrása hivatalos dokumentáció, nem következtetés.** A `hooks`
 * opció eseménynév szerinti rekord, aminek az értéke matcher objektumok
 * tömbje; a matcher `hooks` mezője kötelező (a visszahívások tömbje), a
 * `matcher` és a `timeout` mezője opcionális, és a `Stop` esemény a `matcher`
 * mezőt figyelmen kívül hagyja, ezért itt egyik sem szerepel. Források:
 * https://code.claude.com/docs/en/agent-sdk/hooks ("Matchers" táblázat és a
 * `Stop: [{ hooks: [...] }]` TypeScript példa) és
 * https://platform.claude.com/docs/en/agent-sdk/typescript
 * (`HookCallbackMatcher`).
 *
 * A visszahívás bemenete itt `unknown`: a motor egyetlen sora sem függ az SDK
 * típusdefiníciójától (SPEC-004 3.3), a `stop_hook_active` mezőt saját
 * ellenőrzés olvassa ki. A kimenet a `Stop` hook dokumentált JSON alakja:
 * `decision: "block"` plusz a kötelező `reason`, illetve üres objektum, ha a
 * hook átengedi a leállást. Forrás: https://code.claude.com/docs/en/hooks
 * (a `Stop` esemény JSON kimenete) és a fenti agent-sdk hooks oldal.
 */
export interface StopHookMatcher {
  readonly hooks: readonly ((input: unknown) => {
    readonly decision?: 'block';
    readonly reason?: string;
  })[];
}
