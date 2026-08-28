/* eslint-disable unicorn/no-null -- a `ServerToolDescriptor.clientToolName` mező típusa `Fact<string | null>`, ahol a `null` azt jelenti, hogy a szerver oldali toolnak nincs kliens oldali megfelelője; a teszt ezt az ágat is fedi */
import { describe, expect, it } from 'vitest';
import type { Fact, ServerToolDescriptor } from '@easter-workflow-builder/provider-capability';
import { resolveDisallowedServerTools } from './resolve-disallowed-server-tools.ts';

function knownFact<TValue>(value: TValue): Fact<TValue> {
  return { state: 'known', value, evidence: [{ kind: 'measurement', id: 'M-01' }] };
}

function unknownFact<TValue>(): Fact<TValue> {
  return { state: 'unknown', reason: 'A mérés még nem futott le.', blockedBy: ['M-99'] };
}

// A tool nevek szándékosan kitaláltak: a motor szabálya generikus, a nevet
// kizárólag a leíróból veszi (SPEC-004 17. szekció 61. kritérium).
function buildTool(available: Fact<boolean>, clientToolName: Fact<string | null>): ServerToolDescriptor {
  return { wireType: 'fake_server_tool_20990101', name: 'fake_server_tool', available, clientToolName };
}

describe('resolveDisallowedServerTools', () => {
  it('known igaz: az elérhető toolt nem tiltjuk', () => {
    const tools = knownFact<readonly ServerToolDescriptor[]>([
      buildTool(knownFact(true), knownFact<string | null>('FakeSearchTool')),
    ]);

    expect(resolveDisallowedServerTools(tools)).toStrictEqual({
      disallowedTools: [],
      serverToolAvailabilityUnproven: false,
    });
  });

  it('known hamis és ismert a kliens tool neve: a név felkerül a tiltólistára', () => {
    const tools = knownFact<readonly ServerToolDescriptor[]>([
      buildTool(knownFact(false), knownFact<string | null>('FakeSearchTool')),
    ]);

    expect(resolveDisallowedServerTools(tools)).toStrictEqual({
      disallowedTools: ['FakeSearchTool'],
      serverToolAvailabilityUnproven: false,
    });
  });

  it('known hamis, de nincs kliens oldali megfelelő: nincs mit tiltani, és ez nem bizonytalanság', () => {
    const tools = knownFact<readonly ServerToolDescriptor[]>([
      buildTool(knownFact(false), knownFact<string | null>(null)),
    ]);

    expect(resolveDisallowedServerTools(tools)).toStrictEqual({
      disallowedTools: [],
      serverToolAvailabilityUnproven: false,
    });
  });

  it('known hamis, de a kliens tool neve unknown: nem tiltunk, és jelöljük', () => {
    const tools = knownFact<readonly ServerToolDescriptor[]>([
      buildTool(knownFact(false), unknownFact<string | null>()),
    ]);

    expect(resolveDisallowedServerTools(tools)).toStrictEqual({
      disallowedTools: [],
      serverToolAvailabilityUnproven: true,
    });
  });

  it('unknown available: nem tiltunk, és jelöljük', () => {
    const tools = knownFact<readonly ServerToolDescriptor[]>([
      buildTool(unknownFact<boolean>(), knownFact<string | null>('FakeSearchTool')),
    ]);

    expect(resolveDisallowedServerTools(tools)).toStrictEqual({
      disallowedTools: [],
      serverToolAvailabilityUnproven: true,
    });
  });

  it('unknown serverTools: a tool lista maga sem ismert, nem tiltunk, és jelöljük', () => {
    expect(resolveDisallowedServerTools(unknownFact<readonly ServerToolDescriptor[]>())).toStrictEqual({
      disallowedTools: [],
      serverToolAvailabilityUnproven: true,
    });
  });

  it('több tool: a tiltandó nevek gyűlnek, a bizonytalanság jelölése egyetlen bizonytalan toolból is igaz lesz', () => {
    const tools = knownFact<readonly ServerToolDescriptor[]>([
      buildTool(knownFact(true), knownFact<string | null>('FakeAvailableTool')),
      buildTool(knownFact(false), knownFact<string | null>('FakeBrokenToolA')),
      buildTool(knownFact(false), knownFact<string | null>('FakeBrokenToolB')),
      buildTool(unknownFact<boolean>(), knownFact<string | null>('FakeUnprovenTool')),
    ]);

    expect(resolveDisallowedServerTools(tools)).toStrictEqual({
      disallowedTools: ['FakeBrokenToolA', 'FakeBrokenToolB'],
      serverToolAvailabilityUnproven: true,
    });
  });

  it('üres, de ismert tool lista: nincs tiltás és nincs bizonytalanság', () => {
    expect(resolveDisallowedServerTools(knownFact<readonly ServerToolDescriptor[]>([]))).toStrictEqual({
      disallowedTools: [],
      serverToolAvailabilityUnproven: false,
    });
  });
});
