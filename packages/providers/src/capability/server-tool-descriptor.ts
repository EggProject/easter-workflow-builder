import type { Fact } from '../evidence/fact.ts';

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
}
