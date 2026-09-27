import { describe, expect, it } from 'vitest';
import { measureContentMinimumPixels } from './measure-content-minimum.ts';

function panelWithRegion(tag: string, height: number): HTMLElement {
  const element = document.createElement(tag);
  element.getBoundingClientRect = () => new DOMRect(0, 0, 0, height);
  return element;
}

function regionWithConditionalWidth(defaultWidth: number, maxContentWidth: number): HTMLElement {
  const element = document.createElement('section');
  element.getBoundingClientRect = () =>
    new DOMRect(0, 0, element.style.width === 'max-content' ? maxContentWidth : defaultWidth, 0);
  return element;
}

describe('measureContentMinimumPixels', () => {
  it('nincs a DOM-ban a megnevezett elem, nulla', () => {
    const panel = document.createElement('div');
    document.body.append(panel);
    expect(measureContentMinimumPixels(panel, 'hianyzik', true)).toBe(0);
  });

  it('függőleges csoportban a régió magassága plusz a beágyazott csoport két paneljének minimuma', () => {
    const panel = document.createElement('div');
    const nestedGroup = document.createElement('div');
    nestedGroup.className = 'resizable-group resizable-group--vertical';
    const firstInnerPanel = document.createElement('div');
    firstInnerPanel.className = 'resizable-panel';
    firstInnerPanel.style.minHeight = '60px';
    const handle = document.createElement('div');
    handle.className = 'resizable-handle';
    const secondInnerPanel = document.createElement('div');
    secondInnerPanel.className = 'resizable-panel';
    secondInnerPanel.style.minHeight = '60px';
    nestedGroup.append(firstInnerPanel, handle, secondInnerPanel);
    const region = panelWithRegion('section', 110);
    region.id = 'region-1';
    panel.append(nestedGroup, region);
    document.body.append(panel);

    expect(measureContentMinimumPixels(panel, 'region-1', true)).toBe(230);
  });

  it('függőleges csoportban, beágyazott csoport nélkül, csak a régió magassága', () => {
    const panel = document.createElement('div');
    const region = panelWithRegion('section', 90);
    region.id = 'region-2';
    panel.append(region);
    document.body.append(panel);

    expect(measureContentMinimumPixels(panel, 'region-2', true)).toBe(90);
  });

  it('egy vízszintes beágyazott csoportot nem számol bele a függőleges minimumba', () => {
    const panel = document.createElement('div');
    const nestedGroup = document.createElement('div');
    nestedGroup.className = 'resizable-group';
    const innerPanel = document.createElement('div');
    innerPanel.className = 'resizable-panel';
    innerPanel.style.minWidth = '80px';
    nestedGroup.append(innerPanel);
    const region = panelWithRegion('section', 50);
    region.id = 'region-3';
    panel.append(nestedGroup, region);
    document.body.append(panel);

    expect(measureContentMinimumPixels(panel, 'region-3', true)).toBe(50);
  });

  it('vízszintes csoportban a régió max-content szélessége, a stílus utána visszaáll', () => {
    const panel = document.createElement('div');
    const region = regionWithConditionalWidth(80, 240);
    region.id = 'region-4';
    region.style.width = '80px';
    panel.append(region);
    document.body.append(panel);

    expect(measureContentMinimumPixels(panel, 'region-4', false)).toBe(240);
    expect(region.style.width).toBe('80px');
  });
});
