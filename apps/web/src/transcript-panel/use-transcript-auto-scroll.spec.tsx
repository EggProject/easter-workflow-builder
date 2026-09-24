/* eslint-disable unicorn/no-null -- a ListImperativeAPI `element` gettere a könyvtár szerződése szerint `null`-t ad, ha nincs csatolt elem */
import { act, useEffect, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { DynamicRowHeight, ListImperativeAPI } from 'react-window';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTranscriptAutoScroll, type TranscriptAutoScroll } from './use-transcript-auto-scroll.ts';

/**
 * A `useDynamicRowHeight` gyorsítótár teszt duplikátuma. A hook csak az
 * identitását figyeli: egy új példány egy kirajzolt sor megváltozott mért
 * magasságát jelenti.
 */
function createRowHeight(): DynamicRowHeight {
  return {
    getAverageRowHeight: () => 53,
    getRowHeight: () => 53,
    setRowHeight: vi.fn(),
    observeRowElements: vi.fn(() => vi.fn()),
  };
}

const INITIAL_ROW_HEIGHT = createRowHeight();

/**
 * Egy buborékoló `click` esemény a célon, ahogy a böngésző a kattintást a
 * fejléc gombon belüli elemre (vagy a lista elemére) adja.
 */
function click(target: EventTarget): void {
  act(() => {
    target.dispatchEvent(new Event('click', { bubbles: true }));
  });
}

/**
 * A SPEC-008 7.4 szerint az automatikus görgetés predikátuma "unit tesztben
 * közvetlenül léptethető, mert az onRowsRendered callback szintetikusan
 * meghívható": ez a spec pontosan ezt teszi, egy valódi lista helyett a
 * `ListImperativeAPI` teszt duplikátumával, ami a `scrollToRow` hívásokat
 * rögzíti.
 */
