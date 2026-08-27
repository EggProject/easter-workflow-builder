/* eslint-disable unicorn/no-null -- a `null` a tárolt JSON-ból ténylegesen érkezhet verzió mezőként, ezért azt kell elutasítani, nem az `undefined` helyőrzőt */
import { describe, expect, it } from 'vitest';
import { GRAPH_DOCUMENT_VERSION } from './graph-snapshot-document.ts';
import { isGraphSnapshotDocumentVersion } from './is-graph-snapshot-document-version.ts';

describe('isGraphSnapshotDocumentVersion', () => {
  it('igazat ad a ma kiadott verzióra', () => {
    expect(isGraphSnapshotDocumentVersion(GRAPH_DOCUMENT_VERSION)).toBe(true);
    expect(isGraphSnapshotDocumentVersion(1)).toBe(true);
  });

  it('hamisat ad a még ki nem adott és a korábbi verziószámra', () => {
    expect(isGraphSnapshotDocumentVersion(2)).toBe(false);
    expect(isGraphSnapshotDocumentVersion(0)).toBe(false);
    expect(isGraphSnapshotDocumentVersion(-1)).toBe(false);
  });

  it('hamisat ad, ami nem egész szám', () => {
    expect(isGraphSnapshotDocumentVersion(1.5)).toBe(false);
    expect(isGraphSnapshotDocumentVersion('1')).toBe(false);
    expect(isGraphSnapshotDocumentVersion(null)).toBe(false);
    expect(isGraphSnapshotDocumentVersion(undefined)).toBe(false);
  });
});
