/**
 * A motor beépített hookjainak azonosítói, amiket lépésenként be lehet
 * kapcsolni (SPEC-003 4.4, "Az `enabledEngineHooks` **nem** az SDK `hooks`
 * mezője"). Az SDK `hooks` opciója callback map (research 1. szekció,
 * "Hookok"), tehát nem szerializálható; a DB azt tárolja, melyik saját hookot
 * kell a motornak összeállítania.
 *
 * Az első verzióban pontosan egy érték van: az `emit_output_tool` strukturált
 * kimenet stratégiához tartozó `Stop` hook (SPEC-003 4.6), ami a research
 * szerint `decision: "block"` válasszal küldi vissza dolgozni az agentet, amíg
 * a kötelező `emit_output` eszközt meg nem hívta. Az azonosító a stratégia
 * nevéből (`StructuredOutputStrategyId` = `emit_output_tool`) és az SDK hook
 * esemény nevéből (`Stop`) áll össze, a tárolt szótárak snake_case alakjában.
 */
export type EngineHookId = 'emit_output_tool_stop';
