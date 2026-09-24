/* eslint-disable unicorn/no-null -- a ListImperativeAPI `element` gettere a könyvtár szerződése szerint `null`-t ad, ha nincs csatolt elem */
import { act } from 'react';
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

  function Harness({ rowCount, rowHeight }: { readonly rowCount: number; readonly rowHeight: DynamicRowHeight }): null {
    latest = useTranscriptAutoScroll(rowCount, rowHeight);
    return null;
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
   * beavatkozásának eseményei kiválthatók.
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

  it('követés közben a sormagasság gyorsítótár változása után (egy kirajzolt sor mért magassága eltért a becsléstől) újra az utolsó sorra görget', () => {
    mountAtBottom(10);

    renderRows(10, createRowHeight());
    expect(scrollToRow).toHaveBeenCalledTimes(1);
    expect(scrollToRow).toHaveBeenCalledWith({ index: 9, align: 'end' });
  });

  it('változatlan sormagasság gyorsítótárral az újrarenderelés nem görget', () => {
    mountAtBottom(10);

    renderRows(10);
    expect(scrollToRow).not.toHaveBeenCalled();
  });

  it('felgörgetett állapotban a sormagasság változás nem görget', () => {
    mountAtBottom(10);
    act(() => {
      current().onRowsRendered({ startIndex: 0, stopIndex: 5 });
    });
    scrollToRow.mockClear();

    renderRows(10, createRowHeight());
    expect(scrollToRow).not.toHaveBeenCalled();
  });

  it.each(['wheel', 'touchstart', 'pointerdown', 'keydown', 'click'])(
    'a lista elemén kiváltott %s után a sormagasság változás nem görget (egy kinyitott sor a helyén marad), és a következő új sor újra élesíti az igazítást',
    (type) => {
      const { list, element } = listWithElement();
      mountAtBottom(10, list);

      element.dispatchEvent(new Event(type));
      const measured = createRowHeight();
      renderRows(10, measured);
      expect(scrollToRow).not.toHaveBeenCalled();

      renderRows(11, measured);
      expect(scrollToRow).toHaveBeenCalledTimes(1);
      renderRows(11, createRowHeight());
      expect(scrollToRow).toHaveBeenCalledTimes(2);
      expect(scrollToRow).toHaveBeenLastCalledWith({ index: 10, align: 'end' });
    },
  );

  /**
   * Egy sor fejlécének kattintása: a `click` célja egy `aria-expanded`
   * gombon BELÜLI elem (a fejléc szövege), ahogy a valódi sorban.
   */
  function clickDisclosure(element: HTMLDivElement): void {
    const header = document.createElement('button');
    header.setAttribute('aria-expanded', 'false');
    const title = document.createElement('span');
    header.append(title);
    element.append(header);
    title.dispatchEvent(new Event('click', { bubbles: true }));
  }

  describe('sor kinyitása élő stream közben', () => {
    it('a mérésig érkező új sor nem görget és nem számol; ha a mérés utáni jelentés szerint a lista felfelé mozdult, a követés kikapcsol, és a visszatartott sor a nem látott sorok közé kerül', () => {
      const { list, element } = listWithElement();
      mountAtBottom(10, list);

      clickDisclosure(element);
      renderRows(11);
      expect(scrollToRow).not.toHaveBeenCalled();
      expect(current().unseenCount).toBe(0);

      const measured = createRowHeight();
      renderRows(11, measured);
      expect(scrollToRow).not.toHaveBeenCalled();

      act(() => {
        current().onRowsRendered({ startIndex: 0, stopIndex: 5 });
      });
      expect(scrollToRow).not.toHaveBeenCalled();
      expect(current().unseenCount).toBe(1);
    });

    it('ha a kinyitás az utolsó sort nem tolja ki, a mérés utáni jelentés után a visszatartott sorra görget', () => {
      const { list, element } = listWithElement();
      mountAtBottom(10, list);

      clickDisclosure(element);
      renderRows(11);
      renderRows(11, createRowHeight());
      act(() => {
        current().onRowsRendered({ startIndex: 0, stopIndex: 9 });
      });
      expect(scrollToRow).toHaveBeenCalledTimes(1);
      expect(scrollToRow).toHaveBeenCalledWith({ index: 10, align: 'end' });
      expect(current().unseenCount).toBe(0);
    });

    it('a mérés előtti jelentés nem zárja a várakozást', () => {
      const { list, element } = listWithElement();
      mountAtBottom(10, list);

      clickDisclosure(element);
      renderRows(11);
      act(() => {
        current().onRowsRendered({ startIndex: 0, stopIndex: 9 });
      });
      expect(scrollToRow).not.toHaveBeenCalled();
    });

    it('új sor nélkül a kinyitás és a mérés utáni jelentés nem görget: a kinyitott sor a helyén marad', () => {
      const { list, element } = listWithElement();
      mountAtBottom(10, list);

      clickDisclosure(element);
      renderRows(10, createRowHeight());
      act(() => {
        current().onRowsRendered({ startIndex: 0, stopIndex: 9 });
      });
      expect(scrollToRow).not.toHaveBeenCalled();
    });

    it('ha a mérés után nem jön jelentés (a látható tartomány nem változott), a következő új sor jelentése zárja a várakozást, és a követés görget', () => {
      const { list, element } = listWithElement();
      mountAtBottom(10, list);

      clickDisclosure(element);
      const measured = createRowHeight();
      renderRows(10, measured);
      renderRows(11, measured);
      expect(scrollToRow).not.toHaveBeenCalled();

      act(() => {
        current().onRowsRendered({ startIndex: 0, stopIndex: 9 });
      });
      expect(scrollToRow).toHaveBeenCalledTimes(1);
      expect(scrollToRow).toHaveBeenCalledWith({ index: 10, align: 'end' });
    });

    it('a sor fejlécén kívüli kattintás nem tart vissza: az új sor görget', () => {
      const { list, element } = listWithElement();
      mountAtBottom(10, list);

      element.dispatchEvent(new Event('click', { bubbles: true }));
      renderRows(11);
      expect(scrollToRow).toHaveBeenCalledWith({ index: 10, align: 'end' });
    });
  });

  it('lista csere után a korábbi elem eseménye már nem függeszti fel az igazítást', () => {
    const first = listWithElement();
    const second = listWithElement();
    mountAtBottom(10, first.list);
    act(() => {
      current().setList(second.list);
    });
    scrollToRow.mockClear();

    first.element.dispatchEvent(new Event('pointerdown'));
    renderRows(10, createRowHeight());
    expect(scrollToRow).toHaveBeenCalledWith({ index: 9, align: 'end' });
  });
});
