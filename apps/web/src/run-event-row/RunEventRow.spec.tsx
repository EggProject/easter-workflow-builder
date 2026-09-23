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
      root.render(<RunEventRow record={BASE_RECORD} providerId="claude-subscription" />);
    });
    expect(header().textContent).toContain('SDK');
    expect(header().textContent).toContain('Eszközhívás');
    expect(header().textContent).toContain('web_search');
    expect(header().textContent).toContain('tool-abc123');
  });

  it('alapértelmezésben zárva indul, aria-expanded="false" és a törzs rejtett', () => {
    act(() => {
      root.render(<RunEventRow record={BASE_RECORD} providerId="claude-subscription" />);
    });
    expect(header().getAttribute('aria-expanded')).toBe('false');
    expect(body().hidden).toBe(true);
  });

  it('kinyitható: a fejlécre kattintva aria-expanded="true" lesz, és a teljes payload megjelenik', () => {
    act(() => {
      root.render(<RunEventRow record={BASE_RECORD} providerId="claude-subscription" />);
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
      root.render(<RunEventRow record={BASE_RECORD} providerId="claude-subscription" />);
    });
    expect(header().tagName).toBe('BUTTON');
    expect(header().type).toBe('button');
    expect(header().parentElement?.tagName).toBe('H3');
  });

  it('a fejléc szövege a típuscímkét kettősponttal választja el a törzstől, gondolatjel nélkül', () => {
    act(() => {
      root.render(<RunEventRow record={BASE_RECORD} providerId="claude-subscription" />);
    });
    expect(header().textContent).toContain('Eszközhívás: web_search (tool-abc123)');
    expect(header().textContent).not.toContain('\u{2014}');
  });

  it('az sdk eredetű sor a run-event-row--origin-sdk osztályt és a Bot jelölőt kapja a jelölő oszlopban', () => {
    act(() => {
      root.render(<RunEventRow record={BASE_RECORD} providerId="claude-subscription" />);
    });
    expect(container.querySelector('.run-event-row')?.classList.contains('run-event-row--origin-sdk')).toBe(true);
    // A jelölő oszlop a fejléc ELSŐ gyereke, a cím előtt (SPEC-008 7.2 1. pont).
    const markerColumn = header().firstElementChild;
    expect(markerColumn?.getAttribute('class')).toBe('accordion__icon');
    expect(markerColumn?.querySelector('svg')?.dataset['originMarker']).toBe('sdk');
    expect(markerColumn?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('az engine eredetű sor a run-event-row--origin-engine osztályt és a Workflow jelölőt kapja', () => {
    act(() => {
      root.render(
        <RunEventRow
          record={{ ...BASE_RECORD, origin: 'engine', kind: 'run_started', toolName: null, toolUseId: null }}
          providerId="claude-subscription"
        />,
      );
    });
    expect(container.querySelector('.run-event-row')?.classList.contains('run-event-row--origin-engine')).toBe(true);
    expect(header().textContent).toContain('Motor');
    const markerColumn = header().firstElementChild;
    expect(markerColumn?.getAttribute('class')).toBe('accordion__icon');
    expect(markerColumn?.querySelector('svg')?.dataset['originMarker']).toBe('engine');
  });

  it('a két eredet jelölője eltérő alakú, tehát nem csak a szín különbözteti meg őket', () => {
    act(() => {
      root.render(<RunEventRow record={BASE_RECORD} providerId="claude-subscription" />);
    });
    const sdkMarkup = header().firstElementChild?.getHTML();
    act(() => {
      root.render(
        <RunEventRow
          record={{ ...BASE_RECORD, origin: 'engine', kind: 'run_started', toolName: null, toolUseId: null }}
          providerId="claude-subscription"
        />,
      );
    });
    const engineMarkup = header().firstElementChild?.getHTML();
    expect(sdkMarkup).toBeDefined();
    expect(engineMarkup).toBeDefined();
    expect(sdkMarkup).not.toBe(engineMarkup);
  });

  describe('az sdk_result költség mezője, providerfüggő (user döntés 2026-09-23, pontosítva)', () => {
    const RESULT_RECORD: RunEventRecord = {
      ...BASE_RECORD,
      kind: 'sdk_result',
      toolName: null,
      toolUseId: null,
      numTurns: 3,
      payload: { type: 'result', subtype: 'success', total_cost_usd: 0.213108, num_turns: 3 },
    };

    describe('claude-subscription provider mellett', () => {
      it('az összesítő sorban külön, megnevezett meta mezőként jelenik meg, SDK becslésként', () => {
        act(() => {
          root.render(<RunEventRow record={RESULT_RECORD} providerId="claude-subscription" />);
        });
        expect(container.querySelector('.accordion__meta')?.textContent).toBe('Költség (SDK becslés): $0.2131');
        expect(container.querySelector('.accordion__title')?.textContent).not.toContain('$0.2131');
      });

      it('a kinyitott nézetben is külön mezőként áll, a jelentését kimondó magyarázattal', () => {
        act(() => {
          root.render(<RunEventRow record={RESULT_RECORD} providerId="claude-subscription" />);
        });
        act(() => {
          header().click();
        });
        const costField = body().querySelector('.run-event-row__cost');
        expect(costField?.querySelector('strong')?.textContent).toBe('Költség (SDK becslés):');
        expect(costField?.textContent).toContain('$0.2131');
        expect(costField?.textContent).toContain('becslés, nem számla');
        expect(costField?.textContent).toContain('Claude előfizetésnél');
        // A nyers payload továbbra is teljes egészében látszik a mező alatt.
        expect(body().textContent).toContain('"total_cost_usd": 0.213108');
      });
    });

    describe('minimax provider mellett', () => {
      it('az összesítő sorban nincs meta mező, és a fejléc szövege sem tartalmaz dollár összeget', () => {
        act(() => {
          root.render(<RunEventRow record={RESULT_RECORD} providerId="minimax" />);
        });
        expect(container.querySelector('.accordion__meta')).toBeNull();
        expect(header().textContent).not.toContain('$');
        expect(header().textContent).not.toContain('Költség');
      });

      it('a kinyitott nézetben sincs dollár összeg vagy "Költség" felirat, csak a magyarázó mondat', () => {
        act(() => {
          root.render(<RunEventRow record={RESULT_RECORD} providerId="minimax" />);
        });
        act(() => {
          header().click();
        });
        expect(body().textContent).not.toContain('$0.2131');
        expect(body().textContent).not.toContain('Költség (SDK becslés)');
        expect(body().textContent).toContain('A MiniMax-M3 modellre az Agent SDK nem ismer valós árat');
        // A nyers payload (a szám maga, mezőnévvel együtt) továbbra is a JSON blokkban áll,
        // de ez nem a felület saját "Költség" szövege, hanem a menekülőút a nyers adathoz.
        expect(body().textContent).toContain('"total_cost_usd": 0.213108');
      });

      it('a teljes kirajzolt DOM-ban sehol nem marad rejtett költség szöveg', () => {
        act(() => {
          root.render(<RunEventRow record={RESULT_RECORD} providerId="minimax" />);
        });
        act(() => {
          header().click();
        });
        expect(container.textContent).not.toContain('$0.2131');
        expect(container.textContent).not.toContain('Költség (SDK becslés)');
      });
    });

    describe('fel nem oldott provider mellett (T-009-25)', () => {
      it('nincs meta mező, a kinyitott nézetben pedig sem költség, sem MiniMax állítás, csak a saját magyarázat', () => {
        act(() => {
          root.render(<RunEventRow record={RESULT_RECORD} providerId={undefined} />);
        });
        expect(container.querySelector('.accordion__meta')).toBeNull();
        act(() => {
          header().click();
        });
        expect(body().textContent).not.toContain('Költség (SDK becslés)');
        expect(body().textContent).not.toContain('MiniMax');
        expect(body().textContent).toContain('A lépés providere ebben a nézetben nem ismert');
      });
    });

    it('nem sdk_result sorban nincs sem meta, sem költség mező, egyik provideren sem', () => {
      act(() => {
        root.render(<RunEventRow record={BASE_RECORD} providerId="claude-subscription" />);
      });
      expect(container.querySelector('.accordion__meta')).toBeNull();
      expect(container.querySelector('.run-event-row__cost')).toBeNull();
      act(() => {
        root.render(<RunEventRow record={BASE_RECORD} providerId="minimax" />);
      });
      expect(container.querySelector('.accordion__meta')).toBeNull();
      expect(container.querySelector('.run-event-row__cost')).toBeNull();
    });
  });
});
