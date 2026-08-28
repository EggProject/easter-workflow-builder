import type { Fact } from '../evidence/fact/fact.ts';

export interface ServerToolDescriptor {
  /**
  A body `tools[].type` értéke, ahogy a dróton megjelenne.
  */
  readonly wireType: string;
  readonly name: string;
  /**
  Elérhető-e a mi hívási utunkon, nem elméletben.
  */
  readonly available: Fact<boolean>;
  /**
  A workflow motor Agent SDK `Options.disallowedTools` listájának kliens oldali
  eszköznevét azonosítja ehhez a szerver oldali toolhoz (pl. a Claude Code
  `WebSearch` beépített eszköze mögött a `web_search_20250305` szerver oldali
  tool áll). Ha a tool nem elérhető ÉS ismert a kliens oldali neve, a motor ezt
  a nevet teszi a tiltólistára. A `null` érték azt jelenti, hogy nincs ismert
  kliens oldali megfelelő.
  */
  readonly clientToolName: Fact<string | null>;
}