describe('useTranscriptAutoScroll', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: TranscriptAutoScroll | undefined;
  const scrollToRow = vi.fn();
  const fakeList: ListImperativeAPI = {
    get element() {
      return null;
    },
    scrollToRow,
  };

  /**
   * Egy a hook effektjei ELŐTT futó lépés egy későbbi commitban: a gyerek
   * komponens passzív effektje a szülőé előtt fut. A `skippedCommits` számú
   * commit után egyszer fut le.
   */
  let probe: { skippedCommits: number; readonly run: () => void } | undefined;

  function Probe(): null {
    useEffect(() => {
      if (probe === undefined) {
        return;
      }
      if (probe.skippedCommits > 0) {
        probe.skippedCommits -= 1;
        return;
      }
      const { run } = probe;
      probe = undefined;
      run();
    });
    return null;
  }

  function Harness({
    rowCount,
    rowHeight,
  }: {
    readonly rowCount: number;
    readonly rowHeight: DynamicRowHeight;
  }): ReactElement {
    latest = useTranscriptAutoScroll(rowCount, rowHeight);
    return <Probe />;
  }

  function current(): TranscriptAutoScroll {
    if (latest === undefined) {
      throw new Error('a hook még nem renderelt');
    }
    return latest;
  }

  function renderRows(rowCount: number, rowHeight: DynamicRowHeight = INITIAL_ROW_HEIGHT): void {
    act(() => {
      root.render(<Harness rowCount={rowCount} rowHeight={rowHeight} />);
    });
  }

  /**
   * A lista csatolása és a csatolás utáni első jelentés: a lista az aljára
   * görgetett (a hook a csatoláskor is követ), tehát az utolsó sor látható.
   */
  function mountAtBottom(rowCount: number, list: ListImperativeAPI = fakeList): void {
    renderRows(rowCount);
    act(() => {
      current().setList(list);
    });
    act(() => {
      current().onRowsRendered({ startIndex: 0, stopIndex: rowCount - 1 });
    });
    scrollToRow.mockClear();
  }

  beforeEach(() => {
    scrollToRow.mockClear();
    latest = undefined;
    probe = undefined;
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

  it('a lista csatolásakor a már meglévő sorok aljára görget', () => {
    renderRows(10);
    expect(scrollToRow).not.toHaveBeenCalled();
    act(() => {
      current().setList(fakeList);
    });
    expect(scrollToRow).toHaveBeenCalledWith({ index: 9, align: 'end' });
  });

  it('üres listán nem görget', () => {
    renderRows(0);
    act(() => {
      current().setList(fakeList);
    });
    expect(scrollToRow).not.toHaveBeenCalled();
  });

  it('az alján állva (stopIndex === rowCount - 1) új sor érkezésekor az utolsó sorra görget, számlálás nélkül', () => {
    mountAtBottom(10);

    renderRows(11);
    expect(scrollToRow).toHaveBeenCalledWith({ index: 10, align: 'end' });
    expect(current().unseenCount).toBe(0);
  });

  it('a még el nem görgetett, régi tartományról szóló jelentés gyors egymásutáni érkezésnél sem állítja le a követést', () => {
    mountAtBottom(10);

    renderRows(11);
    // A lista a növekedés után, de a görgetés előtt a régi tartományt
    // jelenti: 9 a 11 sorból.
    act(() => {
      current().onRowsRendered({ startIndex: 0, stopIndex: 9 });
    });
    renderRows(12);
    expect(scrollToRow).toHaveBeenLastCalledWith({ index: 11, align: 'end' });
    expect(current().unseenCount).toBe(0);
  });

  it('felgörgetett állapotban új sor érkezésekor NEM görget, és megszámolja az új sorokat', () => {
    mountAtBottom(10);
    act(() => {
      current().onRowsRendered({ startIndex: 0, stopIndex: 5 });
    });

    renderRows(12);
    renderRows(13);
    expect(scrollToRow).not.toHaveBeenCalled();
    expect(current().unseenCount).toBe(3);
  });

  it('az ugrás az aljára visszakapcsolja a követést: az utolsó sorra görget, és nullázza a számlálót', () => {
    mountAtBottom(10);
    act(() => {
      current().onRowsRendered({ startIndex: 0, stopIndex: 5 });
    });
    renderRows(12);
    expect(current().unseenCount).toBe(2);

    act(() => {
      current().jumpToBottom();
    });
    expect(scrollToRow).toHaveBeenCalledWith({ index: 11, align: 'end' });
    expect(current().unseenCount).toBe(0);

    renderRows(13);
    expect(scrollToRow).toHaveBeenLastCalledWith({ index: 12, align: 'end' });
  });

  it('átméretezéskor követés közben az utolsó sorra görget (a rejtett fülből előtűnő lista esete)', () => {
    mountAtBottom(10);

    act(() => {
      current().onResize();
    });
    expect(scrollToRow).toHaveBeenCalledWith({ index: 9, align: 'end' });
  });

  it('átméretezéskor felgörgetett állapotban nem görget', () => {
    mountAtBottom(10);
    act(() => {
      current().onRowsRendered({ startIndex: 0, stopIndex: 5 });
    });
    scrollToRow.mockClear();

    act(() => {
      current().onResize();
    });
    expect(scrollToRow).not.toHaveBeenCalled();
  });

  it('ha a felhasználó kézzel visszagörget az aljára, a követés visszakapcsol', () => {
    mountAtBottom(10);
    act(() => {
      current().onRowsRendered({ startIndex: 0, stopIndex: 5 });
    });
    renderRows(11);
    expect(current().unseenCount).toBe(1);

    act(() => {
      current().onRowsRendered({ startIndex: 4, stopIndex: 10 });
    });
    expect(current().unseenCount).toBe(0);
    scrollToRow.mockClear();

    renderRows(12);
    expect(scrollToRow).toHaveBeenCalledWith({ index: 11, align: 'end' });
  });

  /**
   * A lista teszt duplikátuma valódi (happy-dom) elemmel, amin a felhasználó
   * kattintása kiváltható.
   */
  function listWithElement(): { readonly list: ListImperativeAPI; readonly element: HTMLDivElement } {
    const element = document.createElement('div');
    return {
      element,
      list: {
        get element() {
          return element;
        },
        scrollToRow,
      },
    };
  }

  /**
   * Egy sor fejléce: `aria-expanded` gomb, benne a cím, ahogy a valódi
   * sorban. A kattintás célja a cím (a gombon BELÜLI elem).
   */
  function addDisclosure(element: HTMLDivElement): HTMLSpanElement {
    const header = document.createElement('button');
    header.setAttribute('aria-expanded', 'false');
    const title = document.createElement('span');
    header.append(title);
    element.append(header);
    return title;
  }

  it('a sormagasság gyorsítótár változása önmagában nem görget', () => {
    mountAtBottom(10);

    renderRows(10, createRowHeight());
    expect(scrollToRow).not.toHaveBeenCalled();
  });

  describe('sor kinyitása élő stream közben', () => {
    it('a mérésig érkező új sor nem görget, és a nem látott sorok közé kerül', () => {
      const { list, element } = listWithElement();
      mountAtBottom(10, list);

      click(addDisclosure(element));
      renderRows(11);
      expect(scrollToRow).not.toHaveBeenCalled();
      expect(current().unseenCount).toBe(1);
    });

    it('a már kirajzolt, de effektjét még le nem futtatott érkezés elé eső kattintás után az érkezés sem görget, és a nem látottak közé kerül', () => {
      const { list, element } = listWithElement();
      mountAtBottom(10, list);

      const title = addDisclosure(element);
      probe = {
        skippedCommits: 0,
        run: () => {
          title.dispatchEvent(new Event('click', { bubbles: true }));
        },
      };
      renderRows(11);
      expect(probe).toBeUndefined();
      expect(scrollToRow).not.toHaveBeenCalled();
      expect(current().unseenCount).toBe(1);
    });

    it('a mérés előtti jelentés, ami szerint az utolsó sor látható, nem kapcsolja vissza a követést', () => {
      const { list, element } = listWithElement();
      mountAtBottom(10, list);

      click(addDisclosure(element));
      act(() => {
        current().onRowsRendered({ startIndex: 0, stopIndex: 9 });
      });
      renderRows(11);
      expect(scrollToRow).not.toHaveBeenCalled();
    });

    it('ha a mérés utáni jelentés szerint a kinyitott sor kitolta az utolsót, a követés kikapcsolva marad', () => {
      const { list, element } = listWithElement();
      mountAtBottom(10, list);

      click(addDisclosure(element));
      act(() => {
        current().onRowsRendered({ startIndex: 0, stopIndex: 6 });
      });
      renderRows(10, createRowHeight());
      renderRows(11);
      expect(scrollToRow).not.toHaveBeenCalled();
      expect(current().unseenCount).toBe(1);
    });

    it('ha a mérés után is látszik az utolsó sor (például az utolsó sor nyílt ki), a követés visszakapcsol: a következő új sor görget', () => {
      const { list, element } = listWithElement();
      mountAtBottom(10, list);

      click(addDisclosure(element));
      renderRows(10, createRowHeight());
      expect(scrollToRow).not.toHaveBeenCalled();

      renderRows(11);
      expect(scrollToRow).toHaveBeenCalledWith({ index: 10, align: 'end' });
      expect(current().unseenCount).toBe(0);
    });

    it('egy képkockán belüli ki-be csukás (két kattintás ugyanazon a fejlécen, mérés nélkül) nem függeszti fel a követést', () => {
      const { list, element } = listWithElement();
      mountAtBottom(10, list);

      const title = addDisclosure(element);
      click(title);
      click(title);
      renderRows(11);
      expect(scrollToRow).toHaveBeenCalledWith({ index: 10, align: 'end' });
    });

    it('két különböző fejléc kattintása után az egyik visszacsukása nem zárja le a várakozást, a másik még nincs mérve', () => {
      const { list, element } = listWithElement();
      mountAtBottom(10, list);

      const first = addDisclosure(element);
      click(first);
      click(addDisclosure(element));
      click(first);
      renderRows(11);
      expect(scrollToRow).not.toHaveBeenCalled();
    });

    it('a mérés és a lezárás közé eső új kattintás a lezárást a saját méréséig elhalasztja', () => {
      const { list, element } = listWithElement();
      mountAtBottom(10, list);

      click(addDisclosure(element));
      const second = addDisclosure(element);
      // A mérés commitja után, a lezárás commitjában, a lezárás előtt.
      probe = {
        skippedCommits: 1,
        run: () => {
          second.dispatchEvent(new Event('click', { bubbles: true }));
        },
      };
      const measured = createRowHeight();
      renderRows(10, measured);
      expect(probe).toBeUndefined();
      renderRows(11, measured);
      expect(scrollToRow).not.toHaveBeenCalled();
      expect(current().unseenCount).toBe(1);

      // A második sor mérése után a jelentés újra visszakapcsolhatja a
      // követést (a felhasználó az aljára görget).
      renderRows(11, createRowHeight());
      act(() => {
        current().onRowsRendered({ startIndex: 4, stopIndex: 10 });
      });
      renderRows(12);
      expect(scrollToRow).toHaveBeenCalledWith({ index: 11, align: 'end' });
    });

    it('az ugrás az aljára a mérésre várakozást is lezárja', () => {
      const { list, element } = listWithElement();
      mountAtBottom(10, list);

      const title = addDisclosure(element);
      click(title);
      renderRows(11);
      act(() => {
        current().jumpToBottom();
      });
      expect(scrollToRow).toHaveBeenCalledWith({ index: 10, align: 'end' });

      // A várakozás lezárult: a jelentés újra kapcsolhat, és ugyanennek a
      // fejlécnek a következő kattintása új váltás, nem a régi párja.
      click(title);
      scrollToRow.mockClear();
      renderRows(12);
      expect(scrollToRow).not.toHaveBeenCalled();
    });

    it('a fejlécen kívüli kattintás nem függeszti fel a követést', () => {
      const { list, element } = listWithElement();
      mountAtBottom(10, list);

      click(element);
      renderRows(11);
      expect(scrollToRow).toHaveBeenCalledWith({ index: 10, align: 'end' });
    });

    it('nem elem célú kattintás (szöveg csomópont) nem függeszti fel a követést', () => {
      const { list, element } = listWithElement();
      mountAtBottom(10, list);

      const text = document.createTextNode('szöveg');
      element.append(text);
      click(text);
      renderRows(11);
      expect(scrollToRow).toHaveBeenCalledWith({ index: 10, align: 'end' });
    });

    it('lista csere után a korábbi elem kattintása már nem függeszti fel a követést', () => {
      const first = listWithElement();
      const second = listWithElement();
      mountAtBottom(10, first.list);
      act(() => {
        current().setList(second.list);
      });
      scrollToRow.mockClear();

      click(addDisclosure(first.element));
      renderRows(11);
      expect(scrollToRow).toHaveBeenCalledWith({ index: 10, align: 'end' });
    });
  });
});
