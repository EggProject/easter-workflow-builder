/**
 * A hibatérkép leszűkítése egy beágyazott objektum mezőjére: a `<prefix>.`
 * kezdetű útvonalakból levágja az előtagot, a többit eldobja.
 *
 * Miért kell: a `join` node `ai_synthesis` módja a teljes `AgentStepConfig`
 * alakot a `settings` mező ALATT tárolja, de ugyanazt az
 * `AgentStepConfigFields` komponenst használja, mint az `agent_step` node,
 * ahol ugyanezek a mezők a gyökéren állnak. A komponens tehát
 * `promptTemplate` útvonalon keresi a hibát, a `join` alatti tényleges
 * útvonal viszont `settings.promptTemplate`.
 */
export function scopeFieldErrors(errors: ReadonlyMap<string, string>, prefix: string): ReadonlyMap<string, string> {
  const scoped = new Map<string, string>();
  const fullPrefix = `${prefix}.`;
  for (const [path, message] of errors) {
    if (path.startsWith(fullPrefix)) {
      scoped.set(path.slice(fullPrefix.length), message);
    }
  }
  return scoped;
}
