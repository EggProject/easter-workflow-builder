/* eslint-disable unicorn/no-null -- a szintetikus RunEventRecord fixture nullázható mezői a dróton ténylegesen `null` értéket hordoznak, nem helyőrző `undefined`-et */
import type { RunEventRecord } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RunEventRow } from './RunEventRow.tsx';

const BASE_RECORD: RunEventRecord = {
  id: 7,
  runId: 'run-1',
  stepRunId: null,
  origin: 'sdk',
  kind: 'sdk_assistant',
  occurredAtMs: Date.UTC(2026, 8, 22, 14, 32, 7),
  sdkMessageType: 'assistant',
  sdkMessageSubtype: null,
  sdkSessionId: null,
  sdkUuid: null,
  parentToolUseId: null,
  toolName: 'web_search',
  toolUseId: 'tool-abc123',
  inputTokens: 10,
  outputTokens: 20,
  cacheReadInputTokens: 0,
  cacheCreationInputTokens: 0,
  numTurns: null,
  payload: { type: 'assistant', message: { content: [] } },
};

describe('RunEventRow', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  function header(): HTMLButtonElement {
    const element = container.querySelector<HTMLButtonElement>('.accordion__header');
    if (element === null) {
      throw new Error('a sor fejléc gombja nem található a kirajzolt fán');
    }
    return element;
  }

  function body(): HTMLDivElement {
    const element = container.querySelector<HTMLDivElement>('.accordion__body');
    if (element === null) {
      throw new Error('a sor törzse nem található a kirajzolt fán');
    }
    return element;
  }

  it('a fejléc tartalmazza az időbélyeget, az eredetet, a típuscímkét és a törzs szöveget', () => {
    act(() => {
      root.render(<RunEventRow record={BASE_RECORD} />);
    });
    expect(header().textContent).toContain('SDK');
    expect(header().textContent).toContain('Eszközhívás');
    expect(header().textContent).toContain('web_search');
    expect(header().textContent).toContain('tool-abc123');
  });

  it('alapértelmezésben zárva indul, aria-expanded="false" és a törzs rejtett', () => {
    act(() => {
      root.render(<RunEventRow record={BASE_RECORD} />);
    });
    expect(header().getAttribute('aria-expanded')).toBe('false');
    expect(body().hidden).toBe(true);
  });

  it('kinyitható: a fejlécre kattintva aria-expanded="true" lesz, és a teljes payload megjelenik', () => {
    act(() => {
      root.render(<RunEventRow record={BASE_RECORD} />);
    });
    act(() => {
      header().click();
    });
    expect(header().getAttribute('aria-expanded')).toBe('true');
    expect(body().hidden).toBe(false);
    expect(body().textContent).toContain('"type": "assistant"');
  });

  it('a fejléc natív <button> egy natív <h3>-ban, tehát billentyűzetről is nyitható', () => {
    act(() => {
      root.render(<RunEventRow record={BASE_RECORD} />);
    });
    expect(header().tagName).toBe('BUTTON');
    expect(header().type).toBe('button');
    expect(header().parentElement?.tagName).toBe('H3');
  });

  it('az sdk eredetű sor a run-event-row--origin-sdk osztályt kapja', () => {
    act(() => {
      root.render(<RunEventRow record={BASE_RECORD} />);
    });
    expect(container.querySelector('.run-event-row')?.classList.contains('run-event-row--origin-sdk')).toBe(true);
  });

  it('az engine eredetű sor a run-event-row--origin-engine osztályt kapja', () => {
    act(() => {
      root.render(
        <RunEventRow
          record={{ ...BASE_RECORD, origin: 'engine', kind: 'run_started', toolName: null, toolUseId: null }}
        />,
      );
    });
    expect(container.querySelector('.run-event-row')?.classList.contains('run-event-row--origin-engine')).toBe(true);
    expect(header().textContent).toContain('Motor');
  });

  it('sehol nem jelenik meg költség szöveg a kirajzolt fejlécben', () => {
    act(() => {
      root.render(<RunEventRow record={{ ...BASE_RECORD, kind: 'sdk_result', numTurns: 3 }} />);
    });
    expect(header().textContent).not.toMatch(/total_cost_usd|\bcost\b/i);
  });
});
