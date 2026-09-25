import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Pagination,
  PAGINATION_SOURCE_LABELS,
  type PaginationLabels,
  type PaginationProperties,
} from './Pagination.tsx';

const HUNGARIAN_LABELS: PaginationLabels = {
  navigation: 'Jóváhagyások lapozása',
  previous: 'Előző',
  next: 'Következő',
  pageMetaPrefix: '',
  pageMetaSeparator: ' / ',
  rangeMetaSeparator: ' / ',
};

function click(button: HTMLButtonElement): void {
  act(() => {
    button.click();
  });
}

describe('Pagination', () => {
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

  function renderedNavigation(): HTMLElement {
    const navigation = container.querySelector<HTMLElement>('nav');
    if (navigation === null) {
      throw new Error('a lapozó nem található a kirajzolt fán');
    }
    return navigation;
  }

  function renderedMeta(): string {
    return renderedNavigation().querySelector('.pagination__meta')?.textContent ?? '';
  }

  /**
   * A lapozó sora a DOM sorrendjében: az oldalszámok a számukkal, a
   * kihagyásjel "…" alakban, a két szélső gomb nélkül.
   */
  function renderedSlots(): readonly string[] {
    return [...renderedNavigation().querySelectorAll(':scope .pagination__pages > *')]
      .filter((element) => !element.hasAttribute('aria-label'))
      .map((element) => element.textContent);
  }

  function buttonNamed(name: string): HTMLButtonElement {
    const button = [...renderedNavigation().querySelectorAll('button')].find(
      (candidate) => candidate.getAttribute('aria-label') === name || candidate.textContent === name,
    );
    if (button === undefined) {
      throw new Error(`a(z) "${name}" gomb nem található`);
    }
    return button;
  }

  it('alapértelmezésben a forrás szerkezetét és angol szövegeit adja: nav, meta, két szélső gomb, egy oldal', () => {
    act(() => {
      root.render(<Pagination />);
    });
    const navigation = renderedNavigation();
    expect(navigation.className).toBe('pagination');
    expect(navigation.getAttribute('aria-label')).toBe('Pagination');
    expect(renderedMeta()).toBe('Page 1 of 1');
    expect(navigation.querySelector(':scope .pagination__meta strong')?.textContent).toBe('1');
    expect(buttonNamed('Previous').disabled).toBe(true);
    expect(buttonNamed('Next').disabled).toBe(true);
    expect(renderedSlots()).toEqual(['1']);
    expect(buttonNamed('1').getAttribute('aria-current')).toBe('page');
    expect(buttonNamed('1').className).toBe('pagination__page pagination__page--active');
    for (const button of navigation.querySelectorAll<HTMLButtonElement>(':scope button')) {
      expect(button.type).toBe('button');
    }
  });

  it('a forrás szövegei a PAGINATION_SOURCE_LABELS konstansban állnak', () => {
    expect(PAGINATION_SOURCE_LABELS).toEqual({
      navigation: 'Pagination',
      previous: 'Previous',
      next: 'Next',
      pageMetaPrefix: 'Page ',
      pageMetaSeparator: ' of ',
      rangeMetaSeparator: ' of ',
    });
  });

  it('a labels prop minden szöveget felülír: "k / n" alakú meta és magyar nevek', () => {
    act(() => {
      root.render(<Pagination page={2} pageCount={4} labels={HUNGARIAN_LABELS} />);
    });
    expect(renderedNavigation().getAttribute('aria-label')).toBe('Jóváhagyások lapozása');
    expect(renderedMeta()).toBe('2 / 4');
    expect(buttonNamed('Előző').disabled).toBe(false);
    expect(buttonNamed('Következő').disabled).toBe(false);
    expect(buttonNamed('2').getAttribute('aria-current')).toBe('page');
    expect(buttonNamed('1').hasAttribute('aria-current')).toBe(false);
    expect(buttonNamed('1').className).toBe('pagination__page');
  });

  it('a total és a pageSize a tétel tartományt mutatja, és abból számolja az oldalak számát', () => {
    act(() => {
      root.render(<Pagination page={2} total={42} pageSize={10} />);
    });
    expect(renderedMeta()).toBe('11–20 of 42');
    expect(renderedSlots()).toEqual(['1', '2', '3', '4', '5']);
  });

  it('az utolsó oldal tartománya a tételek számánál ér véget, a magyar elválasztóval', () => {
    act(() => {
      root.render(<Pagination page={5} total={42} pageSize={10} labels={HUNGARIAN_LABELS} />);
    });
    expect(renderedMeta()).toBe('41–42 / 42');
    expect(buttonNamed('Következő').disabled).toBe(true);
  });

  it('a pageCount erősebb a total és a pageSize számításánál', () => {
    act(() => {
      root.render(<Pagination pageCount={2} total={42} pageSize={10} />);
    });
    expect(renderedSlots()).toEqual(['1', '2']);
  });

  const incompleteRanges: readonly (readonly [string, PaginationProperties])[] = [
    ['a total hiányzik', { pageSize: 10 }],
    ['a total nulla', { total: 0, pageSize: 10 }],
    ['a pageSize hiányzik', { total: 42 }],
    ['a pageSize nulla', { total: 42, pageSize: 0 }],
  ];
  it.each(incompleteRanges)('ha %s, a meta az oldalt mutatja, és egy oldal van', (_, rangeProperties) => {
    act(() => {
      root.render(<Pagination {...rangeProperties} />);
    });
    expect(renderedMeta()).toBe('Page 1 of 1');
    expect(renderedSlots()).toEqual(['1']);
  });

  it('a tétel tartomány legalább egy oldalt ad', () => {
    act(() => {
      root.render(<Pagination total={-5} pageSize={10} />);
    });
    expect(renderedSlots()).toEqual(['1']);
  });

  it.each([
    ['az elején (jobbra kihagyás)', 1, ['1', '2', '3', '4', '5', '…', '10']],
    ['a végén (balra kihagyás)', 10, ['1', '…', '6', '7', '8', '9', '10']],
    ['középen (mindkét oldalon kihagyás)', 5, ['1', '…', '4', '5', '6', '…', '10']],
  ] as const)('sok oldalnál a forrás kihagyás szabálya szerint rajzol, %s', (_, page, slots) => {
    act(() => {
      root.render(<Pagination page={page} pageCount={10} />);
    });
    expect(renderedSlots()).toEqual(slots);
  });

  it('a siblings prop a látható szomszédok számát szabja meg', () => {
    act(() => {
      root.render(<Pagination page={5} pageCount={10} siblings={0} />);
    });
    expect(renderedSlots()).toEqual(['1', '…', '5', '…', '10']);
  });

  it('a gombok az onChange hívással a cél oldalt adják, a tartományba szorítva', () => {
    const onChange = vi.fn<(page: number) => void>();
    act(() => {
      root.render(<Pagination page={2} pageCount={3} onChange={onChange} />);
    });
    click(buttonNamed('Previous'));
    click(buttonNamed('Next'));
    click(buttonNamed('3'));
    expect(onChange.mock.calls).toEqual([[1], [3], [3]]);
  });

  it('a kattintás a tartomány szélén is 1 és az oldalak száma közé szorul', () => {
    const onChange = vi.fn<(page: number) => void>();
    act(() => {
      root.render(<Pagination page={7} pageCount={3} onChange={onChange} />);
    });
    click(buttonNamed('Previous'));
    act(() => {
      root.render(<Pagination page={-2} pageCount={3} onChange={onChange} />);
    });
    click(buttonNamed('Next'));
    expect(onChange.mock.calls).toEqual([[3], [1]]);
  });

  it('onChange nélkül a kattintás nem dob hibát', () => {
    act(() => {
      root.render(<Pagination page={1} pageCount={2} />);
    });
    expect(() => {
      click(buttonNamed('Next'));
    }).not.toThrow();
  });

  it('az outlined variáns és a hívó osztálya a gyökérre kerül', () => {
    act(() => {
      root.render(<Pagination variant="outlined" className="extra" />);
    });
    expect(renderedNavigation().className).toBe('pagination pagination--outlined extra');
  });
});
